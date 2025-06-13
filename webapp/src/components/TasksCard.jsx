import { useEffect, useState } from 'react';
import { listTasks, completeTask } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import { IoLogoTwitter, IoLogoTiktok } from 'react-icons/io5';
import { RiTelegramFill } from 'react-icons/ri';

const ICONS = {
  join_twitter: <IoLogoTwitter className="text-sky-400 w-5 h-5" />,
  join_telegram: <RiTelegramFill className="text-sky-400 w-5 h-5" />,
  follow_tiktok: <IoLogoTiktok className="text-pink-500 w-5 h-5" />
};

export default function TasksCard() {
  const [tasks, setTasks] = useState(null);

  const load = async () => {
    const data = await listTasks(getTelegramId());
    setTasks(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleClaim = async (task) => {
    window.open(task.link, '_blank');
    await completeTask(getTelegramId(), task.id);
    load();
  };

  if (!tasks) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 text-subtext text-center">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
      <h3 className="text-lg font-bold text-text text-center">Tasks</h3>
      <ul className="space-y-2">
        {tasks.map((t) => (
          <li
            key={t.id}
            className="flex justify-between items-center"
          >
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
                className="px-2 py-0.5 bg-primary hover:bg-primary-hover text-text text-sm rounded"
              >
                Claim
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
