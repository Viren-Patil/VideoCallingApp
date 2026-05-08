import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useReactions } from '../hooks/useReactions';
import { useCallTimer } from '../hooks/useCallTimer';
import VideoTile from '../components/VideoTile';
import DraggablePiP from '../components/DraggablePiP';
import CallControls from '../components/CallControls';
import ReactionOverlay from '../components/ReactionOverlay';

const STATE_LABEL = {
  new:          { text: 'Initialising…',    dot: 'bg-yellow-400 animate-pulse' },
  connecting:   { text: 'Connecting…',      dot: 'bg-yellow-400 animate-pulse' },
  connected:    { text: 'Connected',         dot: 'bg-green-400'                },
  disconnected: { text: 'Reconnecting…',    dot: 'bg-red-400 animate-pulse'    },
  failed:       { text: 'Connection failed', dot: 'bg-red-400'                  },
  closed:       { text: 'Disconnected',      dot: 'bg-gray-500'                 },
};

function CopyLinkButton({ roomId }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room?room=${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy invite link"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                 bg-white/5 hover:bg-white/10 border border-white/10
                 text-gray-400 hover:text-gray-200 transition-all duration-150"
    >
      {copied ? '✓ Copied' : '🔗 Invite'}
    </button>
  );
}

export default function RoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room');

  useEffect(() => { if (!roomId) navigate('/'); }, [roomId, navigate]);

  const {
    localStream, remoteStream, connectionState, peerJoined, mediaError,
    isAudioMuted, isVideoOff, isRemoteVideoOff, isScreenSharing,
    toggleAudio, toggleVideo,
    cameras, microphones, selectedCameraId, selectedMicId,
    switchCamera, switchMicrophone,
    startScreenShare, stopScreenShare,
    leaveCall,
  } = useWebRTC(roomId);

  const { activeReactions, sendReaction } = useReactions();
  const callTimer = useCallTimer(connectionState);

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

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2
                      bg-black/40 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-mono text-xs tracking-[0.2em] uppercase">{roomId}</span>
          <CopyLinkButton roomId={roomId} />
        </div>

        {/* Centre: call timer */}
        {callTimer && (
          <span className="absolute left-1/2 -translate-x-1/2 text-gray-300 text-sm font-mono tabular-nums">
            {callTimer}
          </span>
        )}

        {/* Right: connection indicator */}
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${stateInfo.dot}`} />
          <span className="text-gray-500 text-xs">{stateInfo.text}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="relative flex-1 overflow-hidden bg-gray-950">
        {remoteStream ? (
          <VideoTile stream={remoteStream} muted={false} showPlaceholder={isRemoteVideoOff} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center space-y-5">
              <div className="relative mx-auto w-16 h-16">
                <div className="absolute inset-0 rounded-full border-[3px] border-blue-500/30 animate-ping" />
                <div className="w-16 h-16 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-2">
                <p className="text-gray-200 text-base font-medium">
                  {peerJoined ? 'Establishing connection…' : 'Waiting for someone to join…'}
                </p>
                <p className="text-gray-500 text-sm">
                  Share your invite link or room code{' '}
                  <span className="text-white font-mono font-semibold tracking-widest">{roomId}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating reaction emojis */}
      <ReactionOverlay reactions={activeReactions} />

      {/* Draggable local PiP */}
      <DraggablePiP stream={localStream} label={isScreenSharing ? 'Sharing' : 'You'} showPlaceholder={isVideoOff} />

      {/* Control bar */}
      <CallControls
        isAudioMuted={isAudioMuted}        onToggleAudio={toggleAudio}
        microphones={microphones}           selectedMicId={selectedMicId}       onSwitchMic={switchMicrophone}
        isVideoOff={isVideoOff}             onToggleVideo={toggleVideo}
        cameras={cameras}                   selectedCameraId={selectedCameraId}  onSwitchCamera={switchCamera}
        isScreenSharing={isScreenSharing}   onStartScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
        onReact={sendReaction}
        onLeave={leaveCall}
      />
    </div>
  );
}
