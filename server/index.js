import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

app.use(cors({ origin: clientUrl }));
app.get('/health', (_req, res) => res.json({ ok: true }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: clientUrl, methods: ['GET', 'POST'] },
});

// rooms: Map<roomId, Set<socketId>>
const rooms = new Map();

io.on('connection', (socket) => {
  socket.on('join-room', (payload) => {
    const roomId = typeof payload === 'string' ? payload : payload?.roomId;
    const name   = typeof payload === 'string' ? '' : (payload?.name ?? '');
    const members = rooms.get(roomId) ?? new Set();

    if (members.size >= 2) {
      socket.emit('room-full');
      return;
    }

    members.add(socket.id);
    rooms.set(roomId, members);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = name;

    // isInitiator = true means this peer is the second to join and will create the first offer
    const isInitiator = members.size === 2;

    if (isInitiator) {
      const waitingId = [...members].find(id => id !== socket.id);
      const peerName = waitingId ? (io.sockets.sockets.get(waitingId)?.data.name ?? '') : '';
      socket.emit('room-joined', { roomId, isInitiator, peerName });
      socket.to(roomId).emit('peer-joined', { socketId: socket.id, name });
    } else {
      socket.emit('room-joined', { roomId, isInitiator });
    }
  });

  // Relay SDP, ICE, and video-toggle payloads verbatim
  for (const event of ['offer', 'answer', 'ice-candidate', 'video-toggle', 'audio-toggle', 'chat-message']) {
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
