import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  adminListTasks,
  adminCreateTask,
  adminUpdateTask,
  adminDeleteTask
} from '../utils/api.js';

export default function DevTasksModal({ open, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [platform, setPlatform] = useState('tiktok');
  const [reward, setReward] = useState('');
  const [link, setLink] = useState('');
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const data = await adminListTasks();
    if (!data.error) setTasks(data);
  };

  useEffect(() => {
    if (open) load();
  }, [open]);

  const handleAdd = async () => {
    const r = parseInt(reward, 10);
    if (!platform || !r || !link) return;
    if (editing) {
      await adminUpdateTask(editing, platform, r, link);
    } else {
      await adminCreateTask(platform, r, link);
    }
    setPlatform('tiktok');
    setReward('');
    setLink('');
    setEditing(null);
    load();
  };

  const handleEdit = (task) => {
    setPlatform(task.platform);
    setReward(String(task.reward));
    setLink(task.link);
    setEditing(task._id);
  };

  const handleDelete = async (id) => {
    await adminDeleteTask(id);
    load();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 overflow-auto flex flex-col">
      <div className="bg-surface text-text p-4 flex-1">
        <h3 className="text-lg font-bold mb-4 text-center">Manage Tasks</h3>
        <div className="space-y-2 mb-4">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="border p-1 rounded w-full text-black"
          >
            <option value="tiktok">TikTok</option>
            <option value="x">X</option>
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
            <option value="youtube">YouTube</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          <input
            type="number"
            placeholder="Reward (TPC)"
            value={reward}
            onChange={(e) => setReward(e.target.value)}
            className="border p-1 rounded w-full text-black"
          />
          <input
            type="text"
            placeholder="Link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="border p-1 rounded w-full text-black"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-background w-full"
          >
            {editing ? 'Save Task' : 'Add Task'}
          </button>
          {editing && (
            <button
              onClick={() => {
                setEditing(null);
                setPlatform('tiktok');
                setReward('');
                setLink('');
              }}
              className="px-3 py-1 bg-red-600 text-background rounded w-full"
            >
              Cancel Edit
            </button>
          )}
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t._id} className="lobby-tile space-y-1">
              <div className="text-sm break-all">
                {t.platform} - {t.reward} TPC
              </div>
              <div className="text-xs break-all">{t.link}</div>
              <div className="flex gap-2 mt-1">
                <button
                  onClick={() => handleEdit(t)}
                  className="px-2 py-1 bg-primary hover:bg-primary-hover text-background rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(t._id)}
                  className="px-2 py-1 bg-red-600 text-background rounded text-xs"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
          {tasks.length === 0 && (
            <p className="text-center text-subtext text-sm">No tasks.</p>
          )}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded w-full"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
