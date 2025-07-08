import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlayerId } from '../utils/telegram.js';
import { sendGift } from '../utils/api.js';
import { GIFTS } from '../utils/gifts.js';
import {
  giftSound_gift_00,
  giftSound_gift_01,
  giftSound_gift_02,
  giftSound_gift_03,
  giftSound_gift_04,
  giftSound_gift_05,
  giftSound_gift_06,
  giftSound_gift_07,
  giftSound_gift_08,
  giftSound_gift_09,
  giftSound_gift_10,
  giftSound_gift_11,
  giftSound_gift_12,
} from '../assets/soundData.js';
import { getGameVolume } from '../utils/sound.js';
import ConfirmPopup from './ConfirmPopup.jsx';
import InfoPopup from './InfoPopup.jsx';

const giftSounds = {
  fireworks: giftSound_gift_00,
  laugh_bomb: giftSound_gift_01,
  pizza_slice: giftSound_gift_02,
  coffee_boost: giftSound_gift_03,
  baby_chick: giftSound_gift_04,
  speed_racer: giftSound_gift_05,
  bullseye: giftSound_gift_06,
  magic_trick: giftSound_gift_07,
  surprise_box: giftSound_gift_08,
  dragon_burst: giftSound_gift_09,
  rocket_blast: giftSound_gift_10,
  royal_crown: giftSound_gift_11,
  alien_visit: giftSound_gift_12,
};

export default function GiftPopup({ open, onClose, players = [], senderIndex = 0, onGiftSent }) {
  const [selected, setSelected] = useState(GIFTS[0]);
  const [target, setTarget] = useState(players[0]?.index || 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  if (!open) return null;
  const recipient = players.find((p) => p.index === target);

  const handleSend = async () => {
    if (!recipient) return;
    setConfirmOpen(false);
    try {
      await sendGift(getPlayerId(), recipient.id, selected.id);
      const sound = giftSounds[selected.id];
      if (sound) {
        const a = new Audio(sound);
        a.volume = getGameVolume();
        a.play().catch(() => {});
      }
      setInfoMsg(`Sent ${selected.name} to ${recipient.name}`);
      onGiftSent && onGiftSent({ from: senderIndex, to: target, gift: selected });
    } catch {
      setInfoMsg('Failed to send gift');
    }
    onClose();
  };

  const tiers = [1, 2, 3];
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
        onClick={onClose}
      >
        <div
          className="bg-surface border border-border rounded p-4 space-y-2 w-72"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-center font-semibold mb-2">Send Gift</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {players.map((p) => (
              <button
                key={p.index}
                onClick={() => setTarget(p.index)}
                className={`w-full flex items-center space-x-2 border border-border rounded px-1 py-0.5 text-sm ${
                  target === p.index ? 'bg-accent' : ''
                }`}
              >
                <img src={p.photoUrl} className="w-6 h-6 rounded-full" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          {tiers.map((tier) => (
            <div key={tier} className="space-y-1">
              <p className="text-sm font-bold">Tier {tier}</p>
              <div className="grid grid-cols-2 gap-1">
                {GIFTS.filter((g) => g.tier === tier).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g)}
                    className={`border border-border rounded px-1 py-0.5 text-sm flex items-center justify-center space-x-1 ${
                      selected.id === g.id ? 'bg-accent' : ''
                    }`}
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
          <button
            className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            onClick={() => setConfirmOpen(true)}
          >
            Send {selected.icon} {selected.name}
          </button>
          <p className="text-xs text-center mt-1">
            10% charge and the amount of the gift will be deducted from your balance.
          </p>
        </div>
      </div>
      <ConfirmPopup
        open={confirmOpen}
        message="10% charge and the amount of the gift will be deducted from your balance. Continue?"
        onConfirm={handleSend}
        onCancel={() => setConfirmOpen(false)}
      />
      <InfoPopup
        open={Boolean(infoMsg)}
        onClose={() => setInfoMsg('')}
        title="Gift"
        info={infoMsg}
      />
    </>,
    document.body,
  );
}
