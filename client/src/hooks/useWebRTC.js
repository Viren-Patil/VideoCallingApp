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

export function useWebRTC(roomId, localName = '', initialCameraId = '', initialMicId = '') {
  // ── Streams & connection ──────────────────────────────────────────────────
  const [localStream, setLocalStream] = useState(null);       // camera normally; screen when sharing
  const [localCameraStream, setLocalCameraStream] = useState(null); // always the camera
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [peerJoined, setPeerJoined] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [remotePeerName, setRemotePeerName] = useState('');
  const [connectionQuality, setConnectionQuality] = useState(null);
  const [connectionStats, setConnectionStats] = useState(null);
  const [isLowBandwidth, setIsLowBandwidth] = useState(false);
  const [isBackgroundBlur, setIsBackgroundBlur] = useState(false);

  // ── Media control state ───────────────────────────────────────────────────
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);
  const [isRemoteAudioMuted, setIsRemoteAudioMuted] = useState(false);
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
  const screenTransceiverRef = useRef(null);    // the extra sendonly transceiver added for screen share
  const remoteScreenTrackIdRef = useRef(null);  // track.id the remote peer signaled as their screen share
  const audioContextRef = useRef(null);  // AudioContext for mic+screen audio mixing
  const remoteStreamRef = useRef(null);
  const politeRef = useRef(false);
  const makingOffer = useRef(false);
  const ignoreOffer = useRef(false);
  const iceCandidateQueue = useRef([]);
  const isAudioMutedRef = useRef(false); // mirrors state — readable in async callbacks
  const isVideoOffRef = useRef(false);
  const selectedCameraIdRef = useRef('');
  const selectedMicIdRef = useRef('');
  const qualityIntervalRef = useRef(null);
  const prevQualityRef = useRef(null);
  const prevBytesSentRef = useRef(0);
  const prevBytesRecvRef = useRef(0);
  const isBackgroundBlurRef = useRef(false);
  const blurCanvasRef    = useRef(null);   // offscreen canvas producing the blurred video
  const blurTempRef      = useRef(null);   // temp canvas for person compositing
  const blurVideoElRef   = useRef(null);   // hidden <video> feeding camera frames to MediaPipe
  const blurAnimRef      = useRef(null);   // { running: bool } — controls the frame loop
  const blurSegRef       = useRef(null);   // SelfieSegmentation instance
  const initCameraIdRef = useRef(initialCameraId);
  const initMicIdRef = useRef(initialMicId);
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

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
      if (pc.connectionState === 'connected') {
        // Bitrate enforcement
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          try {
            const params = sender.getParameters();
            if (params.encodings?.length) {
              params.encodings[0].maxBitrate = 4_000_000;
              params.encodings[0].maxFramerate = 30;
              params.encodings[0].scaleResolutionDownBy = 1.0;
            }
            sender.setParameters(params);
          } catch { /* not critical */ }
        }

        // Connection quality + stats polling
        qualityIntervalRef.current = setInterval(async () => {
          const stats = await pc.getStats();
          let rtt = null;
          let packetsLost = 0, packetsReceived = 0;
          let bytesSent = 0, bytesReceived = 0;
          let frameWidth = 0, frameHeight = 0;
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded' &&
                report.currentRoundTripTime != null && rtt === null) {
              rtt = report.currentRoundTripTime * 1000;
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              packetsLost     = report.packetsLost     ?? 0;
              packetsReceived = report.packetsReceived ?? 0;
              bytesReceived   = report.bytesReceived   ?? 0;
              frameWidth      = report.frameWidth      ?? 0;
              frameHeight     = report.frameHeight     ?? 0;
            }
            if (report.type === 'outbound-rtp' && report.kind === 'video') {
              bytesSent = report.bytesSent ?? 0;
            }
          });
          if (rtt === null) return;

          const total    = packetsLost + packetsReceived;
          const lossRate = total > 0 ? packetsLost / total : 0;
          const bitrateSent = Math.round((bytesSent    - prevBytesSentRef.current) * 8 / 3 / 1000);
          const bitrateRecv = Math.round((bytesReceived - prevBytesRecvRef.current) * 8 / 3 / 1000);
          prevBytesSentRef.current = bytesSent;
          prevBytesRecvRef.current = bytesReceived;

          let quality;
          if      (rtt < 150 && lossRate < 0.01) quality = 'good';
          else if (rtt < 300 && lossRate < 0.05) quality = 'fair';
          else                                   quality = 'poor';

          setConnectionQuality(quality);
          setConnectionStats({
            rtt:         Math.round(rtt),
            lossRate:    Math.round(lossRate * 100),
            bitrateSent: Math.max(0, bitrateSent),
            bitrateRecv: Math.max(0, bitrateRecv),
            width:       frameWidth,
            height:      frameHeight,
          });

          // Low-bandwidth mode: scale down when poor, restore when recovered
          if (quality === 'poor' && prevQualityRef.current !== 'poor') {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              try {
                const params = sender.getParameters();
                if (params.encodings?.length) {
                  params.encodings[0].scaleResolutionDownBy = 4;
                  params.encodings[0].maxBitrate = 500_000;
                }
                await sender.setParameters(params);
              } catch { /* not critical */ }
            }
            setIsLowBandwidth(true);
          } else if (quality !== 'poor' && prevQualityRef.current === 'poor') {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              try {
                const params = sender.getParameters();
                if (params.encodings?.length) {
                  params.encodings[0].scaleResolutionDownBy = 1.0;
                  params.encodings[0].maxBitrate = 4_000_000;
                }
                await sender.setParameters(params);
              } catch { /* not critical */ }
            }
            setIsLowBandwidth(false);
          }
          prevQualityRef.current = quality;
        }, 3000);
      } else {
        clearInterval(qualityIntervalRef.current);
      }
    };

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
      // If the remote peer signaled this track ID as their screen share, route it separately
      if (track.kind === 'video' && remoteScreenTrackIdRef.current === track.id) {
        setRemoteScreenStream(new MediaStream([track]));
        track.onended = () => setRemoteScreenStream(null);
        return;
      }
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
          video: {
            ...(initCameraIdRef.current ? { deviceId: { exact: initCameraIdRef.current } } : {}),
            width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
          },
          audio: {
            ...(initMicIdRef.current ? { deviceId: { exact: initMicIdRef.current } } : {}),
            noiseSuppression: true, echoCancellation: true, autoGainControl: true,
          },
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
        setLocalCameraStream(new MediaStream(stream.getTracks()));

        // Enumerate after getUserMedia so labels are visible
        await enumerateDevices();
        navigator.mediaDevices.addEventListener('devicechange', enumerateDevices);

        const pc = makePc();
        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        // Prefer H.264 → VP9 before the first SDP exchange (must be before onnegotiationneeded fires)
        try {
          const videoTxcvr = pc.getTransceivers().find(t => t.sender.track?.kind === 'video');
          if (videoTxcvr && RTCRtpReceiver.getCapabilities) {
            const { codecs } = RTCRtpReceiver.getCapabilities('video');
            const sorted = [
              ...codecs.filter(c => c.mimeType === 'video/H264'),
              ...codecs.filter(c => c.mimeType === 'video/VP9'),
              ...codecs.filter(c => !['video/H264', 'video/VP9'].includes(c.mimeType)),
            ];
            videoTxcvr.setCodecPreferences(sorted);
          }
        } catch { /* Firefox does not support setCodecPreferences */ }

        socket.connect();
        socket.emit('join-room', { roomId, name: localName });
      } catch (err) {
        console.error('getUserMedia failed:', err);
        if (active) setMediaError(err.message);
      }
    };

    socket.on('room-joined', ({ isInitiator, peerName }) => {
      politeRef.current = !isInitiator;
      if (peerName) setRemotePeerName(peerName);
    });
    socket.on('peer-joined', ({ name } = {}) => {
      if (!active) return;
      setPeerJoined(true);
      if (name) setRemotePeerName(name);
      // The waiting peer is always polite — it defers to whoever is (re)joining
      politeRef.current = true;
      // If the PC was torn down when the previous peer left, rebuild it now
      // rather than at peer-left time (avoids sending offers into an empty room)
      if (!pcRef.current) {
        const pc = makePc();
        localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current));
      }
    });
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

    socket.on('video-toggle', (isOff) => {
      if (active) setIsRemoteVideoOff(isOff);
    });

    socket.on('audio-toggle', (isOff) => {
      if (active) setIsRemoteAudioMuted(isOff);
    });

    socket.on('screen-share-started', ({ trackId }) => {
      if (active) remoteScreenTrackIdRef.current = trackId;
    });

    socket.on('screen-share-stopped', () => {
      remoteScreenTrackIdRef.current = null;
      if (active) setRemoteScreenStream(null);
    });

    socket.on('peer-left', () => {
      if (!active) return;
      setPeerJoined(false);
      setRemoteStream(null);
      setRemoteScreenStream(null);
      remoteScreenTrackIdRef.current = null;
      setConnectionState('new');
      setIsRemoteVideoOff(false);
      setIsRemoteAudioMuted(false);
      setRemotePeerName('');
      setConnectionQuality(null);
      setConnectionStats(null);
      setIsLowBandwidth(false);
      prevQualityRef.current = null;
      prevBytesSentRef.current = 0;
      prevBytesRecvRef.current = 0;
      clearInterval(qualityIntervalRef.current);
      pcRef.current?.close();
      // Null out instead of immediately recreating — if we create a PC here
      // and add tracks, onnegotiationneeded fires and sends an offer into an
      // empty room, leaving the PC in have-local-offer state. When the peer
      // rejoins and also sends an offer, both peers detect a collision. If both
      // happen to be "impolite" they both drop each other's offer → deadlock.
      // Instead we rebuild in peer-joined once we know a new peer is arriving.
      pcRef.current = null;
    });

    init();

    return () => {
      active = false;
      navigator.mediaDevices.removeEventListener('devicechange', enumerateDevices);
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      audioContextRef.current?.close();
      clearInterval(qualityIntervalRef.current);
      if (blurAnimRef.current) { blurAnimRef.current.running = false; blurAnimRef.current = null; }
      blurSegRef.current?.close?.();
      blurSegRef.current = null;
      blurVideoElRef.current?.pause?.();
      blurVideoElRef.current = null;
      localStreamRef.current = null;
      cameraTrackRef.current = null;
      screenStreamRef.current = null;
      audioContextRef.current = null;
      pcRef.current?.close();
      pcRef.current = null;
      socket.emit('leave-room');
      socket.off('room-joined');
      socket.off('peer-joined');
      socket.off('room-full');
      socket.off('offer');
      socket.off('answer');
      socket.off('ice-candidate');
      socket.off('video-toggle');
      socket.off('audio-toggle');
      socket.off('screen-share-started');
      socket.off('screen-share-stopped');
      socket.off('peer-left');
      socket.disconnect();
    };
  }, [roomId, localName, navigate, makePc, enumerateDevices]);

  // ── Media controls ────────────────────────────────────────────────────────

  const toggleAudio = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    isAudioMutedRef.current = !track.enabled;
    setIsAudioMuted(!track.enabled);
    socket.emit('audio-toggle', !track.enabled);
  }, []);

  const toggleVideo = useCallback(() => {
    const track = cameraTrackRef.current;
    if (!track) return;
    track.enabled = !track.enabled;
    isVideoOffRef.current = !track.enabled;
    setIsVideoOff(!track.enabled);
    socket.emit('video-toggle', !track.enabled);
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
      setLocalCameraStream(new MediaStream(newLocalStream.getTracks()));
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
      setLocalCameraStream(new MediaStream(newLocalStream.getTracks()));
      setSelectedMicId(deviceId);
    } catch (err) {
      console.error('switchMicrophone error:', err);
    }
  }, []);

  // ── Background blur ───────────────────────────────────────────────────────

  const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1675465747';

  const stopBlurCanvas = useCallback(() => {
    if (blurAnimRef.current) { blurAnimRef.current.running = false; blurAnimRef.current = null; }
    blurSegRef.current?.close?.();
    blurSegRef.current = null;
    blurVideoElRef.current?.pause?.();
    blurVideoElRef.current = null;
    blurCanvasRef.current = null;
    blurTempRef.current = null;
  }, []);

  const toggleBackgroundBlur = useCallback(async () => {
    const cameraTrack = cameraTrackRef.current;
    if (!cameraTrack) return false;
    const next = !isBackgroundBlurRef.current;

    // ── Turning blur OFF ──────────────────────────────────────────────────────
    if (!next) {
      stopBlurCanvas();
      // Try to clear native blur too (no-op if it was never set)
      try { await cameraTrack.applyConstraints({ backgroundBlur: false }); } catch { /* ignore */ }
      // Restore camera track to the video sender
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrack);
      // Restore local stream previews (only if not screen sharing)
      if (!screenStreamRef.current) {
        const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
        const s = new MediaStream([...audioTracks, cameraTrack]);
        setLocalStream(new MediaStream(s.getTracks()));
        setLocalCameraStream(new MediaStream(s.getTracks()));
      }
      isBackgroundBlurRef.current = false;
      setIsBackgroundBlur(false);
      return true;
    }

    // ── Turning blur ON ───────────────────────────────────────────────────────

    // 1. Try native backgroundBlur (ChromeOS / Android Chrome, some hardware)
    const caps = cameraTrack.getCapabilities?.();
    const nativeOk = Array.isArray(caps?.backgroundBlur)
      ? caps.backgroundBlur.includes(true)
      : caps?.backgroundBlur === true;
    if (nativeOk) {
      try {
        await cameraTrack.applyConstraints({ backgroundBlur: true });
        isBackgroundBlurRef.current = true;
        setIsBackgroundBlur(true);
        return true;
      } catch { /* fall through to canvas */ }
    }

    // 2. Canvas fallback — MediaPipe Selfie Segmentation loaded from CDN
    try {
      // Lazy-load the MediaPipe script once
      if (!window.SelfieSegmentation) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `${MEDIAPIPE_CDN}/selfie_segmentation.js`;
          script.crossOrigin = 'anonymous';
          script.onload = resolve;
          script.onerror = () => reject(new Error('MediaPipe CDN load failed'));
          document.head.appendChild(script);
        });
      }

      const { width = 640, height = 480 } = cameraTrack.getSettings();

      // Half-resolution canvas fed to MediaPipe — far less work for the model
      const PW = Math.max(160, Math.round(width / 2));
      const PH = Math.max(90,  Math.round(height / 2));
      const small = document.createElement('canvas');
      small.width = PW; small.height = PH;
      const smallCtx = small.getContext('2d');

      // Hidden video element — reads live camera frames
      const video = document.createElement('video');
      video.srcObject = new MediaStream([cameraTrack]);
      video.muted = true;
      video.width = width;
      video.height = height;
      await new Promise(r => { video.onloadedmetadata = r; });
      video.play();
      blurVideoElRef.current = video;

      // Full-resolution output canvas → becomes the sent video track
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      blurCanvasRef.current = canvas;
      const ctx = canvas.getContext('2d');

      // Temp canvas — composites the sharp person using the mask
      const tmp = document.createElement('canvas');
      tmp.width = width;
      tmp.height = height;
      blurTempRef.current = tmp;
      const tmpCtx = tmp.getContext('2d');

      // eslint-disable-next-line no-undef
      const seg = new SelfieSegmentation({ locateFile: f => `${MEDIAPIPE_CDN}/${f}` });
      // Model 0 = general/fast, model 1 = landscape (slower)
      seg.setOptions({ modelSelection: 0 });

      // Cache the latest mask — onResults fires at MediaPipe's own rate, not rAF rate
      let latestMask = null;
      seg.onResults(({ segmentationMask }) => { latestMask = segmentationMask; });
      blurSegRef.current = seg;
      await seg.initialize();

      // rAF loop runs at 60fps and composites using the most-recent mask.
      // MediaPipe is called concurrently (non-blocking) at whatever rate it can sustain
      // (typically 15-20fps on a mid-range laptop) — video stays smooth regardless.
      const state = { running: true, processing: false };
      blurAnimRef.current = state;
      const sendFrame = () => {
        if (!state.running) return;
        if (video.readyState >= 2) {
          if (latestMask) {
            // 1. Extract sharp person into tmp canvas via mask
            tmpCtx.clearRect(0, 0, width, height);
            tmpCtx.drawImage(latestMask, 0, 0, width, height); // upscale mask to full res
            tmpCtx.globalCompositeOperation = 'source-in';
            tmpCtx.drawImage(video, 0, 0, width, height);      // full-res camera pixels
            tmpCtx.globalCompositeOperation = 'source-over';

            // 2. Blurred background → sharp person on top
            ctx.clearRect(0, 0, width, height);
            ctx.filter = 'blur(16px)';
            ctx.drawImage(video, 0, 0, width, height);
            ctx.filter = 'none';
            ctx.drawImage(tmp, 0, 0);
          } else {
            // No mask yet (model still loading) — pass through unblurred
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(video, 0, 0, width, height);
          }

          // Feed a downscaled frame to MediaPipe — only when it's free
          if (!state.processing) {
            state.processing = true;
            smallCtx.drawImage(video, 0, 0, PW, PH);
            seg.send({ image: small }).finally(() => { state.processing = false; });
          }
        }
        requestAnimationFrame(sendFrame);
      };
      sendFrame();

      // Swap the video sender's track to the canvas stream
      const canvasTrack = canvas.captureStream(30).getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(canvasTrack);

      // Update local previews with the blurred canvas track
      const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
      const blurredStream = new MediaStream([...audioTracks, canvasTrack]);
      setLocalStream(new MediaStream(blurredStream.getTracks()));
      setLocalCameraStream(new MediaStream(blurredStream.getTracks()));

      isBackgroundBlurRef.current = true;
      setIsBackgroundBlur(true);
      return true;
    } catch (err) {
      console.error('Background blur error:', err);
      stopBlurCanvas();
      return false;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopBlurCanvas]);

  // ── Screen sharing ────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(async () => {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;

    // Tear down the audio mixer and restore the raw mic track
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      const micTrack = localStreamRef.current?.getAudioTracks()[0];
      if (micTrack) {
        const audioSender = pcRef.current?.getSenders().find(s => s.track?.kind === 'audio');
        if (audioSender) await audioSender.replaceTrack(micTrack);
      }
    }

    // Null out the screen transceiver's track — camera was never replaced so no restore needed
    if (screenTransceiverRef.current) {
      try { await screenTransceiverRef.current.sender.replaceTrack(null); } catch { /* ignore */ }
      screenTransceiverRef.current = null;
    }

    socket.emit('screen-share-stopped');

    // Restore local PiP preview to camera
    const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
    const cameraTrack = cameraTrackRef.current;
    if (cameraTrack) setLocalStream(new MediaStream([...audioTracks, cameraTrack]));

    setIsScreenSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: true,
      });
      screenStreamRef.current = screenStream;

      const screenVideoTrack = screenStream.getVideoTracks()[0];
      if ('contentHint' in screenVideoTrack) screenVideoTrack.contentHint = 'detail';

      // Add screen as a NEW sendonly transceiver — camera transceiver is untouched,
      // so the remote peer receives both camera and screen simultaneously.
      const pc = pcRef.current;
      if (pc) {
        const transceiver = pc.addTransceiver(screenVideoTrack, { direction: 'sendonly' });
        screenTransceiverRef.current = transceiver;
        // Signal the remote peer which track ID is the screen share
        // (socket event travels faster than the SDP/ICE round-trip so it arrives first)
        socket.emit('screen-share-started', { trackId: screenVideoTrack.id });
      }

      // If the user chose to share audio, mix it with the mic so both are heard
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack) {
        const micTrack = localStreamRef.current?.getAudioTracks()[0];
        if (micTrack) {
          const ctx = new AudioContext();
          audioContextRef.current = ctx;
          const micSource    = ctx.createMediaStreamSource(new MediaStream([micTrack]));
          const screenSource = ctx.createMediaStreamSource(new MediaStream([screenAudioTrack]));
          const destination  = ctx.createMediaStreamDestination();
          micSource.connect(destination);
          screenSource.connect(destination);
          const mixedTrack = destination.stream.getAudioTracks()[0];
          const audioSender = pc?.getSenders().find(s => s.track?.kind === 'audio');
          if (audioSender) await audioSender.replaceTrack(mixedTrack);
        }
      }

      // Update local PiP preview to show the screen (so sharer sees "Sharing" label)
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
    clearInterval(qualityIntervalRef.current);
    pcRef.current?.close();
    socket.emit('leave-room');
    socket.disconnect();
    navigate('/');
  }, [navigate]);

  return {
    // Streams & state
    localStream, localCameraStream, remoteStream, remoteScreenStream, connectionState, peerJoined, mediaError,
    // Names & quality
    remotePeerName, connectionQuality, connectionStats, isLowBandwidth,
    // Media controls
    isAudioMuted, isVideoOff, isRemoteVideoOff, isRemoteAudioMuted, isScreenSharing,
    isBackgroundBlur,
    toggleAudio, toggleVideo, toggleBackgroundBlur,
    // Device management
    cameras, microphones, selectedCameraId, selectedMicId,
    switchCamera, switchMicrophone,
    // Screen share
    startScreenShare, stopScreenShare,
    // Call
    leaveCall,
  };
}
