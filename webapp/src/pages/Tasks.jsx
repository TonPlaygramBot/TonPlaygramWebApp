import { useEffect, useState } from 'react';

import {
  listTasks,
  completeTask,
  getAdStatus,
  watchAd,
  getProfile,
  dailyCheckIn,
} from '../utils/api.js';

import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';

import { IoLogoTwitter, IoLogoTiktok } from 'react-icons/io5';

import { RiTelegramFill } from 'react-icons/ri';
import { FiVideo } from 'react-icons/fi';
import { AiOutlineCheck } from 'react-icons/ai';
import AdModal from '../components/AdModal.tsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { STORE_ADDRESS } from '../utils/storeData.js';

const REWARDS = Array.from({ length: 30 }, (_, i) => 1000 * (i + 1));
const ONE_DAY = 24 * 60 * 60 * 1000;

export default function Tasks() {
  useTelegramBackButton();
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [tasks, setTasks] = useState(null);
  const [adCount, setAdCount] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [category, setCategory] = useState('TonPlaygram');
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
        setLastCheck(Date.now());
        localStorage.setItem('lastCheckIn', String(Date.now()));
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
      messages: [{ address: STORE_ADDRESS, amount: String(0.05 * 1e9) }]
    };
    try {
      await tonConnectUI.sendTransaction(tx);
      setLastOnchain(Date.now());
      localStorage.setItem('lastOnchainCheck', String(Date.now()));
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

  if (!tasks) return <div className="p-4 text-subtext">Loading...</div>;

  const ICONS = {
    join_twitter: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,
    join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
    follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    watch_ad: <FiVideo className="text-yellow-500 w-5 h-5" />
  };

  return (

    <div className="relative p-4 space-y-2 text-text flex flex-col items-center wide-card">
      <h2 className="text-xl font-bold">Tasks</h2>
      <div className="flex justify-center space-x-2">
        {['TonPlaygram', 'Partners'].map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`lobby-tile px-3 py-1 ${category === c ? 'lobby-selected' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>
      {category === 'TonPlaygram' && (
        <>
          <ul className="space-y-2">
            <li className="lobby-tile w-full flex justify-between items-center">
              <div className="flex items-center space-x-2 text-sm">
                <AiOutlineCheck className="w-5 h-5 text-accent" />
                <span>Daily Check-In</span>
                <span className="text-xs text-subtext flex items-center gap-1">{REWARDS[streak - 1]} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
              </div>
              {lastCheck && Date.now() - lastCheck < ONE_DAY ? (
                <span className="text-green-500 font-semibold text-sm">Completed</span>
              ) : (
                <button
                  onClick={handleDailyCheck}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-background text-sm rounded"
                >
                  Claim
                </button>
              )}
            </li>
            <li className="lobby-tile w-full flex justify-between items-center">
              <div className="flex items-center space-x-2 text-sm">
                <AiOutlineCheck className="w-5 h-5 text-accent" />
                <span>On Chain Check In</span>
                <span className="text-xs text-subtext flex items-center gap-1">{REWARDS[streak - 1] * 3} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
              </div>
              {lastOnchain && Date.now() - lastOnchain < ONE_DAY ? (
                <span className="text-green-500 font-semibold text-sm">Completed</span>
              ) : (
                <button
                  onClick={handleOnchainCheck}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-background text-sm rounded"
                >
                  Claim
                </button>
              )}
            </li>

        {tasks.map((t) => (

          <li

            key={t.id}

            className="lobby-tile w-full flex justify-between items-center"

          >

            <div className="flex items-center space-x-2 text-sm">

              {ICONS[t.id]}

              <span>{t.description}</span>

              <span className="text-xs text-subtext flex items-center gap-1">{t.reward} <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>

            </div>

            {t.completed ? (

              <span className="text-green-500 font-semibold text-sm">Completed</span>

            ) : (

              <button

                onClick={() => handleClaim(t)}

                className="px-2 py-1 bg-primary hover:bg-primary-hover text-background text-sm rounded"

              >

                Claim

              </button>

            )}

          </li>

        ))}
        <li className="lobby-tile w-full flex justify-between items-center">
          <div className="flex items-center space-x-2 text-sm">
            {ICONS.watch_ad}
            <span>Watch Ad ({adCount}/10)</span>
            <span className="text-xs text-subtext flex items-center gap-1">100 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
          </div>
          {adCount >= 10 ? (
            <span className="text-green-500 font-semibold text-sm">Completed</span>
          ) : (
            <button
              onClick={() => setShowAd(true)}
              className="px-2 py-1 bg-primary hover:bg-primary-hover text-background text-sm rounded"
            >
              Watch
            </button>
          )}
        </li>
      </ul>
        </>
      )}
      {category === 'Partners' && (
        <p className="text-center text-subtext">Partner tasks coming soon.</p>
      )}
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />

    </div>

  );

}