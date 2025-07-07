import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getTelegramId } from '../utils/telegram.js';
import { sendGift } from '../utils/api.js';
import { GIFTS } from '../utils/gifts.js';

export default function GiftPopup({ open, onClose, recipient }) {
  const [selected, setSelected] = useState(GIFTS[0]);
  if (!open || !recipient) return null;

  const handleSend = async () => {
    try {
      await sendGift(getTelegramId(), recipient.telegramId || recipient.id, selected.id);
      alert(`Sent ${selected.name} to ${recipient.name}`);
    } catch {
      alert('Failed to send gift');
    }
    onClose();
  };

  const tiers = [1, 2, 3];
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70" onClick={onClose}>
      <div className="bg-surface border border-border rounded p-4 space-y-2 w-72" onClick={(e) => e.stopPropagation()}>
        <p className="text-center font-semibold mb-2">Send Gift to {recipient.name}</p>
        {tiers.map(tier => (
          <div key={tier} className="space-y-1">
            <p className="text-sm font-bold">Tier {tier}</p>
            <div className="grid grid-cols-2 gap-1">
              {GIFTS.filter(g => g.tier === tier).map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelected(g)}
                  className={`border border-border rounded px-1 py-0.5 text-sm flex items-center justify-center space-x-1 ${selected.id === g.id ? 'bg-accent' : ''}`}
                >
                  <span>{g.icon}</span>
                  <span>{g.price}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="text-xs text-center mt-2">Cost: {selected.price} TPC + 3%</div>
        <button className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black" onClick={handleSend}>
          Send {selected.icon} {selected.name}
        </button>
      </div>
    </div>,
    document.body,
  );
}
