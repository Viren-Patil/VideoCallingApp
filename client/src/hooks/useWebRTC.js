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
  // ── Streams & connection ──────────────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [peerJoined, setPeerJoined] = useState(false);
  const [mediaError, setMediaError] = useState(null);

  // ── Media control state ───────────────────────────────────────────────────
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // ── Device lists ──────────────────────────────────────────────────────────
  const [cameras, setCameras] = useState([]);
  const [microphones, setMicrophones] = useState([]);
  const [selectedCameraId, _setSelectedCameraId] = useState('');
  const [selectedMicId, _setSelectedMicId] = useState('');

  // ── Refs (used inside stable callbacks to avoid stale closures) ───────────
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);   // camera + mic tracks (source of truth)
  const cameraTrackRef = useRef(null);   // current camera track — preserved across screen share
  const screenStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const politeRef = useRef(false);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const iceCandidateQueue = useRef([]);
  const isAudioMutedRef = useRef(false); // mirrors state — readable in async callbacks
  const isVideoOffRef = useRef(false);
  const selectedCameraIdRef = useRef('');
  const selectedMicIdRef = useRef('');
  const navigate = useNavigate();

  // Keep refs in sync with state setters
  const setSelectedCameraId = (id) => { selectedCameraIdRef.current = id; _setSelectedCameraId(id); };
  const setSelectedMicId    = (id) => { selectedMicIdRef.current = id;    _setSelectedMicId(id); };

  // ── Device enumeration ────────────────────────────────────────────────────
  // Must be called after getUserMedia so the browser reveals device labels.
  const enumerateDevices = useCallback(async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter(d => d.kind === 'videoinput'));
    setMicrophones(devices.filter(d => d.kind === 'audioinput'));
  }, []);

  // ── RTCPeerConnection factory ─────────────────────────────────────────────
  const makePc = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;
    remoteStreamRef.current = null;
    iceCandidateQueue.current = [];

    pc.onconnectionstatechange = () => setConnectionState(pc.connectionState);

    pc.onnegotiationneeded = async () => {
      try {
        makingOffer.current = true;
        await pc.setLocalDescription();
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

    pc.ontrack = ({ track }) => {
      if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
      remoteStreamRef.current.addTrack(track);
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    return pc;
  }, []);

  // ── Main effect: media acquisition + signaling ────────────────────────────
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
        cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;

        // Set initial device IDs so the dropdowns start selected correctly
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (videoTrack?.getSettings().deviceId) setSelectedCameraId(videoTrack.getSettings().deviceId);
        if (audioTrack?.getSettings().deviceId) setSelectedMicId(audioTrack.getSettings().deviceId);

        setLocalStream(new MediaStream(stream.getTracks()));

        // Enumerate after getUserMedia so labels are visible
        await enumerateDevices();
        navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);

        const pc = makePc();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        socket.connect();
        socket.emit('join-room', roomId);
      } catch (err) {
        console.error('getUserMedia failed:', err);
        if (active) setMediaError(err.message);
      }
    };

    socket.on('room-joined', ({ isInitiator }) => { politeRef.current = !isInitiator; });
    socket.on('peer-joined', () => { if (active) setPeerJoined(true); });
    socket.on('room-full', () => navigate('/'));

    socket.on('offer', async (description) => {
      const pc = pcRef.current;
      if (!pc) return;
      const offerCollision =
        description.type === 'offer' &&
        (makingOffer.current || pc.signalingState !== 'stable');
      ignoreOffer.current = !politeRef.current && offerCollision;
      if (ignoreOffer.current) return;
      try {
        await pc.setRemoteDescription(description);
        const queued = iceCandidateQueue.current.splice(0);
        for (const c of queued) { try { await pc.addIceCandidate(c); } catch { /* stale */ } }
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          socket.emit('answer', pc.localDescription);
        }
      } catch (err) { console.error('offer handler error', err); }
    });

    socket.on('answer', async (description) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(description);
        const queued = iceCandidateQueue.current.splice(0);
        for (const c of queued) { try { await pc.addIceCandidate(c); } catch { /* stale */ } }
      } catch (err) { console.error('answer handler error', err); }
    });

    socket.on('ice-candidate', async (candidate) => {
      const pc = pcRef.current;
      if (!pc) return;
      if (!pc.remoteDescription?.type) { iceCandidateQueue.current.push(candidate); return; }
      try { await pc.addIceCandidate(candidate); }
      catch (err) { if (!ignoreOffer.current) console.error('ICE error', err); }
    });

    socket.on('peer-left', () => {
      if (!active) return;
      setPeerJoined(false);
      setRemoteStream(null);
      setConnectionState('new');
      pcRef.current?.close();
      const pc = makePc();
      localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
    });

    init();

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      cameraTrackRef.current = null;
      screenStreamRef.current = null;
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
  }, [roomId, navigate, makePc, enumerateDevices]);

  // ── Media controls ────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    isAudioMutedRef.current = !track.enabled;
    setIsAudioMuted(!track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = cameraTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    isVideoOffRef.current = !track.enabled;
    setIsVideoOff(!track.enabled);
  }, []);

  // ── Device switching ──────────────────────────────────────────────────────
  // replaceTrack swaps the encoded track on the sender without renegotiation.

  const switchCamera = useCallback(async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      // Preserve current on/off state
      newTrack.enabled = !isVideoOffRef.current;

      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      // Stop old camera track and update refs
      cameraTrackRef.current?.stop();
      cameraTrackRef.current = newTrack;

      // Rebuild local stream with new video + existing audio
      const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
      const newLocalStream = new MediaStream([...audioTracks, newTrack]);
      localStreamRef.current = newLocalStream;
      setLocalStream(new MediaStream(newLocalStream.getTracks()));
      setSelectedCameraId(deviceId);
    } catch (err) {
      console.error('switchCamera error:', err);
    }
  }, []);

  const switchMicrophone = useCallback(async (deviceId) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getAudioTracks()[0];
      // Preserve current mute state
      newTrack.enabled = !isAudioMutedRef.current;

      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) await sender.replaceTrack(newTrack);

      // Stop old mic track and update stream
      localStreamRef.current?.getAudioTracks().forEach(t => t.stop());
      const videoTracks = localStreamRef.current?.getVideoTracks() ?? [];
      const newLocalStream = new MediaStream([...videoTracks, newTrack]);
      localStreamRef.current = newLocalStream;
      setLocalStream(new MediaStream(newLocalStream.getTracks()));
      setSelectedMicId(deviceId);
    } catch (err) {
      console.error('switchMicrophone error:', err);
    }
  }, []);

  // ── Screen sharing ────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    const cameraTrack = cameraTrackRef.current;
    const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');

    if (sender && cameraTrack) {
      await sender.replaceTrack(cameraTrack);
      // Restore camera bitrate (~4 Mbps)
      try {
        const params = sender.getParameters();
        if (params.encodings?.length) {
          params.encodings[0].maxBitrate = 4_000_000;
        }
        await sender.setParameters(params);
      } catch { /* not critical */ }
    }

    // Restore mic track if system audio was swapped in
    const micTrack = localStreamRef.current?.getAudioTracks()[0];
    if (micTrack) {
      const audioSender = pcRef.current?.getSenders().find(s => s.track?.kind === 'audio');
      if (audioSender) await audioSender.replaceTrack(micTrack);
    }

    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (cameraTrack) setLocalStream(new MediaStream([...audioTracks, cameraTrack]));

    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async (withAudio = false) => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: withAudio,
      });
      screenStreamRef.current = screenStream;

      const screenVideoTrack = screenStream.getVideoTracks()[0];

      // Tell the encoder this is screen/detail content, not motion-heavy camera footage.
      // This makes the encoder prioritise sharpness (text, UI) over smoothness.
      if ('contentHint' in screenVideoTrack) {
        screenVideoTrack.contentHint = 'detail';
      }

      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenVideoTrack);
        // Boost bitrate for screen content — sharp UI/text needs more bits than camera
        try {
          const params = sender.getParameters();
          if (params.encodings?.length) {
            params.encodings[0].maxBitrate = 8_000_000; // 8 Mbps for crisp screen share
          }
          await sender.setParameters(params);
        } catch { /* not critical */ }
      }

      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack) {
        const audioSender = pcRef.current?.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) await audioSender.replaceTrack(screenAudioTrack);
      }

      const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
      setLocalStream(new MediaStream([...audioTracks, screenVideoTrack]));

      screenVideoTrack.onended = () => stopScreenShare();
      setIsScreenSharing(true);
    } catch (err) {
      if (err.name !== 'NotAllowedError') console.error('Screen share error:', err);
    }
  }, [stopScreenShare]);

  // ── Leave ─────────────────────────────────────────────────────────────────

  const leaveCall = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    socket.emit('leave-room');
    socket.disconnect();
    navigate('/');
  }, [navigate]);

  return {
    // Streams & state
    localStream, remoteStream, connectionState, peerJoined, mediaError,
    // Media controls
    isAudioMuted, isVideoOff, isScreenSharing,
    toggleAudio, toggleVideo,
    // Device management
    cameras, microphones, selectedCameraId, selectedMicId,
    switchCamera, switchMicrophone,
    // Screen share
    startScreenShare, stopScreenShare,
    // Call
    leaveCall,
  };
}
