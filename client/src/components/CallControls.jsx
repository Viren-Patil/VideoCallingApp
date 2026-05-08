import { useState, useRef, useEffect, useCallback } from 'react';

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

// A single round button with an optional small chevron that opens a device picker above it.
function MediaButton({ icon, activeIcon, isActive, activeColor = 'bg-red-600 hover:bg-red-500', onToggle, devices, selectedId, onSelectDevice, tooltip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  const hasOptions = devices?.length > 1;

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <div className="relative">
        {/* Main action button */}
        <button
          onClick={onToggle}
          title={tooltip}
          className={`w-11 h-11 flex items-center justify-center rounded-full text-lg
                      transition-all duration-150 shadow-md select-none
                      ${isActive
                        ? `${activeColor} text-white`
                        : 'bg-white/10 hover:bg-white/20 text-white'}`}
        >
          {isActive ? activeIcon : icon}
        </button>

        {/* Chevron — opens device picker */}
        {hasOptions && (
          <button
            onClick={() => setOpen(v => !v)}
            title={`Choose ${tooltip}`}
            className="absolute -bottom-1 -right-1.5 w-[18px] h-[18px]
                       flex items-center justify-center rounded-full
                       bg-gray-600 hover:bg-gray-500 border border-gray-800
                       text-white transition-colors"
            style={{ fontSize: 9 }}
          >
            {open ? '▼' : '▲'}
          </button>
        )}
      </div>

      {/* Device picker popover */}
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
                            ${isSelected
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-300 hover:bg-gray-800'}`}
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

// Screen share button with its own "Screen only / Screen + Audio" popover.
function ScreenShareButton({ isScreenSharing, onStart, onStop }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => isScreenSharing ? onStop() : setOpen(v => !v)}
        title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        className={`w-11 h-11 flex items-center justify-center rounded-full text-lg
                    transition-all duration-150 shadow-md select-none
                    ${isScreenSharing
                      ? 'bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/40'
                      : 'bg-white/10 hover:bg-white/20 text-white'}`}
      >
        🖥️
      </button>

      {open && !isScreenSharing && (
        <div className="absolute bottom-[calc(100%+12px)] left-1/2 -translate-x-1/2 z-50
                        bg-gray-900 border border-gray-700/60 rounded-2xl shadow-2xl
                        p-2 w-48 backdrop-blur-xl">
          <p className="text-gray-500 text-[10px] uppercase tracking-widest px-2 pt-1 pb-1.5">
            Share screen
          </p>
          <button
            onClick={() => { setOpen(false); onStart(false); }}
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-300
                       hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <span>🖥️</span> Screen only
          </button>
          <button
            onClick={() => { setOpen(false); onStart(true); }}
            className="w-full text-left px-3 py-2 rounded-xl text-sm text-gray-300
                       hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <span>🔊</span> Screen + Audio
          </button>
        </div>
      )}
    </div>
  );
}

export default function CallControls({
  isAudioMuted, onToggleAudio, microphones, selectedMicId, onSwitchMic,
  isVideoOff,   onToggleVideo,  cameras,     selectedCameraId, onSwitchCamera,
  isScreenSharing, onStartScreenShare, onStopScreenShare,
  onLeave,
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-3
                    bg-black/60 backdrop-blur-xl border-t border-white/5">

      <MediaButton
        icon="🎤" activeIcon="🔇"
        isActive={isAudioMuted}
        onToggle={onToggleAudio}
        devices={microphones} selectedId={selectedMicId} onSelectDevice={onSwitchMic}
        tooltip="Microphone"
      />

      <MediaButton
        icon="📹" activeIcon="📷"
        isActive={isVideoOff}
        onToggle={onToggleVideo}
        devices={cameras} selectedId={selectedCameraId} onSelectDevice={onSwitchCamera}
        tooltip="Camera"
      />

      <ScreenShareButton
        isScreenSharing={isScreenSharing}
        onStart={onStartScreenShare}
        onStop={onStopScreenShare}
      />

      {/* Divider */}
      <div className="w-px h-7 bg-white/10 mx-1" />

      {/* Leave */}
      <button
        onClick={onLeave}
        title="Leave call"
        className="w-11 h-11 flex items-center justify-center rounded-full
                   bg-red-600 hover:bg-red-500 active:scale-95
                   text-white text-lg transition-all duration-150 shadow-md"
      >
        📵
      </button>
    </div>
  );
}
