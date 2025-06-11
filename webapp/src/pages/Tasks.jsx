import { useEffect, useState } from 'react';
import { listTasks, completeTask, listVideos, watchVideo } from '../utils/api.js';
import { TELEGRAM_ID } from '../utils/telegram.js';

export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [videos, setVideos] = useState(null);

  const load = async () => {
    const [taskData, videoData] = await Promise.all([
      listTasks(TELEGRAM_ID),
      listVideos(TELEGRAM_ID)
    ]);
    setTasks(taskData);
    setVideos(videoData);
  };

  useEffect(() => { load(); }, []);

  const handleComplete = async (id) => {
    await completeTask(TELEGRAM_ID, id);
    load();
  };

  const handleWatch = async (id, url) => {
    window.open(url, '_blank');
    await watchVideo(TELEGRAM_ID, id);
    load();
  };

  if (!tasks || !videos) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Tasks</h2>
      <ul className="space-y-2">
        {tasks.map(t => (
          <li key={t.id} className="border p-2 flex justify-between items-center">
            <span>{t.description}</span>
            {t.completed ? (
              <span className="text-green-600">Completed</span>
            ) : (
              <button onClick={() => handleComplete(t.id)} className="px-2 py-1 bg-blue-500 text-white rounded">Complete</button>
            )}
          </li>
        ))}
      </ul>

      <h3 className="text-lg font-semibold mt-4">Watch to Earn</h3>
      <ul className="space-y-2">
        {videos.map(v => (
          <li key={v.id} className="border p-2 flex justify-between items-center">
            <span>{v.title} ({v.reward} TPC)</span>
            {v.watched ? (
              <span className="text-green-600">Watched</span>
            ) : (
              <button onClick={() => handleWatch(v.id, v.url)} className="px-2 py-1 bg-blue-500 text-white rounded">Watch</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
