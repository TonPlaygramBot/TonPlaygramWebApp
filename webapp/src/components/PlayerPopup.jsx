import { createPortal } from 'react-dom';
import { sendFriendRequest } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function PlayerPopup({ open, onClose, player }) {
  if (!open || !player) return null;
  const handleAdd = async () => {
    try {
      await sendFriendRequest(getTelegramId(), player.telegramId || player.id);
      alert('Friend request sent');
    } catch {
      alert('Failed to send request');
    }
    onClose();
  };
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded p-4 space-y-2 w-60"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={player.photoUrl} alt="user" className="w-20 h-20 rounded-full mx-auto" />
        <p className="text-center font-semibold">{player.name}</p>
        <button
          className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
          onClick={handleAdd}
        >
          Add Friend
        </button>
      </div>
    </div>,
    document.body,
  );
}
