import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import DraggablePiP from '../components/DraggablePiP';
import CallControls from '../components/CallControls';

const STATE_LABEL = {
  new:          { text: 'Initialising…',    dot: 'bg-yellow-400 animate-pulse' },
  connecting:   { text: 'Connecting…',      dot: 'bg-yellow-400 animate-pulse' },
  connected:    { text: 'Connected',         dot: 'bg-green-400'                },
  disconnected: { text: 'Reconnecting…',    dot: 'bg-red-400 animate-pulse'    },
  failed:       { text: 'Connection failed', dot: 'bg-red-400'                  },
  closed:       { text: 'Disconnected',      dot: 'bg-gray-500'                 },
};

export default function RoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room');

  useEffect(() => { if (!roomId) navigate('/'); }, [roomId, navigate]);

  const {
    localStream, remoteStream, connectionState, peerJoined, mediaError,
    isAudioMuted, isVideoOff, isScreenSharing,
    toggleAudio, toggleVideo,
    cameras, microphones, selectedCameraId, selectedMicId,
    switchCamera, switchMicrophone,
    startScreenShare, stopScreenShare,
    leaveCall,
  } = useWebRTC(roomId);

  if (!roomId) return null;

  if (mediaError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="text-5xl">🚫</div>
          <h2 className="text-white text-xl font-semibold">Camera / mic access denied</h2>
          <p className="text-gray-400 text-sm">{mediaError}</p>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const stateInfo = STATE_LABEL[connectionState] ?? STATE_LABEL.new;

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">

      {/* Top bar — slim */}
      <div className="flex items-center justify-between px-5 py-2
                      bg-black/40 backdrop-blur-xl border-b border-white/5 z-10">
        <span className="text-gray-400 font-mono text-xs tracking-[0.2em] uppercase">
          {roomId}
        </span>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${stateInfo.dot}`} />
          <span className="text-gray-500 text-xs">{stateInfo.text}</span>
        </div>
      </div>

      {/* Video area — fills all remaining space */}
      <div className="relative flex-1 overflow-hidden bg-gray-950">
        {remoteStream ? (
          <VideoTile
            stream={remoteStream}
            muted={false}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin mx-auto opacity-70" />
              <p className="text-gray-300 text-base font-medium">
                {peerJoined ? 'Establishing connection…' : 'Waiting for someone to join…'}
              </p>
              <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
                <span className="text-gray-500 text-xs">Room code</span>
                <span className="text-white font-mono font-semibold text-sm tracking-widest">{roomId}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Draggable local PiP — fixed, always above everything */}
      <DraggablePiP
        stream={localStream}
        label={isScreenSharing ? 'Sharing' : 'You'}
      />

      {/* Control bar — thin single row */}
      <CallControls
        isAudioMuted={isAudioMuted}        onToggleAudio={toggleAudio}
        microphones={microphones}           selectedMicId={selectedMicId}       onSwitchMic={switchMicrophone}
        isVideoOff={isVideoOff}             onToggleVideo={toggleVideo}
        cameras={cameras}                   selectedCameraId={selectedCameraId}  onSwitchCamera={switchCamera}
        isScreenSharing={isScreenSharing}   onStartScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
        onLeave={leaveCall}
      />
    </div>
  );
}
