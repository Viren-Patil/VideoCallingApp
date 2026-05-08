import { useEffect, useRef } from 'react';

export default function VideoTile({ stream, muted = false, label, className = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;
    // srcObject must be set via ref — React cannot handle MediaStream as a prop.
    videoRef.current.srcObject = stream ?? null;
    // Ensure muted state is in sync (React's muted prop has a known quirk).
    videoRef.current.muted = muted;
  }, [stream, muted]);

  return (
    <div className={`relative bg-gray-900 overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />
      {/* Show avatar placeholder when stream is absent or video is off */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl">
            👤
          </div>
        </div>
      )}
      {label && (
        <span className="absolute bottom-2 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">
          {label}
        </span>
      )}
    </div>
  );
}
