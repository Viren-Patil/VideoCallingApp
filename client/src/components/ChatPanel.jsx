import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, onSendMessage, onClose }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  }, [input, onSendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="w-72 flex flex-col bg-gray-900 border-l border-white/8 shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
        <span className="text-white font-medium text-sm">Chat</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded-full
                     text-gray-500 hover:text-white hover:bg-white/10 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-gray-600 text-xs text-center mt-6">No messages yet</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.fromSelf ? 'items-end' : 'items-start'}`}>
            <span className="text-gray-500 text-[10px] mb-0.5 px-1">
              {msg.fromSelf ? 'You' : msg.senderName} · {formatTime(msg.timestamp)}
            </span>
            <div className={`max-w-[200px] px-3 py-2 rounded-2xl text-sm break-words
                            ${msg.fromSelf
                              ? 'bg-blue-600 text-white rounded-tr-sm'
                              : 'bg-gray-800 text-gray-200 rounded-tl-sm'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-white/8 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="flex-1 px-3 py-2 bg-gray-800 border border-white/8 rounded-xl
                     text-white text-sm placeholder-gray-600 focus:outline-none
                     focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all"
        />
        <button
          onClick={send}
          className="w-9 h-9 flex items-center justify-center rounded-xl
                     bg-blue-600 hover:bg-blue-500 text-white transition-colors shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
