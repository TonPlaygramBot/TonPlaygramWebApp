import { useEffect, useState } from 'react';

import {
  listTasks,
  completeTask,
  verifyPost,
  verifyTelegramReaction,
  getAdStatus,
  watchAd,
  getQuestStatus,
  completeQuest,
  getProfile,
  dailyCheckIn,
  submitInfluencerVideo,
  myInfluencerVideos,
} from '../utils/api.js';
import { normalizeTasksResponse } from '../utils/taskUtils.js';

import { getTelegramId, parseTelegramPostLink } from '../utils/telegram.js';
import LoginOptions from '../components/LoginOptions.jsx';

import { IoLogoTiktok } from 'react-icons/io5';

import { RiTelegramFill } from 'react-icons/ri';
import { FiVideo, FiLink } from 'react-icons/fi';
import { FaDiscord, FaYoutube, FaFacebook, FaInstagram } from 'react-icons/fa';
import { AiOutlineCheck } from 'react-icons/ai';
import AdModal from '../components/AdModal.tsx';
import PostsModal from '../components/PostsModal.jsx';
import InfoPopup from '../components/InfoPopup.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

const REWARDS = Array.from({ length: 30 }, (_, i) => 100 + i * 20);
const INFLUENCER_REWARDS = [
  { range: '0 – 149', reward: 0, notes: 'Below threshold' },
  { range: '150 – 2,999', reward: 900, notes: 'Entry-level reward' },
  { range: '3,000 – 7,999', reward: 2700, notes: 'Small creator range' },
  { range: '8,000 – 14,999', reward: 5400, notes: 'Medium growth videos' },
  { range: '15,000 – 29,999', reward: 10500, notes: 'Strong organic reach' },
  { range: '30,000 – 99,999', reward: 24000, notes: 'Viral tier' },
  { range: '100,000+', reward: 60000, notes: 'Top influencer bonus tier' },
];
const ONE_DAY = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export default function Tasks() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [tasks, setTasks] = useState(null);
  const [adCount, setAdCount] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [showQuestAd, setShowQuestAd] = useState(false);
  const [questTime, setQuestTime] = useState(0);
  const [showPosts, setShowPosts] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showTwitterInfo, setShowTwitterInfo] = useState(false);
  const [profile, setProfile] = useState(null);
  const [postLink, setPostLink] = useState('');
  const [category, setCategory] = useState('TonPlaygram');
  const [infTab, setInfTab] = useState('submit');
  const [platform, setPlatform] = useState('tiktok');
  const [videoUrl, setVideoUrl] = useState('');
  const [myVideos, setMyVideos] = useState([]);
  const [streak, setStreak] = useState(1);
  const [lastCheck, setLastCheck] = useState(() => {
    const ts = localStorage.getItem('lastCheckIn');
    return ts ? parseInt(ts, 10) : null;
  });

  const load = async () => {
    const data = await listTasks(telegramId);
    const tasksList = normalizeTasksResponse(data);
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
    const quest = await getQuestStatus(telegramId);
    if (!quest.error) setQuestTime(quest.remaining || 0);
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

  const loadInfluencer = async () => {
    const vids = await myInfluencerVideos(telegramId);
    if (!vids.error) setMyVideos(vids);
  };

  useEffect(() => {
    load();
    loadInfluencer();
    const handler = () => load();
    window.addEventListener('tasksUpdated', handler);
    return () => window.removeEventListener('tasksUpdated', handler);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setQuestTime((t) => (t > 1000 ? t - 1000 : 0));
      setTasks((list) =>
        list
          ? list.map((task) =>
              task.cooldown
                ? {
                    ...task,
                    cooldown: task.cooldown > 1000 ? task.cooldown - 1000 : 0,
                    completed: task.cooldown > 1000
                  }
                : task
            )
          : list
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleClaim = async (task) => {
    if (['join_twitter', 'engage_tweet'].includes(task.id) && !profile?.social?.twitter) {
      setShowTwitterInfo(true);
      return;
    }
    if (task.link) {
      window.open(task.link, '_blank');
    }
    if (task.id.startsWith('react_tg_post')) {
      const { messageId, threadId } = parseTelegramPostLink(task.link || '');
      const res = await verifyTelegramReaction(telegramId, messageId, threadId);
      if (res.error || !res.reacted) {
        alert(res.error || 'Reaction not verified');
        return;
      }
    }
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


  const handlePostVerify = async () => {
    if (!postLink) return;
    if (!profile?.social?.twitter) {
      setShowTwitterInfo(true);
      return;
    }
    const res = await verifyPost(telegramId, postLink);
    if (!res.error) {
      setPostLink('');
      load();
    } else {
      alert(res.error);
    }
  };

  const handleAdComplete = async () => {
    await watchAd(telegramId);
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
    setShowAd(false);
  };

  const handleQuestComplete = async () => {
    await completeQuest(telegramId);
    setQuestTime(HOUR_MS);
    setShowQuestAd(false);
  };

  const formatTime = (ms) => {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const hh = h > 0 ? `${h.toString().padStart(2, '0')}:` : '';
    return `${hh}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleVideoSubmit = async () => {
    if (!videoUrl) return;
    await submitInfluencerVideo(telegramId, platform, videoUrl);
    setVideoUrl('');
    loadInfluencer();
  };

  if (!tasks) return <div className="p-4 text-subtext">Loading...</div>;

  const xIcon = (
    <img
      src="/assets/icons/new-twitter-x-logo-twitter-icon-x-social-media-icon-free-png.webp"
      alt="X"
      className="w-5 h-5"
    />
  );

  const ICONS = {
    join_twitter: xIcon,
    join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
    follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_1: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_2: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_3: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_4: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_5: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    boost_tiktok_6: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    post_tweet: xIcon,
    react_tg_post: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
    react_tg_post_2: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
    engage_tweet: xIcon,
    watch_ad: <FiVideo className="text-yellow-500 w-5 h-5" />,
    tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
    x: xIcon,
    telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
    discord: <FaDiscord className="text-indigo-500 w-5 h-5" />,
    youtube: <FaYoutube className="text-red-600 w-5 h-5" />,
    facebook: <FaFacebook className="text-blue-600 w-5 h-5" />,
    instagram: <FaInstagram className="text-pink-400 w-5 h-5" />
  };

  return (

    <div className="relative p-4 space-y-2 text-text flex flex-col items-center wide-card">
      <h2 className="text-xl font-bold">Tasks</h2>
      <div className="flex justify-center space-x-2">
        {['TonPlaygram', 'Influencer', 'Partners'].map((c) => (
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
              <li className="lobby-tile w-full">
                <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
                  <AiOutlineCheck className="w-5 h-5 text-accent" />
                  <span className="text-sm">Daily Check-In</span>
                  <span className="text-xs text-subtext flex items-center gap-1">{REWARDS[streak - 1]} <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></span>
                  {lastCheck && Date.now() - lastCheck < ONE_DAY ? (
                    <span className="text-green-500 font-semibold text-sm">Completed</span>
                  ) : (
                    <button
                      onClick={handleDailyCheck}
                      className="px-2 py-1 bg-primary hover:bg-primary-hover text-white-shadow text-sm rounded"
                    >
                      Claim
                    </button>
                  )}
                </div>
              </li>
          {tasks.map((t) => (
            <li key={t.id} className="lobby-tile w-full">
              <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
                {ICONS[t.id] || ICONS[t.icon] || <FiLink className="w-5 h-5" />}
                <span className="text-sm">{t.description}</span>
                <span className="text-xs text-subtext flex items-center gap-1">{t.reward} <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></span>
                {t.completed && t.id === 'post_tweet' && t.cooldown > 0 ? (
                  <span className="text-sm text-subtext">{formatTime(t.cooldown)}</span>
                ) : t.completed ? (
                  <span className="text-green-500 font-semibold text-sm">Completed</span>
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
                        placeholder="X post link"
                        className="px-1 py-0.5 text-xs bg-surface border border-border rounded flex-1"
                      />
                      <button onClick={handlePostVerify} className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded">Verify</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaim(t)}
                    className="px-2 py-1 bg-primary hover:bg-primary-hover text-white-shadow text-sm rounded"
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
              <span className="text-xs text-subtext flex items-center gap-1">50 <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></span>
              {adCount >= 5 ? (
                <span className="text-green-500 font-semibold text-sm">Completed</span>
              ) : (
                <button
                  onClick={() => setShowAd(true)}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-white-shadow text-sm rounded"
                >
                  Watch
                </button>
              )}
            </div>
          </li>
          <li className="lobby-tile w-full">
            <div className="grid grid-cols-[20px_1fr_auto_auto] items-center gap-2 w-full">
              {ICONS.watch_ad}
              <span className="text-sm">Advertising Quest</span>
              <span className="text-xs text-subtext flex items-center gap-1">200 <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></span>
              {questTime > 0 ? (
                <span className="text-sm text-subtext">{formatTime(questTime)}</span>
              ) : (
                <button
                  onClick={() => setShowQuestAd(true)}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-white-shadow text-sm rounded"
                >
                  Watch
                </button>
              )}
            </div>
          </li>
      </ul>
        </>
      )}
      {category === 'Influencer' && (
        <div className="w-full space-y-2">
          <div className="flex justify-center space-x-2">
            {['submit', 'mine'].map((t) => (
              <button
                key={t}
                onClick={() => setInfTab(t)}
                className={`lobby-tile px-3 py-1 ${infTab === t ? 'lobby-selected' : ''}`}
              >
                {t === 'submit' ? 'Submit Video' : 'My Submissions'}
              </button>
            ))}
          </div>
          {infTab === 'submit' && (
            <div className="space-y-2">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full px-2 py-1 bg-surface border border-border rounded"
              >
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube Shorts</option>
                <option value="instagram">Instagram Reels</option>
              </select>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Video URL"
                className="w-full px-2 py-1 bg-surface border border-border rounded"
              />
              <button
                onClick={handleVideoSubmit}
                className="w-full px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded"
              >
                Submit
              </button>
              <table className="w-full text-xs text-center mt-2 border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1">Views Range</th>
                    <th className="py-1 flex items-center justify-center gap-1">Reward <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></th>
                    <th className="py-1">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {INFLUENCER_REWARDS.map((r) => (
                    <tr key={r.range} className="border-b border-border last:border-0">
                      <td className="py-1">{r.range}</td>
                      <td className="py-1 flex items-center justify-center gap-1">{r.reward.toLocaleString()} <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></td>
                      <td className="py-1">{r.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {infTab === 'mine' && (
            <ul className="space-y-2">
              {myVideos.map((s) => (
                <li key={s._id} className="lobby-tile w-full space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{s.platform}</span>
                    <span>{s.views ? s.views + ' views' : 'pending'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Status: {s.status}</span>
                    <span className="flex items-center gap-1">{s.rewardTPC.toLocaleString()} <img src="/assets/icons/ezgif-54c96d8a9b9236.webp" alt="TPC" className="w-4 h-4" /></span>
                  </div>
                </li>
              ))}
              {myVideos.length === 0 && (
                <p className="text-center text-subtext text-sm">No submissions yet.</p>
              )}
            </ul>
          )}
        </div>
      )}
      {category === 'Partners' && (
        <p className="text-center text-subtext">Partner tasks coming soon.</p>
      )}
      <AdModal
        open={showAd}
        onComplete={handleAdComplete}
        onClose={() => setShowAd(false)}
      />
      <AdModal
        open={showQuestAd}
        onComplete={handleQuestComplete}
        onClose={() => setShowQuestAd(false)}
      />
      <PostsModal
        open={showPosts}
        posts={tasks?.find((t) => t.id === 'post_tweet')?.posts || []}
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
