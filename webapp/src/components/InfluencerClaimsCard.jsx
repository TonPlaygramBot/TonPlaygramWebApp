import { useEffect, useState } from 'react';
import { listAllInfluencer, verifyInfluencer } from '../utils/api.js';

export default function InfluencerClaimsCard() {
  const [tasks, setTasks] = useState([]);
  const [views, setViews] = useState({});

  const load = async () => {
    const data = await listAllInfluencer();
    if (!data.error) setTasks(data);
  };

  useEffect(() => {
    load();
  }, []);

  const handle = async (id, status) => {
    const v = parseInt(views[id] || '0', 10);
    await verifyInfluencer(id, status, v);
    load();
  };

  return (
    <div className="prism-box p-4 mt-4 space-y-2 mx-auto wide-card">
      <h3 className="font-semibold text-center">Influencer Claims</h3>
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
    </div>
  );
}
