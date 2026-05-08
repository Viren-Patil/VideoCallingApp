import { useState, useEffect, useRef, useCallback } from 'react';

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ messages, onSendMessage, onClose }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
    inputRef.current?.focus();
  }, [input, onSendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">

      {/* Drag handle — mobile only */}
      <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
        <div className="w-9 h-1 rounded-full bg-gray-700" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0
                      bg-gray-900/60 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600/15 border border-blue-500/25
                          flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Chat</p>
            <p className="text-gray-500 text-[10px] leading-tight">In call</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full
                     text-gray-500 hover:text-white hover:bg-white/10 transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8 select-none">
            <div className="w-14 h-14 rounded-2xl bg-gray-800/80 border border-white/[0.06]
                            flex items-center justify-center mb-3">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#374151">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <p className="text-gray-400 text-sm font-medium">No messages yet</p>
            <p className="text-gray-600 text-xs mt-1">Start the conversation</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const showName = i === 0 || messages[i - 1].fromSelf !== msg.fromSelf;
            return (
              <div key={msg.id} className={`flex flex-col ${msg.fromSelf ? 'items-end' : 'items-start'}`}>
                {showName && (
                  <span className="text-[10px] font-medium text-gray-500 mb-1 px-1">
                    {msg.fromSelf ? 'You' : msg.senderName}
                  </span>
                )}
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words
                                ${msg.fromSelf
                                  ? 'bg-blue-600 text-white rounded-tr-sm shadow-md shadow-blue-900/30'
                                  : 'bg-gray-800/90 text-gray-100 rounded-tl-sm border border-white/[0.06]'}`}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-gray-600 mt-1 px-1">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 shrink-0 border-t border-white/[0.06] bg-gray-900/40">
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl
                        bg-gray-800/80 border border-white/[0.08]
                        focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20
                        transition-all duration-150">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            className="flex-1 bg-transparent text-white text-sm placeholder-gray-600
                       focus:outline-none min-w-0"
          />
          <button
            onClick={send}
            disabled={!input.trim()}
            className={`w-7 h-7 flex items-center justify-center rounded-xl shrink-0
                        transition-all duration-150
                        ${input.trim()
                          ? 'bg-blue-600 hover:bg-blue-500 text-white scale-100'
                          : 'bg-transparent text-gray-600 cursor-default'}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
