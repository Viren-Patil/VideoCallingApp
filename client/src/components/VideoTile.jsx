import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

function MicOffBadge() {
  return (
    <div className="absolute bottom-2 left-2 w-6 h-6 rounded-full bg-red-600/90
                    flex items-center justify-center shadow-lg">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
        <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46L19.73 21 21 19.73 4.27 3z"/>
      </svg>
    </div>
  );
}

const VideoTile = forwardRef(function VideoTile({ stream, muted = false, label, className = '', showPlaceholder = false, objectFit = 'cover', showMuteIndicator = false, mirror = false, volume = 1 }, ref) {
  const videoRef = useRef(null);

  useImperativeHandle(ref, () => ({
    requestPiP: async () => {
      if (videoRef.current && document.pictureInPictureEnabled) {
        return videoRef.current.requestPictureInPicture();
      }
    },
  }));

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
    videoRef.current.muted = muted;
  }, [stream, muted]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  const noVideo = !stream || showPlaceholder;

  return (
    <div className={`relative bg-gray-900 overflow-hidden ${className}`}>
      {/* Video element — hidden (opacity-0) when placeholder is shown so it keeps decoding */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full transition-opacity duration-300 ${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${noVideo ? 'opacity-0' : 'opacity-100'} ${mirror ? 'scale-x-[-1]' : ''}`}
      />

      {/* Placeholder — shown when stream is absent or video is toggled off */}
      {noVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center
                        bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600/60
                          flex items-center justify-center text-3xl select-none">
            👤
          </div>
        </div>
      )}

      {/* Mute indicator */}
      {showMuteIndicator && <MicOffBadge />}

      {/* Label badge — offset right of mute badge if both present */}
      {label && !noVideo && (
        <span className={`absolute bottom-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-full
                         ${showMuteIndicator ? 'left-10' : 'left-2'}`}>
          {label}
        </span>
      )}
    </div>
  );
});

export default VideoTile;
