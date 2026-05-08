import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { socket } from '../lib/socket';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
};

export function useWebRTC(roomId) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [peerJoined, setPeerJoined] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const politeRef = useRef(false);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const iceCandidateQueue = useRef([]);
  const navigate = useNavigate();

  // Creates a fresh RTCPeerConnection and wires up all its event handlers.
  // Called once on init and again if the peer leaves (to reset for rejoin).
  const makePc = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    remoteStreamRef.current = null;
    iceCandidateQueue.current = [];

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    // Perfect negotiation: this side creates an offer whenever renegotiation
    // is needed (triggered automatically after addTrack).
    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription(); // modern no-arg form: auto offer/answer
        socket.emit('offer', pc.localDescription);
      } catch (err) {
        console.error('onnegotiationneeded error', err);
      } finally {
        makingOffer.current = false;
      }
    };

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socket.emit('ice-candidate', candidate);
    };

    // Accumulate incoming tracks into one MediaStream so the <video> element
    // gets a stable object reference — replacing it on every track fires a
    // redundant re-render and causes flicker.
    pc.ontrack = ({ track }) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      remoteStreamRef.current.addTrack(track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    return pc;
  }, []);

  useEffect(() => {
    if (!roomId) return;

    let active = true;

    const init = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
          audio: true,
        });

        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        setLocalStream(new MediaStream(stream.getTracks()));

        const pc = makePc();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        socket.connect();
        socket.emit('join-room', roomId);
      } catch (err) {
        console.error('getUserMedia failed:', err);
        if (active) setMediaError(err.message);
      }
    };

    // Server tells us our role: isInitiator=true means we are the 2nd peer
    // and will be the impolite peer (we create the first offer).
    socket.on('room-joined', ({ isInitiator }) => {
      politeRef.current = !isInitiator;
    });

    socket.on('peer-joined', () => {
      if (active) setPeerJoined(true);
    });

    socket.on('room-full', () => {
      navigate('/');
    });

    // Perfect negotiation offer handler — handles both offers and collision.
    socket.on('offer', async (description) => {
      const pc = pcRef.current;
      if (!pc) return;

      const offerCollision =
        description.type === 'offer' &&
        (makingOffer.current || pc.signalingState !== 'stable');

      // Impolite peer simply drops offers that arrive during a collision.
      ignoreOffer.current = !politeRef.current && offerCollision;
      if (ignoreOffer.current) return;

      try {
        // setRemoteDescription triggers implicit rollback on polite peer
        // if we're currently in have-local-offer state.
        await pc.setRemoteDescription(description);

        // Drain any ICE candidates that arrived before the remote description.
        const queued = iceCandidateQueue.current.splice(0);
        for (const c of queued) {
          try { await pc.addIceCandidate(c); } catch { /* ignore stale */ }
        }

        if (description.type === 'offer') {
          await pc.setLocalDescription();
          socket.emit('answer', pc.localDescription);
        }
      } catch (err) {
        console.error('offer handler error', err);
      }
    });

    socket.on('answer', async (description) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(description);

        const queued = iceCandidateQueue.current.splice(0);
        for (const c of queued) {
          try { await pc.addIceCandidate(c); } catch { /* ignore stale */ }
        }
      } catch (err) {
        console.error('answer handler error', err);
      }
    });

    socket.on('ice-candidate', async (candidate) => {
      const pc = pcRef.current;
      if (!pc) return;
      // Queue candidates until the remote description is set so we never
      // call addIceCandidate before setRemoteDescription.
      if (!pc.remoteDescription?.type) {
        iceCandidateQueue.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch (err) {
        if (!ignoreOffer.current) console.error('ICE error', err);
      }
    });

    socket.on('peer-left', () => {
      if (!active) return;
      setPeerJoined(false);
      setRemoteStream(null);
      setConnectionState('new');

      // Reset the peer connection so it is ready if the peer rejoins.
      pcRef.current?.close();
      const pc = makePc();
      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    });

    init();

    return () => {
      active = false;
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      socket.emit('leave-room');
      socket.off('room-joined');
      socket.off('peer-joined');
      socket.off('room-full');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('peer-left');
      socket.disconnect();
    };
  }, [roomId, navigate, makePc]);

  const leaveCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socket.emit('leave-room');
    socket.disconnect();
    navigate('/');
  }, [navigate]);

  return {
    localStream,
    remoteStream,
    connectionState,
    peerJoined,
    mediaError,
    leaveCall,
  };
}
