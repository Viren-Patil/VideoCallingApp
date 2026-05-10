import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useReactions } from '../hooks/useReactions';
import { useCallTimer } from '../hooks/useCallTimer';
import { useChat } from '../hooks/useChat';
import VideoTile from '../components/VideoTile';
import DraggablePiP from '../components/DraggablePiP';
import CallControls from '../components/CallControls';
import ReactionOverlay from '../components/ReactionOverlay';
import ChatPanel from '../components/ChatPanel';

// ── Shared helpers ────────────────────────────────────────────────────────────

const STATE_LABEL = {
  new:          { text: 'Initialising…',    dot: 'bg-yellow-400 animate-pulse' },
  connecting:   { text: 'Connecting…',      dot: 'bg-yellow-400 animate-pulse' },
  connected:    { text: 'Connected',         dot: 'bg-green-400'                },
  disconnected: { text: 'Reconnecting…',    dot: 'bg-red-400 animate-pulse'    },
  failed:       { text: 'Connection failed', dot: 'bg-red-400'                  },
  closed:       { text: 'Disconnected',      dot: 'bg-gray-500'                 },
};

function SignalBars({ quality }) {
  if (!quality) return null;
  const configs = {
    good: ['bg-green-400',  'bg-green-400',  'bg-green-400'],
    fair: ['bg-yellow-400', 'bg-yellow-400', 'bg-gray-600'],
    poor: ['bg-red-400',    'bg-gray-600',   'bg-gray-600'],
  };
  const bars = configs[quality] ?? ['bg-gray-600', 'bg-gray-600', 'bg-gray-600'];
  return (
    <div className="flex items-end gap-0.5 h-3.5 mr-1">
      <div className={`w-1 h-1.5 rounded-[1px] ${bars[0]}`} />
      <div className={`w-1 h-2.5 rounded-[1px] ${bars[1]}`} />
      <div className={`w-1 h-3.5 rounded-[1px] ${bars[2]}`} />
    </div>
  );
}

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

// ── Name gate — shown when joining via a direct link with no name stored ──────

