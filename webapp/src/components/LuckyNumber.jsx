import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller.jsx';
import AdModal from './AdModal.tsx';
import CardSpinner from './CardSpinner.jsx';
import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';
import coinConfetti from '../utils/coinConfetti';
import { getGameVolume } from '../utils/sound.js';

const todayKey = () => new Date().toISOString().slice(0, 10);

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
  const [canRoll, setCanRoll] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [trigger, setTrigger] = useState(0);
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q'];
  const suitTypes = ['hearts', 'spades', 'diamonds', 'clubs'];
  const [cards] = useState(() =>
    ranks.map((r) => ({ rank: r, suit: suitTypes[Math.floor(Math.random() * suitTypes.length)] }))
  );
  const [overlays, setOverlays] = useState([]);

  const COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

  useEffect(() => {
    const last = parseInt(localStorage.getItem('luckyRollTs') || '0', 10);
    setCanRoll(Date.now() - last >= COOLDOWN);
  }, []);

  useEffect(() => {
    const claimed = localStorage.getItem('luckyCard1Claimed') === todayKey();
    if (!claimed) {
      (async () => {
        try {
          const balRes = await getWalletBalance(telegramId);
          const newBalance = (balRes.balance || 0) + 100;
          await updateBalance(telegramId, newBalance);
          await addTransaction(telegramId, 100, 'lucky');
          localStorage.setItem('luckyCard1Claimed', todayKey());
        } catch (e) {}
      })();
    }
  }, [telegramId]);

  const handleRollStart = () => setRolling(true);

  const handleRollEnd = (values) => {
    setRolling(false);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const idx = Math.min(Math.max(0, sum - 2), ranks.length - 1);
    setSelected(idx);
    setCardPrize(null);
    setSpinTrigger((t) => t + 1);
    localStorage.setItem('luckyRollTs', String(Date.now()));
    setCanRoll(false);
    setAdWatched(false);
    const items = ['DICE', 'FREE_SPIN', 'BONUS_X3'];
    setOverlays(
      items.map((type) => ({
        type,
        top: `${10 + Math.random() * 80}%`,
        left: `${10 + Math.random() * 80}%`,
      }))
    );
  };

  const handleSpinFinish = async (prize) => {
    let finalPrize = prize;
    if (typeof prize === 'number') {
      const suit = cards[selected]?.suit;
      if (suit === 'hearts') finalPrize = prize * 2;
      else if (suit === 'spades') finalPrize = Math.floor(prize * 0.5);
      else if (suit === 'diamonds') finalPrize = Math.floor(prize * 1.5);
      else if (suit === 'clubs') finalPrize = Math.floor(prize * 0.75);
    }

    setCardPrize(finalPrize);
    if (typeof finalPrize === 'number') {
      try {
        const balRes = await getWalletBalance(telegramId);
        const newBalance = (balRes.balance || 0) + finalPrize;
        await updateBalance(telegramId, newBalance);
        await addTransaction(telegramId, finalPrize, 'lucky');
      } catch (e) {}
    } else if (finalPrize === 'FREE_SPIN') {
      const fs = parseInt(localStorage.getItem('freeSpins') || '0', 10) + 2;
      localStorage.setItem('freeSpins', String(fs));
      window.dispatchEvent(new Event('freeSpinAwarded'));
      document.getElementById('spin-game')?.scrollIntoView({ behavior: 'smooth' });
    } else if (finalPrize === 'BONUS_X3') {
      localStorage.setItem('bonusX3', 'true');
      window.dispatchEvent(new Event('bonusX3Awarded'));
      document.getElementById('spin-game')?.scrollIntoView({ behavior: 'smooth' });
    }

    let icon = '/assets/icons/ezgif-54c96d8a9b9236.webp';
    if (finalPrize === 'BONUS_X3') {
      icon = '/assets/icons/file_00000000ead061faa3b429466e006f48.webp';
    } else if (finalPrize === 'FREE_SPIN') {
      icon = '/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp';
    }
    coinConfetti(50, icon);
    const audio = new Audio(
      '/assets/sounds/11l-victory_sound_with_t-1749487412779-357604.mp3'
    );
    audio.volume = getGameVolume();
    audio.play().catch(() => {});
  };

  const handleRollClick = () => {
    if (!canRoll || rolling) return;
    if (!adWatched) {
      setShowAd(true);
      return;
    }
    setTrigger((t) => t + 1);
  };

  const handleAdComplete = () => {
    setAdWatched(true);
    setShowAd(false);
    setTrigger((t) => t + 1);
  };

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
                {selected === i && !cardPrize && (
                  <CardSpinner trigger={spinTrigger} onFinish={handleSpinFinish} />
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
        <div
          onClick={handleRollClick}
          className={canRoll ? 'cursor-pointer' : 'cursor-not-allowed'}
        >
          <DiceRoller
            onRollEnd={handleRollEnd}
            onRollStart={handleRollStart}
            showButton={false}
            clickable={false}
            trigger={trigger}
            className="lucky-dice"
            diceTransparent
          />
        </div>
        {!canRoll && (
          <p className="text-sm text-subtext">You can roll again every 4 hours.</p>
        )}
      </div>
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />
    </div>
  );
}
