import { useState, useCallback, useEffect, useRef } from 'react';
import { socket } from '../lib/socket';

export function useChat(localName, isChatOpen = false, onNewMessage = null) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const onNewMessageRef = useRef(onNewMessage);
  useEffect(() => { onNewMessageRef.current = onNewMessage; }, [onNewMessage]);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;
    const msg = {
      id: crypto.randomUUID(),
      text: text.trim(),
      senderName: localName || 'You',
      fromSelf: true,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    socket.emit('chat-message', { text: text.trim(), senderName: localName || 'You' });
  }, [localName]);

  const clearUnread = useCallback(() => setUnreadCount(0), []);

  useEffect(() => {
    const handler = ({ text, senderName }) => {
      const msg = {
        id: crypto.randomUUID(),
        text,
        senderName: senderName || 'Guest',
        fromSelf: false,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, msg]);
      if (!isChatOpen) setUnreadCount(prev => prev + 1);
      onNewMessageRef.current?.();
    };
    socket.on('chat-message', handler);
    return () => socket.off('chat-message', handler);
  }, [isChatOpen]);

  return { messages, unreadCount, sendMessage, clearUnread };
}
