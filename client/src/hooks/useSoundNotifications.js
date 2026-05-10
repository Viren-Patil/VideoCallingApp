import { useRef, useCallback, useEffect } from 'react';

export function useSoundNotifications() {
  const ctxRef = useRef(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return ctxRef.current;
  }, []);

  // Unlock AudioContext on first user gesture (iOS/Android require this)
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();
      } catch { /* ignore */ }
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [getCtx]);

  const playTone = useCallback((frequency, duration, volume = 0.2) => {
    try {
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch { /* silently fail */ }
  }, [getCtx]);

  // Ascending two-tone chime (C5 → E5)
  const playJoin = useCallback(() => {
    playTone(523, 0.15, 0.2);
    setTimeout(() => playTone(659, 0.2, 0.15), 160);
  }, [playTone]);

  // Descending two-tone chime (E5 → C5)
  const playLeave = useCallback(() => {
    playTone(659, 0.15, 0.2);
    setTimeout(() => playTone(523, 0.2, 0.15), 160);
  }, [playTone]);

  // Soft single ding (C6)
  const playChatMessage = useCallback(() => {
    playTone(1047, 0.12, 0.12);
  }, [playTone]);

  return { playJoin, playLeave, playChatMessage };
}
