import { useEffect, useState } from 'react';

import {
  listTasks,
  completeTask,
  verifyPost,
  verifyTelegramReaction,
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
import PostsModal from './PostsModal.jsx';
import InfoPopup from './InfoPopup.jsx';
import { AiOutlineCheckSquare, AiOutlineCheck } from 'react-icons/ai';

const ICONS = {

  join_twitter: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,

  join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
  
  follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
  boost_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />, 
  post_tweet: <IoLogoTwitter className="text-sky-400 w-5 h-5" />, 
  react_tg_post: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
  engage_tweet: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,
  watch_ad: <FiVideo className="text-yellow-500 w-5 h-5" />

};

const REWARDS = Array.from({ length: 30 }, (_, i) => Math.floor(100 + (i + 1) * 50));
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
  const [showPosts, setShowPosts] = useState(false);
  const [postLink, setPostLink] = useState('');
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
  const [showNew, setShowNew] = useState(false);
  const [showTwitterInfo, setShowTwitterInfo] = useState(false);
  const [profile, setProfile] = useState(null);

  const load = async () => {
    const data = await listTasks(telegramId);
    const tasksList = data.tasks || data;
    setTasks(tasksList);
    if (data.version) {
      const seen = localStorage.getItem('tasksVersion');
      if (seen !== String(data.version)) {
        setShowNew(true);
        localStorage.setItem('tasksVersion', String(data.version));
      }
    }
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
    try {
      const prof = await getProfile(telegramId);
      setProfile(prof);
      if (prof.dailyStreak) setStreak(prof.dailyStreak);
      const serverTs = prof.lastCheckIn
        ? new Date(prof.lastCheckIn).getTime()
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
    if (['join_twitter', 'engage_tweet'].includes(task.id) && !profile?.social?.twitter) {
      setShowTwitterInfo(true);
      return;
    }

    window.open(task.link, '_blank');

    if (task.id === 'react_tg_post') {
      const res = await verifyTelegramReaction(telegramId);
      if (res.error || !res.reacted) {
        alert(res.error || 'Reaction not verified');
        return;
      }
    }

    await completeTask(telegramId, task.id);

    load();

  };

  const handlePostVerify = async () => {
    if (!postLink) return;
    if (!profile?.social?.twitter) {
      setShowTwitterInfo(true);
      return;
    }
    const res = await verifyPost(telegramId, postLink);
    if (!res.error) {
      await completeTask(telegramId, 'post_tweet');
      setPostLink('');
      load();
    } else {
      alert(res.error);
    }
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
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />

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
              ) : t.id === 'post_tweet' ? (
                <div className="space-y-2 w-full">
                  <button
                    onClick={() => setShowPosts(true)}
                    className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded w-1/2"
                  >
                    View Posts
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      value={postLink}
                      onChange={(e) => setPostLink(e.target.value)}
                      placeholder="Tweet link"
                      className="px-1 py-0.5 text-xs bg-surface border border-border rounded flex-1"
                    />
                    <button
                      onClick={handlePostVerify}
                      className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
                    >
                      Verify
                    </button>
                  </div>
                </div>
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
            <span className="text-sm">Watch Ad ({adCount}/5)</span>
            <span className="text-xs text-subtext flex items-center gap-1">50 <img src="/assets/icons/TPCcoin_1.webp" alt="TPC" className="w-4 h-4" /></span>
            {adCount >= 5 ? (
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
      <PostsModal
        open={showPosts}
        posts={tasks.find((t) => t.id === 'post_tweet')?.posts || []}
        onClose={() => setShowPosts(false)}
      />
      <InfoPopup
        open={showTwitterInfo}
        onClose={() => setShowTwitterInfo(false)}
        title="X Profile Required"
        info="Please save your X profile link in My Account first."
      />
      <InfoPopup
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Tasks"
        info="We've added new tasks!"
      />

    </div>

  );
}