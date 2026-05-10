import { useRef, useState, useCallback, useEffect } from 'react';
import VideoTile from './VideoTile';

const MIN_W = 120, MIN_H = 90;
const MAX_W = 480, MAX_H = 360;
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

function ResizeGrip() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="rgba(255,255,255,0.55)">
      <circle cx="8.5" cy="8.5" r="1.2"/>
      <circle cx="4.5" cy="8.5" r="1.2"/>
      <circle cx="8.5" cy="4.5" r="1.2"/>
    </svg>
  );
}

export default function DraggablePiP({
  stream, label, showPlaceholder = false, showMuteIndicator = false,
  muted = true, mirror = false,
  initialW = 176, initialH = 128,
  initialX, initialY,
}) {
  const [size, setSize] = useState({ w: initialW, h: initialH });
  const [pos, setPos] = useState(() => ({
    x: initialX ?? window.innerWidth  - initialW - 16,
    y: initialY ?? window.innerHeight - initialH - 80,
  }));

  const posRef      = useRef(pos);
  const sizeRef     = useRef(size);
  const dragging    = useRef(false);
  const resizing    = useRef(false);
  const dragOff     = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, w: 0, h: 0 });

  const updatePos  = (p) => { posRef.current  = p; setPos(p); };
  const updateSize = (s) => { sizeRef.current = s; setSize(s); };

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    dragOff.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    dragging.current = true;
    dragOff.current = { x: t.clientX - posRef.current.x, y: t.clientY - posRef.current.y };
  };

  // ── Resize handlers ────────────────────────────────────────────────────────
  const onResizeMouseDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    resizing.current = true;
    resizeStart.current = { mx: e.clientX, my: e.clientY, w: sizeRef.current.w, h: sizeRef.current.h };
  };

  const onResizeTouchStart = (e) => {
    e.stopPropagation();
    resizing.current = true;
    const t = e.touches[0];
    resizeStart.current = { mx: t.clientX, my: t.clientY, w: sizeRef.current.w, h: sizeRef.current.h };
  };

  // ── Shared move / end ──────────────────────────────────────────────────────
  const onMouseMove = useCallback((e) => {
    if (resizing.current) {
      const dx = e.clientX - resizeStart.current.mx;
      const dy = e.clientY - resizeStart.current.my;
      updateSize({
        w: clamp(resizeStart.current.w + dx, MIN_W, MAX_W),
        h: clamp(resizeStart.current.h + dy, MIN_H, MAX_H),
      });
      return;
    }
    if (!dragging.current) return;
    updatePos({
      x: clamp(e.clientX - dragOff.current.x, 0, window.innerWidth  - sizeRef.current.w),
      y: clamp(e.clientY - dragOff.current.y, 0, window.innerHeight - sizeRef.current.h),
    });
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!dragging.current && !resizing.current) return;
    e.preventDefault();
    const t = e.touches[0];
    if (resizing.current) {
      const dx = t.clientX - resizeStart.current.mx;
      const dy = t.clientY - resizeStart.current.my;
      updateSize({
        w: clamp(resizeStart.current.w + dx, MIN_W, MAX_W),
        h: clamp(resizeStart.current.h + dy, MIN_H, MAX_H),
      });
      return;
    }
    updatePos({
      x: clamp(t.clientX - dragOff.current.x, 0, window.innerWidth  - sizeRef.current.w),
      y: clamp(t.clientY - dragOff.current.y, 0, window.innerHeight - sizeRef.current.h),
    });
  }, []);

  const onEnd = useCallback(() => { dragging.current = false; resizing.current = false; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onEnd);
    };
  }, [onMouseMove, onEnd]);

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onEnd}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
      className="fixed z-50 rounded-xl overflow-hidden ring-2 ring-gray-700 shadow-2xl
                 cursor-grab active:cursor-grabbing select-none touch-none"
    >
      <VideoTile
        stream={stream} muted={muted} label={label}
        showPlaceholder={showPlaceholder} showMuteIndicator={showMuteIndicator}
        mirror={mirror} className="w-full h-full"
      />

      {/* Diagonal resize handle — bottom-right corner */}
      <div
        onMouseDown={onResizeMouseDown}
        onTouchStart={onResizeTouchStart}
        className="absolute bottom-1 right-1 w-6 h-6 flex items-center justify-center
                   cursor-se-resize rounded z-10"
        style={{ touchAction: 'none' }}
      >
        <ResizeGrip />
      </div>
    </div>
  );
}
