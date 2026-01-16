import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getPlayerId, ensureAccountId } from '../utils/telegram.js';
import { sendGift } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import { giftSounds } from '../utils/giftSounds.js';
import { getGameVolume } from '../utils/sound.js';
import ConfirmPopup from './ConfirmPopup.jsx';
import InfoPopup from './InfoPopup.jsx';


export default function GiftPopup({
  open,
  onClose,
  players = [],
  senderIndex = 0,
  onGiftSent,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70',
  panelClassName = 'bg-surface border border-border rounded p-4 space-y-2 w-72',
  titleClassName = 'text-center font-semibold mb-2',
  playerButtonClassName = 'w-full flex items-center space-x-2 border border-border rounded px-1 py-0.5 text-sm',
  playerButtonActiveClassName = 'bg-accent',
  tierTitleClassName = 'text-sm font-bold',
  giftButtonClassName = 'border border-border rounded px-1 py-0.5 text-sm flex items-center justify-center space-x-1',
  giftButtonActiveClassName = 'bg-accent',
  costClassName = 'text-xs text-center mt-2 flex items-center justify-center space-x-1',
  sendButtonClassName = 'w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black',
  noteClassName = 'text-xs text-center mt-1'
}) {
  const validPlayers = players.filter((p) => p.id);
  const [selected, setSelected] = useState(NFT_GIFTS[0]);
  const [target, setTarget] = useState(validPlayers[0]?.index || 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');
  const [pendingGift, setPendingGift] = useState(null);

  const handleInfoClose = () => {
    setInfoMsg('');
    if (pendingGift) {
      onGiftSent && onGiftSent(pendingGift);
      setPendingGift(null);
    }
  };
  useEffect(() => {
    if (validPlayers.length > 0 && !validPlayers.some((p) => p.index === target)) {
      setTarget(validPlayers[0].index);
    }
  }, [validPlayers]);
  if (!open && !infoMsg) return null;
  const recipient = validPlayers.find((p) => p.index === target);

  const handleSend = async () => {
    if (!recipient) return;
    setConfirmOpen(false);
    try {
      const fromId = await ensureAccountId();
      const res = await sendGift(fromId, recipient.id, selected.id);
      if (res?.error) {
        setInfoMsg(res.error);
        onClose();
        return;
      }
      const sound = giftSounds[selected.id];
      if (sound) {
        const a = new Audio(sound);
        a.volume = getGameVolume();
        if (selected.id === 'bullseye') {
          setTimeout(() => {
            a.play().catch(() => {});
          }, 2500);
        } else {
          a.play().catch(() => {});
        }
        if (selected.id === 'magic_trick') {
          setTimeout(() => {
            a.pause();
          }, 4000);
        } else if (selected.id === 'fireworks') {
          setTimeout(() => {
            a.pause();
          }, 6000);
        } else if (selected.id === 'surprise_box') {
          setTimeout(() => {
            a.pause();
          }, 5000);
        }
      }
      setInfoMsg(`Sent ${selected.name} to ${recipient.name}`);
      setPendingGift({ from: senderIndex, to: target, gift: selected });
    } catch {
      setInfoMsg('Failed to send gift');
    }
    onClose();
  };

  const tiers = [1, 2, 3];
  return createPortal(
    <>
      <div
        className={overlayClassName}
        onClick={onClose}
      >
        <div
          className={panelClassName}
          onClick={(e) => e.stopPropagation()}
        >
          <p className={titleClassName}>Send Gift</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {validPlayers.map((p) => (
              <button
                key={p.index}
                onClick={() => setTarget(p.index)}
                className={`${playerButtonClassName} ${
                  target === p.index ? playerButtonActiveClassName : ''
                }`}
              >
                <img src={p.photoUrl} alt={`${p.name}'s avatar`} className="w-5 h-5 rounded-full" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          {tiers.map((tier) => (
            <div key={tier} className="space-y-1">
              <p className={tierTitleClassName}>Tier {tier}</p>
              <div className="grid grid-cols-2 gap-1">
                {NFT_GIFTS.filter((g) => g.tier === tier).map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelected(g)}
                    className={`${giftButtonClassName} ${
                      selected.id === g.id ? giftButtonActiveClassName : ''
                    }`}
                  >
                  <GiftIcon icon={g.icon} className="w-4 h-4" />
                    <span className="flex items-center space-x-0.5">
                      <span>{g.price}</span>
                      <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className={costClassName}>
            <span>Cost:</span>
            <span>{selected.price}</span>
            <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-3 h-3" />
          </div>
          <button
            className={sendButtonClassName}
            onClick={() => setConfirmOpen(true)}
          >
            Send <GiftIcon icon={selected.icon} className="w-4 h-4 inline" /> {selected.name}
          </button>
          <p className={noteClassName}>
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
        onClose={handleInfoClose}
        title="Gift"
        info={infoMsg}
      />
    </>,
    document.body,
  );
}
