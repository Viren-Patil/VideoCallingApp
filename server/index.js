import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import webpush from 'web-push';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env manually (no dotenv dependency needed)
try {
  const __dir = dirname(fileURLToPath(import.meta.url));
  const env = readFileSync(resolve(__dir, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length && !process.env[key.trim()]) {
      process.env[key.trim()] = rest.join('=').trim();
    }
  }
} catch { /* .env not present in production — env vars set on Railway */ }

const app = express();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: clientUrl }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── Web Push setup ────────────────────────────────────────────────────────────

const pushReady = !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
if (pushReady) {
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT || 'mailto:admin@callspace.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// In-memory store: deviceId → PushSubscription
const pushSubscriptions = new Map();

// Pending call timers: roomId → timeout (fires push if peer doesn't join within 5s)
const callTimers = new Map();

app.get('/vapid-public-key', (_req, res) => {
  if (!pushReady) return res.status(503).json({ error: 'Push not configured' });
  res.json({ key: process.env.VAPID_PUBLIC_KEY });
});

app.post('/subscribe', (req, res) => {
  const { deviceId, subscription } = req.body;
  if (!deviceId || !subscription) return res.status(400).json({ error: 'Missing fields' });
  pushSubscriptions.set(deviceId, subscription);
  res.json({ ok: true });
});

app.delete('/subscribe', (req, res) => {
  const { deviceId } = req.body ?? {};
  if (deviceId) pushSubscriptions.delete(deviceId);
  res.json({ ok: true });
});

// ── Signaling server ──────────────────────────────────────────────────────────

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientUrl, methods: ['GET', 'POST'] },
});

// rooms: Map<roomId, Set<socketId>>
const rooms = new Map();

function sendCallNotification(callerName, callerDeviceId, roomId) {
  if (!pushReady || pushSubscriptions.size === 0) return;
  const payload = JSON.stringify({
    title: `${callerName || 'Someone'} is calling`,
    body: 'Tap to join the call in Callspace',
    url: `/room?room=${roomId}`,
  });
  pushSubscriptions.forEach((subscription, deviceId) => {
    if (deviceId === callerDeviceId) return;
    webpush.sendNotification(subscription, payload).catch(err => {
      // 410 Gone / 404 = subscription expired, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        pushSubscriptions.delete(deviceId);
      }
    });
  });
}

io.on('connection', (socket) => {
  socket.on('join-room', (payload) => {
    const roomId    = typeof payload === 'string' ? payload : payload?.roomId;
    const name      = typeof payload === 'string' ? '' : (payload?.name     ?? '');
    const deviceId  = typeof payload === 'string' ? '' : (payload?.deviceId ?? '');
    const members   = rooms.get(roomId) ?? new Set();

    if (members.size >= 2) {
      socket.emit('room-full');
      return;
    }

    members.add(socket.id);
    rooms.set(roomId, members);
    socket.join(roomId);
    socket.data.roomId   = roomId;
    socket.data.name     = name;
    socket.data.deviceId = deviceId;

    const isInitiator = members.size === 2;

    if (isInitiator) {
      // Second peer joined — cancel any pending call notification
      clearTimeout(callTimers.get(roomId));
      callTimers.delete(roomId);

      const waitingId  = [...members].find(id => id !== socket.id);
      const peerName   = waitingId ? (io.sockets.sockets.get(waitingId)?.data.name ?? '') : '';
      socket.emit('room-joined', { roomId, isInitiator, peerName });
      socket.to(roomId).emit('peer-joined', { socketId: socket.id, name });
    } else {
      // First peer — schedule push notification if no one joins within 5 seconds
      socket.emit('room-joined', { roomId, isInitiator });
      const timer = setTimeout(() => {
        callTimers.delete(roomId);
        sendCallNotification(name, deviceId, roomId);
      }, 5000);
      callTimers.set(roomId, timer);
    }
  });

  // Relay SDP, ICE, and media-state payloads verbatim
  for (const event of ['offer', 'answer', 'ice-candidate', 'video-toggle', 'audio-toggle', 'chat-message', 'screen-share-started', 'screen-share-stopped']) {
    socket.on(event, (payload) => {
      socket.to(socket.data.roomId).emit(event, payload);
    });
  }

  socket.on('reaction', (emojiKey) => {
    socket.to(socket.data.roomId).emit('reaction', emojiKey);
  });

  const handleLeave = () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    // Cancel any pending call notification for this room
    clearTimeout(callTimers.get(roomId));
    callTimers.delete(roomId);

    const members = rooms.get(roomId);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) rooms.delete(roomId);
    }
    socket.to(roomId).emit('peer-left');
    socket.data.roomId = null;
  };

  socket.on('leave-room', handleLeave);
  socket.on('disconnect', handleLeave);
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Signaling server running on :${PORT}`));
