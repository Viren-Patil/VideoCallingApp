import { useState, useRef, useEffect, useCallback } from 'react';
import { REACTIONS } from '../hooks/useReactions';

// ── SVG Icons ─────────────────────────────────────────────────────────────────

const MicIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
  </svg>
);

const MicOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
  </svg>
);

const CameraOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/>
  </svg>
);

const ScreenShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v1h12v-1l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
    <path d="M12 6l-4 4h3v4h2v-4h3z"/>
  </svg>
);

const ScreenSharingActiveIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h3l-1 1v1h12v-1l-1-1h3c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 13H4V5h16v11z"/>
    <rect x="5" y="6" width="14" height="9" rx="0.5"/>
  </svg>
);

const SmileIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
    <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/>
    <circle cx="15" cy="9" r="1" fill="currentColor" stroke="none"/>
  </svg>
);

const EndCallIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.1-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.51-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
    <path d="M7 14l5-5 5 5z"/>
  </svg>
);

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
  </svg>
);

const PiPIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.99 2 1.99h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function useClickOutside(ref, onClose) {
  const handler = useCallback(
    (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); },
    [ref, onClose]
  );
  useEffect(() => {
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [handler]);
}

// ── MediaButton ───────────────────────────────────────────────────────────────

function MediaButton({ icon, activeIcon, isActive, activeColor = 'bg-red-600 hover:bg-red-500', onToggle, devices, selectedId, onSelectDevice, tooltip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const hasOptions = devices?.length > 1;

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <div className="relative">
        <button
          onClick={onToggle}
          title={tooltip}
          className={`w-12 h-12 sm:w-11 sm:h-11 flex items-center justify-center rounded-full
                      transition-all duration-150 shadow-md select-none
                      ${isActive
                        ? `${activeColor} text-white`
                        : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isActive ? activeIcon : icon}
        </button>

        {hasOptions && (
          <button
            onClick={() => setOpen(v => !v)}
            title={`Choose ${tooltip}`}
            className="absolute -bottom-1 -right-1.5 w-[18px] h-[18px]
                       flex items-center justify-center rounded-full
                       bg-gray-600 hover:bg-gray-500 border border-gray-800
                       text-white transition-colors"
          >
            <ChevronUpIcon />
          </button>
        )}
      </div>

      {open && hasOptions && (
        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50
                        bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl
                        p-2 w-56 backdrop-blur-xl">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest px-2 pt-1 pb-1.5">
            {tooltip}
          </p>
          {devices.map((d) => {
            const isSelected = selectedId === d.deviceId;
            return (
              <button
                key={d.deviceId}
                onClick={() => { onSelectDevice(d.deviceId); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2
                            transition-colors duration-100
                            ${isSelected ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}
              >
                <span className={`w-3 shrink-0 text-[10px] ${isSelected ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                <span className="truncate">{d.label || `Device ${d.deviceId.slice(0, 8)}`}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ScreenShareButton ─────────────────────────────────────────────────────────

function ScreenShareButton({ isScreenSharing, onStart, onStop }) {
  return (
    <button
      onClick={() => isScreenSharing ? onStop() : onStart()}
      title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      className={`w-11 h-11 flex items-center justify-center rounded-full
                  transition-all duration-150 shadow-md select-none
                  ${isScreenSharing
                    ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/40'
                    : 'bg-white/10 hover:bg-white/20 text-white'}`}
    >
      {isScreenSharing ? <ScreenSharingActiveIcon /> : <ScreenShareIcon />}
    </button>
  );
}

// ── ReactionButton ────────────────────────────────────────────────────────────

const REACTION_ENTRIES = Object.entries(REACTIONS);

function ReactionButton({ onReact }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        title="Send a reaction"
        className="w-11 h-11 flex items-center justify-center rounded-full
                   bg-white/10 hover:bg-white/20 text-white transition-all duration-150 shadow-md select-none"
      >
        <SmileIcon />
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50
                        bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl
                        p-2 backdrop-blur-xl w-[220px]">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest px-2 pt-1 pb-2">
            Reactions
          </p>
          <div className="grid grid-cols-5 gap-0.5">
            {REACTION_ENTRIES.map(([key, emoji]) => (
              <button
                key={key}
                onClick={() => { onReact(key); setOpen(false); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-xl
                           hover:bg-white/10 active:scale-90 transition-all duration-100"
                title={key}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── CallControls ──────────────────────────────────────────────────────────────

export default function CallControls({
  isAudioMuted, onToggleAudio, microphones, selectedMicId, onSwitchMic,
  isVideoOff,   onToggleVideo,  cameras,     selectedCameraId, onSwitchCamera,
  isScreenSharing, onStartScreenShare, onStopScreenShare,
  onReact,
  chatUnread, onToggleChat,
  onTogglePiP,
  onLeave,
}) {
  const canScreenShare = typeof navigator.mediaDevices?.getDisplayMedia === 'function';

  return (
    <div
      className="bg-black/60 backdrop-blur-xl border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* ── Secondary row (mobile only) ── */}
      <div className="flex sm:hidden items-center justify-center gap-4 pt-2.5 px-4">
        {canScreenShare && (
          <ScreenShareButton
            isScreenSharing={isScreenSharing}
            onStart={onStartScreenShare}
            onStop={onStopScreenShare}
          />
        )}

        <ReactionButton onReact={onReact} />

        <div className="relative">
          <button
            onClick={onToggleChat}
            title="Chat"
            className="w-11 h-11 flex items-center justify-center rounded-full
                       bg-white/10 hover:bg-white/20 text-white transition-all duration-150 shadow-md select-none"
          >
            <ChatIcon />
          </button>
          {chatUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center
                             rounded-full bg-blue-500 text-white text-[9px] font-bold pointer-events-none">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </div>

        <button
          onClick={onTogglePiP}
          title="Picture in Picture"
          className="w-11 h-11 flex items-center justify-center rounded-full
                     bg-white/10 hover:bg-white/20 text-white transition-all duration-150 shadow-md select-none"
        >
          <PiPIcon />
        </button>
      </div>

      {/* ── Primary row ── */}
      <div className="flex items-center justify-center gap-3 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3">

        <MediaButton
          icon={<MicIcon />}     activeIcon={<MicOffIcon />}
          isActive={isAudioMuted}
          onToggle={onToggleAudio}
          devices={microphones}  selectedId={selectedMicId}    onSelectDevice={onSwitchMic}
          tooltip="Microphone"
        />

        <MediaButton
          icon={<CameraIcon />}  activeIcon={<CameraOffIcon />}
          isActive={isVideoOff}
          onToggle={onToggleVideo}
          devices={cameras}      selectedId={selectedCameraId} onSelectDevice={onSwitchCamera}
          tooltip="Camera"
        />

        {/* Desktop-only secondary controls — hidden on mobile (shown in secondary row above) */}
        <div className="hidden sm:flex items-center gap-3">
          {canScreenShare && (
            <ScreenShareButton
              isScreenSharing={isScreenSharing}
              onStart={onStartScreenShare}
              onStop={onStopScreenShare}
            />
          )}

          <ReactionButton onReact={onReact} />

          <div className="relative">
            <button
              onClick={onToggleChat}
              title="Chat"
              className="w-11 h-11 flex items-center justify-center rounded-full
                         bg-white/10 hover:bg-white/20 text-white transition-all duration-150 shadow-md select-none"
            >
              <ChatIcon />
            </button>
            {chatUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center
                               rounded-full bg-blue-500 text-white text-[9px] font-bold pointer-events-none">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </div>

          <button
            onClick={onTogglePiP}
            title="Picture in Picture"
            className="w-11 h-11 flex items-center justify-center rounded-full
                       bg-white/10 hover:bg-white/20 text-white transition-all duration-150 shadow-md select-none"
          >
            <PiPIcon />
          </button>
        </div>

        <div className="w-px h-7 bg-white/10 mx-1" />

        <button
          onClick={onLeave}
          title="Leave call"
          className="w-12 h-12 sm:w-12 sm:h-11 flex items-center justify-center rounded-full
                     bg-red-600 hover:bg-red-500 active:scale-95
                     text-white transition-all duration-150 shadow-md"
        >
          <EndCallIcon />
        </button>
      </div>
    </div>
  );
}
