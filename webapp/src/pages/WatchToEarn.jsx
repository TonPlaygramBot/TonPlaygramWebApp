import { useEffect, useState } from 'react';
import { listVideos, watchVideo } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function WatchToEarn() {
  const [videos, setVideos] = useState(null);

  const load = async () => {
    const data = await listVideos(getTelegramId());
    setVideos(data);
  };

  useEffect(() => { load(); }, []);

  const handleWatch = async (id, url) => {
    window.open(url, '_blank');
    await watchVideo(getTelegramId(), id);
    load();
  };

  if (!videos) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-xl font-bold">Watch to Earn</h2>
      <ul className="space-y-2">
        {videos.map(v => (
          <li key={v.id} className="border p-2 flex justify-between items-center">
            <span>{v.title} ({v.reward} TPC)</span>
            {v.watched ? (
              <span className="text-green-600">Watched</span>
            ) : (
              <button onClick={() => handleWatch(v.id, v.url)} className="px-2 py-1 bg-primary text-text rounded">Watch</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
