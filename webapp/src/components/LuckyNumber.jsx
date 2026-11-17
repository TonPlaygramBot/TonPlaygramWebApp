import { useState, useEffect, useRef } from 'react';
import DiceRoller from './DiceRoller.jsx';
import AdModal from './AdModal.tsx';
import CardSpinner from './CardSpinner.jsx';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import TikTokTaskVideo from './TikTokTaskVideo.jsx';
import useServerSpinReward from '../hooks/useServerSpinReward.js';
import coinConfetti from '../utils/coinConfetti';
import { getGameVolume } from '../utils/sound.js';

import useLuckyDaily from '../hooks/useLuckyDaily.js';

export default function LuckyNumber() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [selected, setSelected] = useState(null);
  const [cardPrize, setCardPrize] = useState(null);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
  const suitTypes = ['hearts', 'spades', 'diamonds', 'clubs'];
  const [cards, setCards] = useState(() =>
    ranks.map((r) => ({ rank: r, suit: suitTypes[Math.floor(Math.random() * suitTypes.length)] }))
  );
  const [overlays, setOverlays] = useState([]);

  const daily = useLuckyDaily(telegramId);
  const receiptRef = useRef(null);
  const [receipt, setReceipt] = useState(null);
  const reward = useServerSpinReward('lucky', (grant) => {
    receiptRef.current = grant;
    setReceipt(grant);
    setSelected(null); setCardPrize(null); setRolling(true);
    setCards((items) => items.map((card, index) => index === grant.cardIndex ? { ...card, suit: grant.suit } : card));
    setTrigger((value) => value + 1);
  });
  useEffect(() => {
    receiptRef.current = null; setReceipt(null); setSelected(null);
    setCardPrize(null); setRolling(false); setOverlays([]);
  }, [reward.identity]);
  const canRoll = reward.ready && !reward.busy && !rolling;
  const handleRollStart = () => setRolling(true);
  const handleRollEnd = () => {
    const grant = receiptRef.current;
    if (!grant) return;
    setSelected(grant.cardIndex);
    setSpinTrigger((value) => value + 1);
    setOverlays(['DICE', 'FREE_SPIN', 'BONUS_X3'].map((type) => ({
      type, top: `${10 + Math.random() * 80}%`, left: `${10 + Math.random() * 80}%`
    })));
  };
  const handleSpinFinish = () => {
    const grant = receiptRef.current;
    if (!grant) return;
    // Already credited by the claim. Animation callbacks never mutate balances.
    setCardPrize(grant.outcome); setRolling(false);
    coinConfetti(50, '/assets/icons/file_00000000362481f7978631c42572193f.png');
    const audio = new Audio('/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3');
    audio.volume = getGameVolume(); audio.play().catch(() => {});
  };
  const handleRollClick = () => { if (canRoll) reward.begin(); };

  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 text-center overflow-hidden wide-card">
      <img
        src="/assets/icons/lucky_card_bg.webp"
        className="absolute inset-0 w-full h-full object-cover -z-10 pointer-events-none"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <h3 className="text-lg font-bold text-white">Lucky Card</h3>
      <div aria-live="polite" className="text-sm text-white">
        {daily.busy && <p>Checking daily reward…</p>}
        {daily.receipt && <p>Daily 100 TPC {daily.receipt.alreadyClaimed ? 'already claimed today' : 'claimed'}.</p>}
        {daily.error && (
          <div role="alert">
            <p>{daily.error}</p>
            <button type="button" onClick={daily.retry} disabled={daily.busy}
              className="underline text-brand-gold">Retry daily reward</button>
          </div>
        )}
      </div>
      <TikTokTaskVideo
        title="Lucky Card Video"
        videoUrl="https://vt.tiktok.com/ZSujaXgpP/"
        storageKey="luckyCardVideoPopupSeen"
      />
      <div className="grid grid-cols-3 gap-2 justify-items-center relative">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`board-style w-16 h-24 flex items-center justify-center rounded relative ${
              selected === i ? 'border-4 border-brand-gold' : 'border-2 border-border'
            }`}
            style={{ perspective: '1000px' }}
          >
            <div
              className="relative w-full h-full transition-transform duration-500"
              style={{
                transform: selected === i ? 'rotateY(180deg)' : 'rotateY(0deg)',
                transformStyle: 'preserve-3d',
              }}
            >
              <div
                className="absolute inset-0 lucky-card-back rounded-md"
                style={{ backfaceVisibility: 'hidden' }}
              ></div>
              <div
                className="absolute inset-0 rounded-md flex items-center justify-center"
                style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
              >
                {cardPrize && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-xl font-bold">
                    <span
                      className={`${
                        card.suit === 'hearts' || card.suit === 'diamonds'
                          ? 'text-red-500'
                          : 'text-black'
                      }`}
                    >
                      {card.rank}
                    </span>
                    <span
                      className={`text-2xl ${
                        card.suit === 'hearts' || card.suit === 'diamonds'
                          ? 'text-red-500'
                          : 'text-black'
                      }`}
                    >
                      {card.suit === 'hearts'
                        ? '♥'
                        : card.suit === 'spades'
                        ? '♠'
                        : card.suit === 'diamonds'
                        ? '♦'
                        : '♣'}
                    </span>
                  </div>
                )}
                {selected === i && !cardPrize && (
                  <CardSpinner trigger={spinTrigger} forcedOutcome={receipt?.baseOutcome} onFinish={handleSpinFinish} />
                )}
                {selected === i && cardPrize && (
                  <div className="w-full h-full bg-white rounded-md relative">
                    <div className="absolute top-1 left-1 text-sm font-bold flex items-center">
                      <span
                        className={`${
                          card.suit === 'hearts' || card.suit === 'diamonds'
                            ? 'text-red-500'
                            : 'text-black'
                        }`}
                      >
                        {card.rank}
                      </span>
                      <span
                        className={`ml-1 ${
                          card.suit === 'hearts' || card.suit === 'diamonds'
                            ? 'text-red-500'
                            : 'text-black'
                        }`}
                      >
                        {card.suit === 'hearts'
                          ? '♥'
                          : card.suit === 'spades'
                          ? '♠'
                          : card.suit === 'diamonds'
                          ? '♦'
                          : '♣'}
                      </span>
                    </div>
                    <div className="absolute bottom-1 right-1 text-sm font-bold flex items-center">
                      <span
                        className={`${
                          card.suit === 'hearts' || card.suit === 'diamonds'
                            ? 'text-red-500'
                            : 'text-black'
                        }`}
                      >
                        {card.rank}
                      </span>
                      <span
                        className={`ml-1 ${
                          card.suit === 'hearts' || card.suit === 'diamonds'
                            ? 'text-red-500'
                            : 'text-black'
                        }`}
                      >
                        {card.suit === 'hearts'
                          ? '♥'
                          : card.suit === 'spades'
                          ? '♠'
                          : card.suit === 'diamonds'
                          ? '♦'
                          : '♣'}
                      </span>
                    </div>
                    <div
                      className={`absolute inset-0 flex items-center justify-center text-2xl ${
                        card.suit === 'hearts' || card.suit === 'diamonds'
                          ? 'text-red-500'
                          : 'text-black'
                      }`}
                    >
                      {card.suit === 'hearts'
                        ? '♥'
                        : card.suit === 'spades'
                        ? '♠'
                        : card.suit === 'diamonds'
                        ? '♦'
                        : '♣'}
                    </div>
                    <div className="absolute top-1 right-1 text-xs font-bold flex items-center">
                      {cardPrize === 'FREE_SPIN' ? (
                        <>
                          <img
                            src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                            alt="Free Spin"
                            className="w-4 h-4"
                          />
                          <span className="ml-1">+2</span>
                        </>
                      ) : cardPrize === 'BONUS_X3' ? (
                        <>
                          <img
                            src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                            alt="Bonus"
                            className="w-4 h-4"
                          />
                          <span className="ml-1">X3</span>
                        </>
                      ) : (
                        <span>{cardPrize}</span>
                      )}
                    </div>
                    <div className="absolute bottom-1 left-1 text-xs font-bold flex items-center">
                      {cardPrize === 'FREE_SPIN' ? (
                        <>
                          <img
                            src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                            alt="Free Spin"
                            className="w-4 h-4"
                          />
                          <span className="ml-1">+2</span>
                        </>
                      ) : cardPrize === 'BONUS_X3' ? (
                        <>
                          <img
                            src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                            alt="Bonus"
                            className="w-4 h-4"
                          />
                          <span className="ml-1">X3</span>
                        </>
                      ) : (
                        <span>{cardPrize}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {overlays.map((o, idx) => (
          <div
            key={`ov-${idx}`}
            className="absolute pointer-events-none"
            style={{ top: o.top, left: o.left }}
          >
            {o.type === 'DICE' ? (
              <span className="text-2xl">🎲</span>
            ) : o.type === 'FREE_SPIN' ? (
              <img
                src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                alt="Free Spin"
                className="w-6 h-6"
              />
            ) : (
              <img
                src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                alt="Bonus"
                className="w-6 h-6"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center space-y-2 mt-6">
        <button
          type="button" aria-label="Roll Lucky Card dice" disabled={!canRoll}
          onClick={handleRollClick}
          className={canRoll ? 'cursor-pointer' : 'cursor-not-allowed'}
        >
          <DiceRoller
            key={reward.identity}
            forcedValues={receipt?.dice || []}
            onRollEnd={handleRollEnd}
            onRollStart={handleRollStart}
            showButton={false}
            clickable={false}
            trigger={trigger}
            className="lucky-dice"
            diceTransparent
          />
        </button>
        {!canRoll && (
          <p className="text-sm text-subtext">{reward.busy ? 'Confirming reward…' : rolling ? 'Revealing your reward…' : `Next roll in ${Math.ceil(reward.remaining / 60000)} minutes (4-hour cooldown).`}</p>
        )}
      </div>
      {reward.error && <div role="alert" className="text-sm text-white">
        <p>{reward.error} Retrying recovers the same reward, without crediting it twice.</p>
        <button type="button" onClick={reward.begin} disabled={reward.busy}>Retry Lucky reward</button>
      </div>}
      {cardPrize === 'BONUS_X3' && <p role="status" className="text-white">
        Bonus: {receipt.bonusOutcomes.join(' + ')} = {receipt.amount} TPC credited.
      </p>}
      {cardPrize === 'FREE_SPIN' && <p role="status" className="text-white">2 server-issued free spins added to Spin.</p>}
      <p className="text-xs text-subtext">Only server-issued rewards count. Older local Lucky Number bonuses still need verification.</p>
      <AdModal
        open={reward.showAd}
        onComplete={reward.claim}
        onClose={reward.closeAd}
      />
    </div>
  );
}
