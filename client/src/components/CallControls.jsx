export default function CallControls({ onLeave }) {
  return (
    <div className="flex items-center justify-center gap-4 px-6 py-4
                    bg-gray-900/80 backdrop-blur-md border-t border-gray-800">
      {/* Leave call */}
      <button
        onClick={onLeave}
        title="Leave call"
        className="w-14 h-14 flex items-center justify-center rounded-full
                   bg-red-600 hover:bg-red-500 active:bg-red-700
                   text-white text-2xl transition-colors duration-150 shadow-lg"
      >
        📵
      </button>
    </div>
  );
}
