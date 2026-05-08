import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import VideoTile from '../components/VideoTile';
import DraggablePiP from '../components/DraggablePiP';
import CallControls from '../components/CallControls';

const STATE_LABEL = {
  new:          { text: 'Initialising…',    color: 'bg-yellow-500' },
  connecting:   { text: 'Connecting…',      color: 'bg-yellow-500' },
  connected:    { text: 'Connected',         color: 'bg-green-500'  },
  disconnected: { text: 'Reconnecting…',    color: 'bg-red-500'    },
  failed:       { text: 'Connection failed', color: 'bg-red-500'    },
  closed:       { text: 'Disconnected',      color: 'bg-gray-500'   },
};

export default function RoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room');

  useEffect(() => {
    if (!roomId) navigate('/');
  }, [roomId, navigate]);

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
  const isPulsing = connectionState === 'new' || connectionState === 'connecting';

  return (
    <div className="h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/80 backdrop-blur-md border-b border-gray-800 z-10">
        <span className="text-white font-mono text-sm tracking-widest">{roomId}</span>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stateInfo.color} ${isPulsing ? 'animate-pulse' : ''}`} />
          <span className="text-gray-400 text-xs">{stateInfo.text}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="relative flex-1 overflow-hidden">
        {remoteStream ? (
          <VideoTile stream={remoteStream} muted={false} label="Peer" className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-300 text-lg font-medium">
                {peerJoined ? 'Establishing connection…' : 'Waiting for someone to join…'}
              </p>
              <p className="text-gray-500 text-sm">
                Share this room code:{' '}
                <span className="text-white font-mono font-bold">{roomId}</span>
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Local PiP — fixed position, draggable, always above the control bar */}
      <DraggablePiP
        stream={localStream}
        label={isScreenSharing ? 'Sharing screen' : 'You'}
      />

      {/* Controls */}
      <CallControls
        isAudioMuted={isAudioMuted}       onToggleAudio={toggleAudio}
        microphones={microphones}          selectedMicId={selectedMicId}      onSwitchMic={switchMicrophone}
        isVideoOff={isVideoOff}            onToggleVideo={toggleVideo}
        cameras={cameras}                  selectedCameraId={selectedCameraId} onSwitchCamera={switchCamera}
        isScreenSharing={isScreenSharing}  onStartScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
        onLeave={leaveCall}
      />
    </div>
  );
}
