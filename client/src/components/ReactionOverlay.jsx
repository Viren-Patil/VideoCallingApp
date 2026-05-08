export default function ReactionOverlay({ reactions }) {
  if (!reactions.length) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden">
      {reactions.map(({ id, emoji, x }) => (
        <span
          key={id}
          className="reaction-emoji"
          style={{ left: `${x}%`, bottom: '14%' }}
        >
          {emoji}
        </span>
      ))}
    </div>
  );
}
