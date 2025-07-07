import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getTelegramId } from '../utils/telegram.js';
import { sendGift } from '../utils/api.js';
import { GIFTS } from '../utils/gifts.js';

export default function GiftPopup({ open, onClose, players = [] }) {
  const [selected, setSelected] = useState(GIFTS[0]);
  const [target, setTarget] = useState(players[0]?.index || 0);
  if (!open) return null;
  const recipient = players.find((p) => p.index === target);

  const handleSend = async () => {
    if (!recipient) return;
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
        <p className="text-center font-semibold mb-2">Send Gift</p>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {players.map((p) => (
            <button
              key={p.index}
              onClick={() => setTarget(p.index)}
              className={`w-full flex items-center space-x-2 border border-border rounded px-1 py-0.5 text-sm ${target === p.index ? 'bg-accent' : ''}`}
            >
              <img src={p.photoUrl} className="w-6 h-6 rounded-full" />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
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
                  <span className="flex items-center space-x-0.5">
                    <span>{g.price}</span>
                    <img src="/assets/icons/TPCcoin_1.webp" className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="text-xs text-center mt-2 flex items-center justify-center space-x-1">
          <span>Cost:</span>
          <span>{selected.price}</span>
          <img src="/assets/icons/TPCcoin_1.webp" className="w-3 h-3" />
        </div>
        <button className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black" onClick={handleSend}>
          Send {selected.icon} {selected.name}
        </button>
      </div>
    </div>,
    document.body,
  );
}
