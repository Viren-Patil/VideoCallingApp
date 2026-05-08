import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function HomePage() {
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const createRoom = () => {
    const id = generateRoomId();
    navigate(`/room?room=${id}`);
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setError('Enter a valid room code.');
      return;
    }
    navigate(`/room?room=${code}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo / heading */}
        <div className="text-center">
          <div className="text-5xl mb-4">📹</div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Callspace</h1>
          <p className="mt-2 text-gray-400">Crystal-clear 1:1 video calls. No account needed.</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-8 space-y-6 ring-1 ring-gray-800">
          {/* Create room */}
          <button
            onClick={createRoom}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl transition-colors duration-150"
          >
            Create a new room
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-gray-500 text-sm">or join existing</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>

          {/* Join room */}
          <div className="space-y-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              placeholder="Enter room code"
              maxLength={12}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:outline-none rounded-xl text-white placeholder-gray-500 uppercase tracking-widest font-mono transition-colors"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={joinRoom}
              className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-800 text-white font-semibold rounded-xl transition-colors duration-150"
            >
              Join room
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs">
          Peer-to-peer &middot; No recording &middot; No login
        </p>
      </div>
    </div>
  );
}
