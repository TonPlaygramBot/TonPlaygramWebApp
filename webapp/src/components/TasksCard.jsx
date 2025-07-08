import { useEffect, useState } from 'react';

import {
  listTasks,
  completeTask,
  getAdStatus,
  watchAd,
  dailyCheckIn,
  getProfile,
} from '../utils/api.js';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { STORE_ADDRESS } from '../utils/storeData.js';

import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';

import { IoLogoTwitter, IoLogoTiktok } from 'react-icons/io5';

import { RiTelegramFill } from 'react-icons/ri';
import { FiVideo } from 'react-icons/fi';
import AdModal from './AdModal.tsx';
import { AiOutlineCheckSquare, AiOutlineCheck } from 'react-icons/ai';

const ICONS = {

  join_twitter: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,

  join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,

  follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
  watch_ad: <FiVideo className="text-yellow-500 w-5 h-5" />

};

const REWARDS = Array.from({ length: 30 }, (_, i) => 1000 * (i + 1));
const ONE_DAY = 24 * 60 * 60 * 1000;

export default function TasksCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="bg-surface border border-border rounded-xl wide-card">
        <LoginOptions />
      </div>
    );
  }

  const [tasks, setTasks] = useState(null);
  const [adCount, setAdCount] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const [streak, setStreak] = useState(1);
  const [lastCheck, setLastCheck] = useState(() => {
    const ts = localStorage.getItem('lastCheckIn');
    return ts ? parseInt(ts, 10) : null;
  });
  const [lastOnchain, setLastOnchain] = useState(() => {
    const ts = localStorage.getItem('lastOnchainCheck');
    return ts ? parseInt(ts, 10) : null;
  });

  const load = async () => {
    const data = await listTasks(telegramId);
    setTasks(data);
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
    try {
      const profile = await getProfile(telegramId);
      if (profile.dailyStreak) setStreak(profile.dailyStreak);
      const serverTs = profile.lastCheckIn
        ? new Date(profile.lastCheckIn).getTime()
        : null;
      const localTs = lastCheck || 0;
      const ts = Math.max(serverTs || 0, localTs);
      if (ts) {
        setLastCheck(ts);
        localStorage.setItem('lastCheckIn', String(ts));
      }
    } catch {}
  };

  useEffect(() => {

    load();

  }, []);

  const handleClaim = async (task) => {

    window.open(task.link, '_blank');

    await completeTask(telegramId, task.id);

    load();

  };

  const handleDailyCheck = async () => {
    try {
      const res = await dailyCheckIn(telegramId);
      if (!res.error) {
        setStreak(res.streak);
        const now = Date.now();
        setLastCheck(now);
        localStorage.setItem('lastCheckIn', String(now));
      }
    } catch {}
  };

  const handleOnchainCheck = async () => {
    if (!walletAddress) {
      tonConnectUI.openModal();
      return;
    }
    const tx = {
      validUntil: Math.floor(Date.now() / 1000) + 60,
      messages: [{ address: STORE_ADDRESS, amount: String(0.05 * 1e9) }],
    };
    try {
      await tonConnectUI.sendTransaction(tx);
      const now = Date.now();
      setLastOnchain(now);
      localStorage.setItem('lastOnchainCheck', String(now));
    } catch {
      alert('Transaction failed');
    }
  };

  const handleAdComplete = async () => {
    await watchAd(telegramId);
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
    setShowAd(false);
  };

  if (!tasks) {

    return (

      <div className="bg-surface border border-border rounded-xl p-4 text-subtext text-center wide-card">

        Loading tasks...

      </div>

    );

  }

  return (

    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img  src="/assets/SnakeLaddersbackground.png" className="background-behind-board object-cover" alt="" />

      <h3 className="text-lg font-bold text-text flex items-center justify-center space-x-1"><AiOutlineCheckSquare className="text-accent" /><span>Tasks</span></h3>

      <ul className="space-y-2">
        <li className="lobby-tile w-full">
          <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
            <AiOutlineCheck className="w-5 h-5 text-accent" />
            <span className="text-sm">Daily Check-In</span>
            <span className="text-xs text-subtext flex items-center gap-1">{REWARDS[streak - 1]} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
            {lastCheck && Date.now() - lastCheck < ONE_DAY ? (
              <span className="text-green-500 font-semibold text-sm">Done</span>
            ) : (
              <button
                onClick={handleDailyCheck}
                className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
              >
                Claim
              </button>
            )}
          </div>
        </li>
        <li className="lobby-tile w-full">
          <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
            <AiOutlineCheck className="w-5 h-5 text-accent" />
            <span className="text-sm">On Chain Check In</span>
            <span className="text-xs text-subtext flex items-center gap-1">{REWARDS[streak - 1] * 3} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
            {lastOnchain && Date.now() - lastOnchain < ONE_DAY ? (
              <span className="text-green-500 font-semibold text-sm">Done</span>
            ) : (
              <button
                onClick={handleOnchainCheck}
                className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
              >
                Claim
              </button>
            )}
          </div>
        </li>

        {tasks.map((t) => (
          <li key={t.id} className="lobby-tile w-full">
            <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
              {ICONS[t.id]}
              <span className="text-sm">{t.description}</span>
              <span className="text-xs text-subtext flex items-center gap-1">{t.reward} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
              {t.completed ? (
                <span className="text-green-500 font-semibold text-sm">Done</span>
              ) : (
                <button
                  onClick={() => handleClaim(t)}
                  className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
                >
                  Claim
                </button>
              )}
            </div>
          </li>
        ))}
        <li className="lobby-tile w-full">
          <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
            {ICONS.watch_ad}
            <span className="text-sm">Watch Ad ({adCount}/10)</span>
            <span className="text-xs text-subtext flex items-center gap-1">100 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
            {adCount >= 10 ? (
              <span className="text-green-500 font-semibold text-sm">Done</span>
            ) : (
              <button
                onClick={() => setShowAd(true)}
                className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
              >
                Watch
              </button>
            )}
          </div>
        </li>

      </ul>
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />

    </div>

  );

}