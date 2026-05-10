import { useEffect, useRef, useState } from 'react';

export default function DeviceCheck({ roomId, localName, onJoin }) {
  const [cameras, setCameras]           = useState([]);
  const [microphones, setMicrophones]   = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId]       = useState('');
  const [micLevel, setMicLevel] = useState(0);
  const [ready, setReady]       = useState(false);
  const [error, setError]       = useState(null);

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const audioCtxRef = useRef(null);
  const animRef     = useRef(null);

  const stopAll = () => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

  const startPreview = async (cameraId, micId) => {
    stopAll();
    setReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const vt = stream.getVideoTracks()[0];
      const at = stream.getAudioTracks()[0];
      if (vt?.getSettings().deviceId) setSelectedCameraId(vt.getSettings().deviceId);
      if (at?.getSettings().deviceId) setSelectedMicId(at.getSettings().deviceId);

      const devices = await navigator.mediaDevices.enumerateDevices();
      setCameras(devices.filter(d => d.kind === 'videoinput'));
      setMicrophones(devices.filter(d => d.kind === 'audioinput'));
      setReady(true);
      setError(null);

      // Mic level meter
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(new MediaStream([at]));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        setMicLevel(Math.min(100, avg * 2.5));
        animRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      setError(err.message || 'Could not access camera or microphone');
    }
  };

  useEffect(() => {
    startPreview(null, null);
    return stopAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleJoin = () => {
    stopAll();
    onJoin({ cameraId: selectedCameraId, micId: selectedMicId });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">🚫</div>
          <h2 className="text-white text-xl font-semibold">Camera / mic access denied</h2>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => startPreview(null, null)}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 bg-dot-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[600px] h-[400px] bg-blue-600/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-lg relative z-10 space-y-4">
        {/* Header */}
        <div className="text-center space-y-1 pb-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">Check your setup</h1>
          <p className="text-gray-500 text-sm">Make sure your camera and microphone are working</p>
        </div>

        {/* Camera preview */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video
                        ring-1 ring-white/8 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-950">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {localName && ready && (
            <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full
                             bg-black/60 backdrop-blur-sm text-white text-xs">
              {localName}
            </span>
          )}
        </div>

        {/* Mic level meter */}
        <div className="flex items-center gap-3 px-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="rgba(255,255,255,0.45)">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${micLevel}%`,
                background: micLevel > 75
                  ? 'linear-gradient(90deg,#22c55e 60%,#ef4444)'
                  : '#22c55e',
              }}
            />
          </div>
          <span className="text-gray-600 text-xs w-8 text-right tabular-nums">{Math.round(micLevel)}%</span>
        </div>

        {/* Device selectors */}
        <div className="bg-gray-900/60 backdrop-blur rounded-2xl p-4 space-y-3 border border-white/6">
          {cameras.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-gray-400 text-xs font-medium">Camera</label>
              <select
                value={selectedCameraId}
                onChange={e => startPreview(e.target.value, selectedMicId)}
                className="w-full bg-gray-800 border border-white/8 text-white text-sm rounded-xl
                           px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {cameras.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {microphones.length > 0 && (
            <div className="space-y-1.5">
              <label className="block text-gray-400 text-xs font-medium">Microphone</label>
              <select
                value={selectedMicId}
                onChange={e => startPreview(selectedCameraId, e.target.value)}
                className="w-full bg-gray-800 border border-white/8 text-white text-sm rounded-xl
                           px-3 py-2.5 focus:outline-none focus:border-blue-500 transition-colors"
              >
                {microphones.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Room badge + Join button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-gray-500 text-xs">Room</span>
            <span className="font-mono text-white text-xs tracking-[0.2em] bg-gray-800/80
                             border border-white/8 px-2.5 py-1 rounded-lg">
              {roomId}
            </span>
          </div>
          <button
            onClick={handleJoin}
            disabled={!ready}
            className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-semibold rounded-xl transition-all duration-150
                       shadow-lg shadow-blue-900/40"
          >
            Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
