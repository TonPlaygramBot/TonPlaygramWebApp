import { useEffect, useState } from 'react';

import { listTasks, completeTask, getAdStatus, watchAd } from '../utils/api.js';

import { getTelegramId } from '../utils/telegram.js';
import LoginOptions from './LoginOptions.jsx';

import { IoLogoTwitter, IoLogoTiktok } from 'react-icons/io5';

import { RiTelegramFill } from 'react-icons/ri';
import { FiVideo } from 'react-icons/fi';
import AdModal from './AdModal.tsx';
import { AiOutlineCheckSquare } from 'react-icons/ai';

const ICONS = {

  join_twitter: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,

  join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,

  follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />,
  watch_ad: <FiVideo className="text-yellow-500 w-5 h-5" />

};

export default function TasksCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return (
      <div className="bg-surface border border-border rounded-xl">
        <LoginOptions />
      </div>
    );
  }

  const [tasks, setTasks] = useState(null);
  const [adCount, setAdCount] = useState(0);
  const [showAd, setShowAd] = useState(false);

  const load = async () => {
    const data = await listTasks(telegramId);
    setTasks(data);
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
  };

  useEffect(() => {

    load();

  }, []);

  const handleClaim = async (task) => {

    window.open(task.link, '_blank');

    await completeTask(telegramId, task.id);

    load();

  };

  const handleAdComplete = async () => {
    await watchAd(telegramId);
    const ad = await getAdStatus(telegramId);
    if (!ad.error) setAdCount(ad.count);
    setShowAd(false);
  };

  if (!tasks) {

    return (

      <div className="bg-surface border border-border rounded-xl p-4 text-subtext text-center">

        Loading tasks...

      </div>

    );

  }

  return (

    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        aria-hidden="true"
        loading="lazy"
      />

      <h3 className="text-lg font-bold text-text flex items-center justify-center space-x-1"><AiOutlineCheckSquare className="text-accent" /><span>Tasks</span></h3>

      <ul className="space-y-2">

        {tasks.map((t) => (

          <li key={t.id} className="lobby-tile w-full flex justify-between items-center">

            <div className="flex items-center space-x-2 text-sm">

              {ICONS[t.id]}

              <span>{t.description}</span>

              <span className="text-xs text-subtext">{t.reward} TPC</span>

            </div>

            {t.completed ? (

              <span className="text-accent font-semibold text-sm">Done</span>

            ) : (

              <button

                onClick={() => handleClaim(t)}

                  className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"

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
            <span className="text-xs text-subtext">100 TPC</span>
          </div>
          {adCount >= 10 ? (
            <span className="text-accent font-semibold text-sm">Done</span>
          ) : (
            <button
              onClick={() => setShowAd(true)}
              className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-background text-sm rounded"
            >
              Watch
            </button>
          )}
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