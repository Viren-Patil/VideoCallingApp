import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function RoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room');

  // Redirect home if no room id in URL
  useEffect(() => {
    if (!roomId) navigate('/');
  }, [roomId, navigate]);

  if (!roomId) return null;

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-400 text-lg">Setting up room <span className="text-white font-mono font-bold">{roomId}</span>…</p>
        <p className="text-gray-600 text-sm">WebRTC coming in Phase 2</p>
      </div>
    </div>
  );
}
