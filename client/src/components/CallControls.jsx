import { useState } from 'react';
import DeviceSelector from './DeviceSelector';

function ControlButton({ onClick, active, activeClass, inactiveClass, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-13 h-13 w-12 h-12 flex items-center justify-center rounded-full text-xl
                  transition-colors duration-150 shadow-md
                  ${active ? activeClass : inactiveClass}`}
    >
      {children}
    </button>
  );
}

export default function CallControls({
  // Audio
  isAudioMuted, onToggleAudio,
  microphones, selectedMicId, onSwitchMic,
  // Video
  isVideoOff, onToggleVideo,
  cameras, selectedCameraId, onSwitchCamera,
  // Screen share
  isScreenSharing, onStartScreenShare, onStopScreenShare,
  // Leave
  onLeave,
}) {
  const [showAudioPrompt, setShowAudioPrompt] = useState(false);

  const handleScreenShareClick = () => {
    if (isScreenSharing) {
      onStopScreenShare();
    } else {
      setShowAudioPrompt(true);
    }
  };

  return (
    <>
      {/* Screen share audio prompt */}
      {showAudioPrompt && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl p-6 space-y-4 w-72 ring-1 ring-gray-700 shadow-2xl">
            <h3 className="text-white font-semibold text-base">Share screen audio?</h3>
            <p className="text-gray-400 text-sm">Include system audio in the screen share (Chrome only).</p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowAudioPrompt(false); onStartScreenShare(false); }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Screen only
              </button>
              <button
                onClick={() => { setShowAudioPrompt(false); onStartScreenShare(true); }}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                Screen + Audio
              </button>
            </div>
            <button
              onClick={() => setShowAudioPrompt(false)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end justify-center gap-5 px-6 py-4
                      bg-gray-900/80 backdrop-blur-md border-t border-gray-800">

        {/* Mic section */}
        <div className="flex flex-col items-center gap-1.5">
          <DeviceSelector
            devices={microphones}
            selectedId={selectedMicId}
            onSelect={onSwitchMic}
            label="Mic"
          />
          <ControlButton
            onClick={onToggleAudio}
            active={isAudioMuted}
            activeClass="bg-red-600 hover:bg-red-500 text-white"
            inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
            title={isAudioMuted ? 'Unmute' : 'Mute'}
          >
            {isAudioMuted ? '🔇' : '🎤'}
          </ControlButton>
        </div>

        {/* Camera section */}
        <div className="flex flex-col items-center gap-1.5">
          <DeviceSelector
            devices={cameras}
            selectedId={selectedCameraId}
            onSelect={onSwitchCamera}
            label="Camera"
          />
          <ControlButton
            onClick={onToggleVideo}
            active={isVideoOff}
            activeClass="bg-red-600 hover:bg-red-500 text-white"
            inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
            title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {isVideoOff ? '📷' : '📹'}
          </ControlButton>
        </div>

        {/* Screen share */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-[38px]" /> {/* spacer to align with device selector rows */}
          <ControlButton
            onClick={handleScreenShareClick}
            active={isScreenSharing}
            activeClass="bg-blue-600 hover:bg-blue-500 text-white"
            inactiveClass="bg-gray-700 hover:bg-gray-600 text-white"
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            🖥️
          </ControlButton>
        </div>

        {/* Leave */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="h-[38px]" />
          <button
            onClick={onLeave}
            title="Leave call"
            className="w-12 h-12 flex items-center justify-center rounded-full
                       bg-red-600 hover:bg-red-500 active:bg-red-700
                       text-white text-xl transition-colors duration-150 shadow-lg"
          >
            📵
          </button>
        </div>
      </div>
    </>
  );
}
