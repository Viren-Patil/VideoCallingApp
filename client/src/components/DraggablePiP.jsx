import { useRef, useState, useCallback, useEffect } from 'react';
import VideoTile from './VideoTile';

const PIP_W = 176; // w-44 = 11rem
const PIP_H = 128; // h-32 = 8rem

const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

export default function DraggablePiP({ stream, label, showPlaceholder = false }) {
  // Lazy initialiser so window is available on first render
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - PIP_W - 16,
    y: window.innerHeight - PIP_H - 110, // start above the control bar
  }));

  const posRef   = useRef(pos);
  const dragging = useRef(false);
  const offset   = useRef({ x: 0, y: 0 });

  // Keep posRef in sync so mousemove handler always reads current coords
  const updatePos = (newPos) => {
    posRef.current = newPos;
    setPos(newPos);
  };

  // ── Mouse events ─────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    offset.current = { x: e.clientX - posRef.current.x, y: e.clientY - posRef.current.y };
  };

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return;
    updatePos({
      x: clamp(e.clientX - offset.current.x, 0, window.innerWidth  - PIP_W),
      y: clamp(e.clientY - offset.current.y, 0, window.innerHeight - PIP_H),
    });
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // ── Touch events ──────────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    const t = e.touches[0];
    dragging.current = true;
    offset.current = { x: t.clientX - posRef.current.x, y: t.clientY - posRef.current.y };
  };

  const onTouchMove = useCallback((e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    updatePos({
      x: clamp(t.clientX - offset.current.x, 0, window.innerWidth  - PIP_W),
      y: clamp(t.clientY - offset.current.y, 0, window.innerHeight - PIP_H),
    });
  }, []);

  const onTouchEnd = useCallback(() => { dragging.current = false; }, []);

  // Attach move/up listeners to window so drag works even if cursor leaves the element
  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ left: pos.x, top: pos.y, width: PIP_W, height: PIP_H }}
      className="fixed z-50 rounded-xl overflow-hidden ring-2 ring-gray-700 shadow-2xl
                 cursor-grab active:cursor-grabbing select-none touch-none"
    >
      <VideoTile stream={stream} muted={true} label={label} showPlaceholder={showPlaceholder} className="w-full h-full" />
    </div>
  );
}
