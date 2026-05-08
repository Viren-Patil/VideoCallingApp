import { useEffect, useRef } from 'react';

export default function VideoTile({ stream, muted = false, label, className = '', showPlaceholder = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream ?? null;
    videoRef.current.muted = muted;
  }, [stream, muted]);

  const noVideo = !stream || showPlaceholder;

  return (
    <div className={`relative bg-gray-900 overflow-hidden ${className}`}>
      {/* Video element — hidden (opacity-0) when placeholder is shown so it keeps decoding */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-300 ${noVideo ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* Placeholder — shown when stream is absent or video is toggled off */}
      {noVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center
                        bg-gradient-to-br from-gray-800 to-gray-900">
          <div className="w-16 h-16 rounded-full bg-gray-700 border-2 border-gray-600/60
                          flex items-center justify-center text-3xl select-none">
            👤
          </div>
          {showPlaceholder && label && (
            <p className="mt-2 text-gray-500 text-xs">{label} turned off camera</p>
          )}
        </div>
      )}

      {/* Label badge */}
      {label && !noVideo && (
        <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">
          {label}
        </span>
      )}
    </div>
  );
}
