import { useEffect, useRef, useState } from 'react';

// ── Mic level visualizer — animated bar equalizer ─────────────────────────────

const BAR_HEIGHTS = [40, 60, 80, 65, 90, 55, 75, 85, 70, 60, 80, 55, 70, 85, 65, 50];

function MicVisualizer({ level }) {
  return (
    <div className="flex items-end gap-[3px] h-8 w-full">
      {BAR_HEIGHTS.map((h, i) => {
        const threshold = (i / BAR_HEIGHTS.length) * 100;
        const active    = level > threshold;
        const color = threshold > 78 ? (active ? 'bg-red-400'     : 'bg-gray-700/50')
                    : threshold > 55 ? (active ? 'bg-yellow-400'  : 'bg-gray-700/50')
                    :                  (active ? 'bg-emerald-400' : 'bg-gray-700/50');
        return (
          <div
            key={i}
            className={`flex-1 rounded-full transition-all duration-75 ${color}`}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

// ── Icon components ───────────────────────────────────────────────────────────

const CameraIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
);

const MicIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-gray-500">
    <path d="M7 10l5 5 5-5z"/>
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/>
  </svg>
);

// ── DeviceSelect — icon-prefixed select wrapper ───────────────────────────────

function DeviceSelect({ icon: Icon, label, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-gray-400 text-xs font-medium uppercase tracking-wider">
        <Icon size={12} />
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-gray-800/80 border border-white/8
                     text-white text-sm rounded-xl px-3 pr-8 py-2.5
                     focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20
                     transition-all duration-150 cursor-pointer"
        >
          {options.map(d => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `${label} ${d.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronIcon />
        </div>
      </div>
    </div>
  );
}

// ── StatusPill ────────────────────────────────────────────────────────────────

function StatusPill({ icon: Icon, label, active, loading }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
                     border transition-all duration-300
                     ${loading
                       ? 'bg-gray-800/50 border-white/6 text-gray-500'
                       : active
                         ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                         : 'bg-red-500/10 border-red-500/25 text-red-400'}`}>
      <Icon size={12} />
      {label}
      <span className={`w-1.5 h-1.5 rounded-full ml-0.5 ${
        loading ? 'bg-gray-600 animate-pulse'
        : active ? 'bg-emerald-400' : 'bg-red-400'
      }`} />
    </div>
  );
}

// ── Friendly error message ────────────────────────────────────────────────────

function friendlyError(msg = '') {
  if (/denied|not allowed|permission/i.test(msg))
    return 'Camera or microphone access was denied. Allow access in your browser settings and try again.';
  if (/not found|could not start|no device/i.test(msg))
    return 'No camera or microphone detected. Plug one in and try again.';
  if (/in use|readable/i.test(msg))
    return 'Your camera or microphone is in use by another app. Close it and try again.';
  return msg || 'Could not access camera or microphone.';
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DeviceCheck({ roomId, localName, onJoin }) {
  const [cameras, setCameras]                   = useState([]);
  const [microphones, setMicrophones]           = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId]       = useState('');
  const [micLevel, setMicLevel]     = useState(0);
  const [loading, setLoading]       = useState(true);
  const [hasCameraStream, setHasCameraStream] = useState(false);
  const [hasMicStream, setHasMicStream]       = useState(false);
  const [cameraError, setCameraError]         = useState(null);

  const videoRef       = useRef(null);
  const videoStreamRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioCtxRef    = useRef(null);
  const animRef        = useRef(null);

  const stopAll = () => {
    cancelAnimationFrame(animRef.current);
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    audioStreamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current = null;
    audioStreamRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
  };

  const startPreview = async (cameraId, micId) => {
    stopAll();
    setLoading(true);
    setHasCameraStream(false);
    setHasMicStream(false);
    setCameraError(null);

    const [videoResult, audioResult] = await Promise.allSettled([
      navigator.mediaDevices.getUserMedia({
        video: cameraId
          ? { deviceId: { exact: cameraId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { width: { ideal: 1280 }, height: { ideal: 720 } },
      }),
      navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true,
      }),
    ]);

    const videoStream = videoResult.status === 'fulfilled' ? videoResult.value : null;
    const audioStream = audioResult.status === 'fulfilled' ? audioResult.value : null;

    videoStreamRef.current = videoStream;
    audioStreamRef.current = audioStream;

    if (videoRef.current) videoRef.current.srcObject = videoStream ?? null;

    const vt = videoStream?.getVideoTracks()[0];
    const at = audioStream?.getAudioTracks()[0];
    if (vt?.getSettings().deviceId) setSelectedCameraId(vt.getSettings().deviceId);
    if (at?.getSettings().deviceId) setSelectedMicId(at.getSettings().deviceId);

    const devices = await navigator.mediaDevices.enumerateDevices();
    setCameras(devices.filter(d => d.kind === 'videoinput'));
    setMicrophones(devices.filter(d => d.kind === 'audioinput'));

    setHasCameraStream(!!videoStream);
    setHasMicStream(!!audioStream);
    setCameraError(videoStream ? null : videoResult.reason?.message ?? 'Camera unavailable');
    setLoading(false);

    if (at) {
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
    }
  };

  useEffect(() => {
    startPreview(null, null);
    return stopAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ready = !loading && (hasCameraStream || hasMicStream);

  const handleJoin = () => {
    stopAll();
    onJoin({ cameraId: selectedCameraId, micId: selectedMicId });
  };

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 bg-dot-grid flex flex-col items-center
                    justify-center px-4 py-8 relative overflow-hidden">

      {/* Background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px]
                      bg-blue-600/6 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px]
                      bg-indigo-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 relative z-10">
        <p className="text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-2">Callspace</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Ready to join?</h1>
        <p className="text-gray-500 text-sm mt-1.5">Check your camera and microphone before entering</p>
      </div>

      {/* Two-column card */}
      <div className="w-full max-w-3xl relative z-10 grid md:grid-cols-[1fr_300px] gap-4">

        {/* ── Left: Camera preview ── */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-900/80
                        aspect-video ring-1 ring-white/8 shadow-2xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: 'scaleX(-1)' }}
          />

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 gap-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-500 text-xs">Accessing devices…</p>
            </div>
          )}

          {/* No-camera overlay (shown after loading if camera failed) */}
          {!loading && !hasCameraStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center
                            bg-gray-950 gap-3 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-800 border border-white/8
                              flex items-center justify-center text-2xl shrink-0">
                📷
              </div>
              <p className="text-gray-400 text-sm font-medium">No camera detected</p>
              <p className="text-gray-600 text-xs leading-relaxed">{friendlyError(cameraError)}</p>
              <button
                onClick={() => startPreview(null, null)}
                className="mt-1 px-4 py-1.5 bg-white/8 hover:bg-white/14 border border-white/10
                           text-gray-300 rounded-lg text-xs font-medium transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {/* Live badge */}
          {hasCameraStream && (
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1
                            rounded-full bg-black/60 backdrop-blur-sm border border-white/8">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white text-[11px] font-medium tracking-wide">LIVE</span>
            </div>
          )}

          {/* Name badge */}
          {localName && hasCameraStream && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full
                            bg-black/60 backdrop-blur-sm border border-white/8
                            text-white text-xs font-medium">
              {localName}
            </div>
          )}

          {/* Room badge overlay */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5
                          px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/8">
            <span className="text-gray-400 text-[10px]">Room</span>
            <span className="font-mono text-white text-[11px] tracking-widest font-semibold">
              {roomId}
            </span>
          </div>
        </div>

        {/* ── Right: Controls panel ── */}
        <div className="flex flex-col gap-4">

          {/* Status indicators */}
          <div className="bg-gray-900/60 backdrop-blur rounded-2xl p-4
                          border border-white/6 space-y-3">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">
              Device status
            </p>
            <div className="flex flex-wrap gap-2">
              <StatusPill
                icon={CameraIcon}
                label="Camera"
                active={hasCameraStream}
                loading={loading}
              />
              <StatusPill
                icon={MicIcon}
                label="Microphone"
                active={hasMicStream && micLevel > 0.5}
                loading={loading}
              />
            </div>

            {/* Mic visualizer */}
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-[10px] uppercase tracking-wider">Mic level</span>
                <span className="text-gray-600 text-[10px] tabular-nums font-mono">
                  {Math.round(micLevel)}%
                </span>
              </div>
              <MicVisualizer level={micLevel} />
            </div>
          </div>

          {/* Device selectors */}
          <div className="bg-gray-900/60 backdrop-blur rounded-2xl p-4
                          border border-white/6 space-y-3 flex-1">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-widest">
              Select devices
            </p>

            {cameras.length > 0 && (
              <DeviceSelect
                icon={CameraIcon}
                label="Camera"
                value={selectedCameraId}
                options={cameras}
                onChange={id => startPreview(id, selectedMicId)}
              />
            )}

            {microphones.length > 0 && (
              <DeviceSelect
                icon={MicIcon}
                label="Microphone"
                value={selectedMicId}
                options={microphones}
                onChange={id => startPreview(selectedCameraId, id)}
              />
            )}
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={!ready}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6
                       bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
                       disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-semibold rounded-xl transition-all duration-150
                       shadow-lg shadow-blue-900/40 text-sm"
          >
            Join Room
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
