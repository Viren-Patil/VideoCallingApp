import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const FEATURES = [
  { icon: '🎥', label: 'Up to 1080p' },
  { icon: '🔒', label: 'Peer-to-peer' },
  { icon: '⚡', label: 'Low latency' },
  { icon: '🚫', label: 'No login' },
];

function NewRoomCard({ onBack, onEnter }) {
  const [roomId] = useState(() => generateRoomId());
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <p className="text-gray-400 text-sm text-center">Share this code with the person you want to call</p>

      {/* Code display + copy */}
      <div className="flex items-center gap-2 bg-gray-800/80 border border-white/8 rounded-xl px-4 py-3">
        <span className="flex-1 text-white font-mono text-2xl tracking-[0.35em] text-center select-all">
          {roomId}
        </span>
        <button
          onClick={copy}
          title="Copy code"
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                     bg-white/8 hover:bg-white/14 border border-white/10
                     text-gray-300 hover:text-white transition-all duration-150"
        >
          {copied ? '✓ Copied' : '⎘ Copy'}
        </button>
      </div>

      <button
        onClick={() => onEnter(roomId)}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
                   text-white font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-blue-900/40"
      >
        Enter room
      </button>

      <button
        onClick={onBack}
        className="w-full py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
      >
        ← Back
      </button>
    </div>
  );
}

export default function HomePage() {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const navigate = useNavigate();

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters.'); return; }
    navigate(`/room?room=${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 bg-dot-grid flex items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[500px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3
                      w-[300px] h-[200px] bg-indigo-600/8 rounded-full blur-[80px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl
                          bg-blue-600/20 border border-blue-500/30 text-3xl mb-1">
            📹
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Callspace</h1>
          <p className="text-gray-500 text-sm">Crystal-clear 1:1 video calls. No account needed.</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {FEATURES.map(f => (
            <span key={f.label}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full
                         bg-white/5 border border-white/8 text-gray-400 text-xs">
              <span>{f.icon}</span>{f.label}
            </span>
          ))}
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 space-y-5
                        border border-white/8 shadow-2xl">

          {creatingRoom ? (
            <NewRoomCard
              onBack={() => setCreatingRoom(false)}
              onEnter={(id) => navigate(`/room?room=${id}`)}
            />
          ) : (
            <>
              <button
                onClick={() => setCreatingRoom(true)}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
                           text-white font-semibold rounded-xl transition-all duration-150 shadow-lg shadow-blue-900/40"
              >
                Start a new call
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/8" />
                <span className="text-gray-600 text-xs">or join with a code</span>
                <div className="flex-1 h-px bg-white/8" />
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  placeholder="XXXXXX"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-gray-800/80 border border-white/8
                             focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none
                             rounded-xl text-white placeholder-gray-600
                             uppercase tracking-[0.3em] font-mono text-center text-lg
                             transition-all duration-150"
                />
                {error && (
                  <p className="text-red-400 text-xs text-center">{error}</p>
                )}
                <button
                  onClick={joinRoom}
                  className="w-full py-3 px-4 bg-white/8 hover:bg-white/12 active:scale-[0.98]
                             border border-white/8 text-gray-200 font-medium rounded-xl
                             transition-all duration-150"
                >
                  Join call
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs">
          Encrypted · Peer-to-peer · No recording
        </p>
      </div>
    </div>
  );
}
