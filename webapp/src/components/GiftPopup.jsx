import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ensureAccountId } from '../utils/telegram.js';
import { sendGift } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import GiftIcon from './GiftIcon.jsx';
import { giftSounds } from '../utils/giftSounds.js';
import { getGameVolume } from '../utils/sound.js';
import InfoPopup from './InfoPopup.jsx';

export default function GiftPopup({
  open,
  onClose,
  players = [],
  senderIndex = 0,
  onGiftSent,
  title,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70',
  panelClassName = 'bg-surface border border-border rounded p-4 space-y-2 w-72',
  titleClassName = 'text-center font-semibold mb-2',
  headerClassName = 'flex items-center justify-between gap-2',
  closeButtonClassName = 'rounded-full border border-white/15 bg-white/10 px-2 py-1 text-xs text-white/80',
  showCloseButton = false,
  playerListClassName = 'space-y-1 max-h-32 overflow-y-auto',
  tierGroupClassName = 'space-y-1',
  giftGridClassName = 'grid grid-cols-2 gap-1',
  playerButtonClassName = 'w-full flex items-center space-x-2 border border-border rounded px-1 py-0.5 text-sm',
  playerButtonActiveClassName = 'bg-accent',
  tierTitleClassName = 'text-sm font-bold',
  giftButtonClassName = 'border border-border rounded px-1 py-0.5 text-sm flex items-center justify-center space-x-1'
}) {
  const validPlayers = players.filter((p) => p.id);
  const [target, setTarget] = useState(validPlayers[0]?.index || 0);
  const [infoMsg, setInfoMsg] = useState('');
  const [pendingGift, setPendingGift] = useState(null);
  const resolvedTitle = title ?? 'Send Gift';

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
  }, [validPlayers, target]);

  if (!open && !infoMsg) return null;
  const recipient = validPlayers.find((p) => p.index === target);

  const handleSend = async (gift) => {
    if (!recipient) return;

    try {
      const fromId = await ensureAccountId();
      const res = await sendGift(fromId, recipient.id, gift.id);
      if (res?.error) {
        setInfoMsg(res.error);
        onClose();
        return;
      }

      const sound = giftSounds[gift.id];
      if (sound) {
        const audio = new Audio(sound);
        audio.volume = getGameVolume();
        if (gift.id === 'bullseye') {
          setTimeout(() => {
            audio.play().catch(() => {});
          }, 2500);
        } else {
          audio.play().catch(() => {});
        }

        if (gift.id === 'magic_trick') {
          setTimeout(() => {
            audio.pause();
          }, 4000);
        } else if (gift.id === 'fireworks') {
          setTimeout(() => {
            audio.pause();
          }, 6000);
        } else if (gift.id === 'surprise_box') {
          setTimeout(() => {
            audio.pause();
          }, 5000);
        }
      }

      setInfoMsg(`Sent ${gift.name} to ${recipient.name}`);
      setPendingGift({ from: senderIndex, to: target, gift });
    } catch {
      setInfoMsg('Failed to send gift');
    }

    onClose();
  };

  const tiers = [1, 2, 3];

  return createPortal(
    <>
      <div className={overlayClassName} onClick={onClose}>
        <div className={panelClassName} onClick={(e) => e.stopPropagation()}>
          {showCloseButton || title ? (
            <div className={headerClassName}>
              <p className={titleClassName}>{resolvedTitle}</p>
              {showCloseButton && (
                <button type="button" onClick={onClose} className={closeButtonClassName}>
                  ✕
                </button>
              )}
            </div>
          ) : (
            <p className={titleClassName}>{resolvedTitle}</p>
          )}

          <div className={playerListClassName}>
            {validPlayers.map((p) => (
              <button
                key={p.index}
                onClick={() => setTarget(p.index)}
                className={`${playerButtonClassName} ${target === p.index ? playerButtonActiveClassName : ''}`}
              >
                <img src={p.photoUrl} alt={`${p.name}'s avatar`} className="w-5 h-5 rounded-full" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          {tiers.map((tier) => (
            <div key={tier} className={tierGroupClassName}>
              <p className={tierTitleClassName}>Tier {tier}</p>
              <div className={giftGridClassName}>
                {NFT_GIFTS.filter((g) => g.tier === tier).map((gift) => (
                  <button
                    key={gift.id}
                    onClick={() => handleSend(gift)}
                    className={giftButtonClassName}
                  >
                    <GiftIcon icon={gift.icon} className="w-4 h-4" />
                    <span className="flex items-center space-x-0.5">
                      <span>{gift.price}</span>
                      <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
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
