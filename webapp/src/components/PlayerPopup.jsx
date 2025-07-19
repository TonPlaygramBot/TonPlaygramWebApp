import { useState } from 'react';
import { createPortal } from 'react-dom';
import { sendFriendRequest } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import GiftPopup from './GiftPopup.jsx';

export default function PlayerPopup({ open, onClose, player }) {
  const [giftOpen, setGiftOpen] = useState(false);
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
        className="bg-surface border border-border rounded p-4 space-y-2 w-60 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        <img
          src={player.photoUrl}
          alt="user"
          className="w-20 h-20 rounded-full mx-auto"
        />
        <p className="text-center font-semibold">{player.name}</p>
        <div className="flex space-x-2">
          <button
            className="flex-1 px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            onClick={handleAdd}
          >
            Add Friend
          </button>
          <button
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            onClick={() => setGiftOpen(true)}
          >
            🎁
          </button>
        </div>
      </div>
      <GiftPopup
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        recipient={player}
      />
    </div>,
    document.body
  );
}
