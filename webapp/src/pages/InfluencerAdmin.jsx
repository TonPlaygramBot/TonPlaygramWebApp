import { useEffect, useState, useRef } from 'react';
import { listAllInfluencer, verifyInfluencer } from '../utils/api.js';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { socket } from '../utils/socket.js';
import InfoPopup from '../components/InfoPopup.jsx';
import { isGameMuted, getGameVolume } from '../utils/sound.js';

export default function InfluencerAdmin() {
  useTelegramBackButton();
  const [tasks, setTasks] = useState([]);
  const [views, setViews] = useState({});
  const [notif, setNotif] = useState('');
  const beepRef = useRef(null);

  const load = async () => {
    const data = await listAllInfluencer();
    if (!data.error) setTasks(data);
  };

  useEffect(() => {
    load();
    beepRef.current = new Audio('/assets/sounds/successful.mp3');
    beepRef.current.volume = getGameVolume();
    beepRef.current.muted = isGameMuted();
    const onNew = ({ videoUrl, platform }) => {
      setNotif(`New ${platform} submission: ${videoUrl}`);
      if (beepRef.current && !isGameMuted()) {
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => {});
      }
      load();
    };
    socket.on('influencerSubmit', onNew);
    return () => {
      socket.off('influencerSubmit', onNew);
      beepRef.current?.pause();
    };
  }, []);

  const handle = async (id, status) => {
    const v = parseInt(views[id] || '0', 10);
    await verifyInfluencer(id, status, v);
    load();
  };

  return (
    <div className="p-4 space-y-2 text-text flex flex-col items-center wide-card">
      <h2 className="text-xl font-bold">Influencer Admin</h2>
      <ul className="space-y-2 w-full">
        {tasks.map((t) => (
          <li key={t._id} className="lobby-tile space-y-2">
            <div className="text-sm break-all">{t.videoUrl}</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Views"
                value={views[t._id] || ''}
                onChange={(e) => setViews({ ...views, [t._id]: e.target.value })}
                className="px-2 py-1 text-xs bg-surface border border-border rounded"
              />
              <button
                onClick={() => handle(t._id, 'approved')}
                className="px-2 py-1 bg-primary hover:bg-primary-hover text-background rounded"
              >
                Approve
              </button>
              <button
                onClick={() => handle(t._id, 'rejected')}
                className="px-2 py-1 bg-red-600 text-background rounded"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
        {tasks.length === 0 && (
          <p className="text-center text-subtext text-sm">No submissions.</p>
        )}
      </ul>
      <InfoPopup
        open={!!notif}
        onClose={() => setNotif('')}
        info={notif}
      />
    </div>
  );
}
