export default function DeviceSelector({ devices, selectedId, onSelect, label }) {
  if (!devices || devices.length <= 1) return null;

  return (
    <div className="flex flex-col items-start gap-0.5">
      <span className="text-gray-500 text-[10px] uppercase tracking-wider">{label}</span>
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="text-xs text-gray-200 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1
                   focus:outline-none focus:border-blue-500 cursor-pointer max-w-[160px] truncate"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || `Device ${d.deviceId.slice(0, 6)}`}
          </option>
        ))}
      </select>
    </div>
  );
}
