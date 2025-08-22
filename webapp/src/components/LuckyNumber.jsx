import { useState, useEffect } from 'react';
import DiceRoller from './DiceRoller.jsx';
import RewardPopup from './RewardPopup.tsx';
import AdModal from './AdModal.tsx';
import CardSpinner from './CardSpinner.jsx';
import { getTelegramId, getPlayerId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';
import { getWalletBalance, updateBalance, addTransaction } from '../utils/api.js';

const todayKey = () => new Date().toISOString().slice(0, 10);

const DEV_ACCOUNTS = [
  import.meta.env.VITE_DEV_ACCOUNT_ID,
  import.meta.env.VITE_DEV_ACCOUNT_ID_1,
  import.meta.env.VITE_DEV_ACCOUNT_ID_2,
].filter(Boolean);

export default function LuckyNumber() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const accountId = getPlayerId();
  const isDev = DEV_ACCOUNTS.includes(accountId);

  const [selected, setSelected] = useState(null);
  const [reward, setReward] = useState(null);
  const [cardPrize, setCardPrize] = useState(null);
  const [spinTrigger, setSpinTrigger] = useState(0);
  const [canRoll, setCanRoll] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const COOLDOWN = 4 * 60 * 60 * 1000; // 4 hours

  useEffect(() => {
    if (isDev) {
      setCanRoll(true);
      return;
    }
    const last = parseInt(localStorage.getItem('luckyRollTs') || '0', 10);
    setCanRoll(Date.now() - last >= COOLDOWN);
  }, [isDev]);

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
    const idx = Math.min(Math.max(0, sum - 1), 11);
    setSelected(idx);
    setCardPrize(null);
    setSpinTrigger((t) => t + 1);
    if (!isDev) {
      localStorage.setItem('luckyRollTs', String(Date.now()));
      setCanRoll(false);
    } else {
      setCanRoll(true);
    }
    setAdWatched(false);
  };

  const handleSpinFinish = async (prize) => {
    setCardPrize(prize);
    if (typeof prize === 'number') {
      try {
        const balRes = await getWalletBalance(telegramId);
        const newBalance = (balRes.balance || 0) + prize;
        await updateBalance(telegramId, newBalance);
        await addTransaction(telegramId, prize, 'lucky');
      } catch (e) {}
    } else if (prize === 'FREE_SPIN') {
      const fs = parseInt(localStorage.getItem('freeSpins') || '0', 10) + 2;
      localStorage.setItem('freeSpins', String(fs));
      window.dispatchEvent(new Event('freeSpinAwarded'));
      document.getElementById('spin-game')?.scrollIntoView({ behavior: 'smooth' });
    } else if (prize === 'BONUS_X3') {
      localStorage.setItem('bonusX3', 'true');
      window.dispatchEvent(new Event('bonusX3Awarded'));
      document.getElementById('spin-game')?.scrollIntoView({ behavior: 'smooth' });
    }
    setReward(prize);
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
      <div className="grid grid-cols-3 gap-2 justify-items-center">
        {Array.from({ length: 12 }).map((_, i) => (
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
                className="absolute inset-0 bg-white rounded-md flex items-center justify-center text-xl font-bold text-white"
                style={{ backfaceVisibility: 'hidden', WebkitTextStroke: '1px black' }}
              >
                {i + 1}
              </div>
              <div
                className="absolute inset-0 rounded-md flex items-center justify-center"
                style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
              >
                {selected === i && !cardPrize && (
                  <CardSpinner trigger={spinTrigger} onFinish={handleSpinFinish} />
                )}
                {selected === i && cardPrize && (
                  <div className="flex flex-col items-center justify-center w-full h-full bg-white rounded-md">
                    {cardPrize === 'FREE_SPIN' ? (
                      <>
                        <img
                          src="/assets/icons/file_00000000ae68620a96d269fe76d158e5_256x256.webp"
                          alt="Free Spin"
                          className="w-10 h-10"
                        />
                        <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>+2</span>
                      </>
                    ) : cardPrize === 'BONUS_X3' ? (
                      <>
                        <img
                          src="/assets/icons/file_000000009160620a96f728f463de1c3f.webp"
                          alt="Bonus"
                          className="w-10 h-10"
                        />
                        <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>X3</span>
                      </>
                    ) : (
                      <>
                        <img
                          src="/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp"
                          alt="TonPlaygram"
                          className="w-10 h-10"
                        />
                        <span className="font-bold text-white" style={{ WebkitTextStroke: '1px black' }}>{cardPrize}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
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
      <RewardPopup
        reward={reward}
        onClose={() => {
          setReward(null);
          setSelected(null);
          setCardPrize(null);
        }}
      />
    </div>
  );
}

