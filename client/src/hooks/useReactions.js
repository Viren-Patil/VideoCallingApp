import { useState, useCallback, useEffect } from 'react';
import { socket } from '../lib/socket';

export const REACTIONS = {
  heart:    '❤️',
  thumbsUp: '👍',
  laugh:    '😂',
  cry:      '😢',
  wave:     '👋',
  fire:     '🔥',
};

export function useReactions() {
  const [activeReactions, setActiveReactions] = useState([]);

  const spawnReaction = useCallback((emoji) => {
    const id = crypto.randomUUID();
    const x = 10 + Math.random() * 80; // random horizontal position 10–90%
    setActiveReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setActiveReactions(prev => prev.filter(r => r.id !== id));
    }, 3200);
  }, []);

  const sendReaction = useCallback((key) => {
    spawnReaction(REACTIONS[key]);
    socket.emit('reaction', key);
  }, [spawnReaction]);

  // Listen for reactions from the peer
  useEffect(() => {
    const handler = (key) => spawnReaction(REACTIONS[key] ?? key);
    socket.on('reaction', handler);
    return () => socket.off('reaction', handler);
  }, [spawnReaction]);

  return { activeReactions, sendReaction };
}
