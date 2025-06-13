import RoomSelector from './RoomSelector.jsx';

export default function RoomPopup({ open, selection, setSelection, onConfirm }) {
  if (!open) return null;
  const disabled = !selection || !selection.token || !selection.amount;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-text">
        <RoomSelector selected={selection || { token: '', amount: 0 }} onSelect={setSelection} />
        <button
          onClick={onConfirm}
          disabled={disabled}
          className={`px-4 py-1 bg-blue-600 text-white rounded w-full disabled:opacity-50`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