function NameGate({ roomId, onJoin }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleJoin = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Please enter your name to continue.'); return; }
    onJoin(trimmed);
  };

  return (
    <div className="min-h-screen bg-gray-950 bg-dot-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[500px] h-[300px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm relative z-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">Callspace</h1>
          <p className="text-gray-500 text-sm">You've been invited to a call</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 space-y-5
                        border border-white/8 shadow-2xl">

          {/* Room code badge */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-gray-500 text-xs">Room</span>
            <span className="font-mono text-white text-sm tracking-[0.25em] bg-gray-800/80
                             border border-white/8 px-3 py-1 rounded-lg">
              {roomId}
            </span>
          </div>

          <div className="h-px bg-white/8" />

          {/* Name input */}
          <div className="space-y-2">
            <label className="block text-gray-400 text-sm font-medium">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. Alex"
              maxLength={30}
              autoFocus
              className="w-full px-4 py-3 bg-gray-800/80 border border-white/8
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 focus:outline-none
                         rounded-xl text-white placeholder-gray-600 text-sm
                         transition-all duration-150"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
          </div>

          <button
            onClick={handleJoin}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98]
                       text-white font-semibold rounded-xl transition-all duration-150
                       shadow-lg shadow-blue-900/40"
          >
            Join call
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Call room — all hooks live here, only mounted after name is confirmed ─────

function CallRoom({ roomId, localName }) {
  const navigate = useNavigate();

  const {
    localStream, remoteStream, connectionState, peerJoined, mediaError,
    remotePeerName, connectionQuality,
    isAudioMuted, isVideoOff, isRemoteVideoOff, isRemoteAudioMuted, isScreenSharing,
    toggleAudio, toggleVideo,
    cameras, microphones, selectedCameraId, selectedMicId,
    switchCamera, switchMicrophone,
    startScreenShare, stopScreenShare,
    leaveCall,
  } = useWebRTC(roomId, localName);

  const { activeReactions, sendReaction } = useReactions();
  const callTimer = useCallTimer(connectionState);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const remoteVideoRef = useRef(null);

  const { messages, unreadCount, sendMessage, clearUnread } = useChat(localName, chatOpen);

  const toggleChat = useCallback(() => {
    setChatOpen(v => {
      if (!v) clearUnread();
      return !v;
    });
  }, [clearUnread]);

  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await remoteVideoRef.current?.requestPiP();
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  }, []);

  // Keyboard shortcuts: M = mute, V = video, S = screen share
  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'm' || e.key === 'M') toggleAudio();
      else if (e.key === 'v' || e.key === 'V') toggleVideo();
      else if ((e.key === 's' || e.key === 'S') && typeof navigator.mediaDevices?.getDisplayMedia === 'function') {
        if (isScreenSharing) stopScreenShare();
        else startScreenShare();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleAudio, toggleVideo, isScreenSharing, startScreenShare, stopScreenShare]);

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
    <div className="bg-gray-950 flex flex-col overflow-hidden" style={{ height: 'var(--app-height, 100dvh)' }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2
                      bg-black/40 backdrop-blur-xl border-b border-white/5 z-10">
        <div className="flex items-center gap-2">
          <span className="hidden sm:block text-gray-500 font-mono text-xs tracking-[0.2em] uppercase">{roomId}</span>
          <CopyLinkButton roomId={roomId} />
        </div>

        {callTimer && (
          <span className="absolute left-1/2 -translate-x-1/2 text-gray-300 text-sm font-mono tabular-nums">
            {callTimer}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          <SignalBars quality={connectionQuality} />
          <span className={`w-1.5 h-1.5 rounded-full ${stateInfo.dot}`} />
          <span className="hidden sm:block text-gray-500 text-xs">{stateInfo.text}</span>
        </div>
      </div>

      {/* Video area + desktop chat panel */}
      <div className="relative flex-1 overflow-hidden flex min-h-0">

        {/* Main video */}
        <div className="relative flex-1 overflow-hidden bg-gray-950">
          {remoteStream ? (
            <VideoTile
              ref={remoteVideoRef}
              stream={remoteStream}
              muted={false}
              label={remotePeerName || undefined}
              showPlaceholder={isRemoteVideoOff}
              showMuteIndicator={isRemoteAudioMuted}
              objectFit="contain"
              className="w-full h-full"
            />
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

        {/* Desktop chat — always in DOM, animates width so video shrinks smoothly */}
        <div
          className="hidden sm:block overflow-hidden shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: chatOpen ? '300px' : '0px' }}
        >
          <div className="w-[300px] h-full border-l border-white/[0.06]">
            <ChatPanel
              messages={messages}
              onSendMessage={sendMessage}
              onClose={() => setChatOpen(false)}
            />
          </div>
        </div>
      </div>

      {/* Mobile chat — fixed bottom sheet, slides up over the video */}
      <div
        className={`sm:hidden fixed inset-x-0 bottom-0 z-[56] rounded-t-3xl overflow-hidden
                    transition-transform duration-300 ease-out
                    ${chatOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ height: '70%' }}
      >
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* Mobile backdrop */}
      <div
        className={`sm:hidden fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm
                    transition-opacity duration-300
                    ${chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setChatOpen(false)}
      />

      {/* Floating reaction emojis */}
      <ReactionOverlay reactions={activeReactions} />

      {/* Draggable local PiP */}
      <DraggablePiP
        stream={localStream}
        label={isScreenSharing ? 'Sharing' : (localName || 'You')}
        showPlaceholder={isVideoOff}
        showMuteIndicator={isAudioMuted}
      />

      {/* Control bar */}
      <CallControls
        isAudioMuted={isAudioMuted}        onToggleAudio={toggleAudio}
        microphones={microphones}           selectedMicId={selectedMicId}       onSwitchMic={switchMicrophone}
        isVideoOff={isVideoOff}             onToggleVideo={toggleVideo}
        cameras={cameras}                   selectedCameraId={selectedCameraId}  onSwitchCamera={switchCamera}
        isScreenSharing={isScreenSharing}   onStartScreenShare={startScreenShare} onStopScreenShare={stopScreenShare}
        onReact={sendReaction}
        chatUnread={chatOpen ? 0 : unreadCount}
        onToggleChat={toggleChat}
        onTogglePiP={togglePiP}
        onLeave={() => setConfirmLeave(true)}
      />

      {/* Leave confirmation modal */}
      {confirmLeave && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl p-6 w-80 space-y-4">
            <p className="text-white font-semibold text-lg text-center">Leave call?</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmLeave(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/14 border border-white/10
                           text-gray-200 font-medium text-sm transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={leaveCall}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500
                           text-white font-semibold text-sm transition-all duration-150"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RoomPage — gates on name, then mounts CallRoom ───────────────────────────

export default function RoomPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const roomId = searchParams.get('room');

  const [localName, setLocalName] = useState(sessionStorage.getItem('callspaceName') || '');
  const [nameConfirmed, setNameConfirmed] = useState(!!sessionStorage.getItem('callspaceName'));

  useEffect(() => { if (!roomId) navigate('/'); }, [roomId, navigate]);
  if (!roomId) return null;

  if (!nameConfirmed) {
    return (
      <NameGate
        roomId={roomId}
        onJoin={(name) => {
          sessionStorage.setItem('callspaceName', name);
          setLocalName(name);
          setNameConfirmed(true);
        }}
      />
    );
  }

  return <CallRoom roomId={roomId} localName={localName} />;
}
