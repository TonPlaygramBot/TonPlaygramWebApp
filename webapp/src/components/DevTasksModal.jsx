import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  adminListTasks,
  adminCreateTask,
  adminUpdateTask,
  adminDeleteTask
} from '../utils/api.js';
import { normalizeTasksResponse } from '../utils/taskUtils.js';
import { FiEdit, FiTrash2, FiRefreshCw, FiVideo } from 'react-icons/fi';

const defaultForm = {
  section: 'tasks',
  platform: 'tiktok',
  reward: '',
  link: '',
  description: '',
  videoProvider: 'none',
  videoDurationSec: '30'
};

const MINING_AREAS = [
  { key: 'daily_streaks', label: 'Daily Streaks' },
  { key: 'spin_and_win', label: 'Spin and Win' },
  { key: 'lucky_card', label: 'Lucky Card' },
  { key: 'roulette_spin', label: 'Roulette Spin' }
];

export default function DevTasksModal({ open, onClose, initialSection = 'tasks' }) {
  const [tasks, setTasks] = useState([]);
  const [editing, setEditing] = useState(null);
  const [activeSection, setActiveSection] = useState('tasks');
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [miningLinks, setMiningLinks] = useState({});
  const [miningSaving, setMiningSaving] = useState('');

  const load = async () => {
    const data = await adminListTasks();
    if (!data.error) setTasks(normalizeTasksResponse(data));
  };

  useEffect(() => {
    if (open) {
      setActiveSection(initialSection || 'tasks');
      resetForm(initialSection || 'tasks');
      load();
    }
  }, [open, initialSection]);

  useEffect(() => {
    const next = {};
    for (const area of MINING_AREAS) {
      const task = tasks.find((t) => (t.section || 'tasks') === 'mining' && t.miningArea === area.key);
      next[area.key] = task?.link || '';
    }
    setMiningLinks(next);
  }, [tasks]);

  const visibleTasks = useMemo(
    () => tasks.filter((t) => (t.section || 'tasks') === activeSection),
    [tasks, activeSection]
  );

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = (section = activeSection) => {
    setEditing(null);
    setForm({ ...defaultForm, section });
  };

  const parseVideoProvider = (link = '') => {
    if (/youtube\.com|youtu\.be/i.test(link)) return 'youtube';
    if (/tiktok\.com/i.test(link)) return 'tiktok';
    return 'none';
  };

  const handleSave = async () => {
    const rewardInt = parseInt(form.reward, 10);
    if (!form.platform || !rewardInt || !form.link || !form.description) return;

    const payload = {
      platform: form.platform,
      reward: rewardInt,
      link: form.link.trim(),
      description: form.description.trim(),
      section: form.section,
      videoProvider: form.videoProvider === 'none' ? null : form.videoProvider,
      videoDurationSec:
        form.videoProvider === 'none' ? 0 : Math.max(5, Number(form.videoDurationSec) || 30)
    };

    setSaving(true);
    try {
      if (editing) {
        await adminUpdateTask({ id: editing, ...payload });
      } else {
        await adminCreateTask(payload);
      }
      resetForm(form.section);
      await load();
      window.dispatchEvent(new Event('tasksUpdated'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMiningLink = async (areaKey) => {
    const link = (miningLinks[areaKey] || '').trim();
    if (!link) return;

    const existing = tasks.find(
      (t) => (t.section || 'tasks') === 'mining' && t.miningArea === areaKey
    );

    const payload = {
      platform: parseVideoProvider(link) === 'youtube' ? 'youtube' : 'tiktok',
      reward: 0,
      link,
      description: `${MINING_AREAS.find((a) => a.key === areaKey)?.label || 'Mining'} video`,
      section: 'mining',
      miningArea: areaKey,
      videoProvider: parseVideoProvider(link) === 'none' ? null : parseVideoProvider(link),
      videoDurationSec: 30
    };

    setMiningSaving(areaKey);
    try {
      if (existing?._id) {
        await adminUpdateTask({ id: existing._id, ...payload });
      } else {
        await adminCreateTask(payload);
      }
      await load();
      window.dispatchEvent(new Event('tasksUpdated'));
    } finally {
      setMiningSaving('');
    }
  };

  const handleEdit = (task) => {
    const section = task.section || 'tasks';
    setActiveSection(section);
    setEditing(task._id);
    setForm({
      section,
      platform: task.platform || 'tiktok',
      reward: String(task.reward || ''),
      link: task.link || '',
      description: task.description || '',
      videoProvider: task.videoProvider || parseVideoProvider(task.link || ''),
      videoDurationSec: String(task.videoDurationSec || 30)
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    await adminDeleteTask(id);
    await load();
    window.dispatchEvent(new Event('tasksUpdated'));
  };

  const isMiningSection = activeSection === 'mining';

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/75 z-50 overflow-auto">
      <div className="min-h-full w-full max-w-3xl mx-auto bg-surface text-text p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 sticky top-0 bg-surface py-1 z-10">
          <h3 className="text-base sm:text-lg font-bold">Developer Task Manager</h3>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-primary hover:bg-primary-hover text-background text-sm"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {[
            { key: 'tasks', label: 'Tasks page' },
            { key: 'mining', label: 'Mining page' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => {
                setActiveSection(item.key);
                resetForm(item.key);
              }}
              className={`px-3 py-2 rounded border text-sm font-semibold ${
                activeSection === item.key
                  ? 'bg-primary text-background border-primary'
                  : 'bg-background/60 border-border text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isMiningSection ? (
          <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FiVideo className="w-4 h-4" /> Mining video links by section
            </p>
            <p className="text-xs text-subtext">
              Rewards are already handled in the mining modules. Here you only attach one video link per section.
            </p>

            <div className="space-y-2">
              {MINING_AREAS.map((area) => (
                <div key={area.key} className="rounded-lg border border-border bg-surface/40 p-2.5 space-y-2">
                  <label className="text-sm font-semibold text-white">{area.label}</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="YouTube or TikTok link"
                      value={miningLinks[area.key] || ''}
                      onChange={(e) =>
                        setMiningLinks((prev) => ({ ...prev, [area.key]: e.target.value }))
                      }
                      className="border p-2 rounded w-full text-black"
                    />
                    <button
                      onClick={() => handleSaveMiningLink(area.key)}
                      disabled={miningSaving === area.key}
                      className="px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold disabled:opacity-60"
                    >
                      {miningSaving === area.key ? 'Saving...' : 'Save link'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-background/60 p-3 space-y-2">
              <p className="text-sm font-semibold text-white">
                {editing ? 'Edit task' : 'Create new task'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={form.platform}
                  onChange={(e) => updateForm('platform', e.target.value)}
                  className="border p-2 rounded w-full text-black"
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
                  value={form.reward}
                  onChange={(e) => updateForm('reward', e.target.value)}
                  className="border p-2 rounded w-full text-black"
                />
              </div>

              <input
                type="text"
                placeholder="Task link"
                value={form.link}
                onChange={(e) => updateForm('link', e.target.value)}
                className="border p-2 rounded w-full text-black"
              />

              <input
                type="text"
                placeholder="Description"
                value={form.description}
                onChange={(e) => updateForm('description', e.target.value)}
                className="border p-2 rounded w-full text-black"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background w-full text-sm font-semibold disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing ? 'Save Task' : 'Add Task'}
                </button>
                <button
                  onClick={() => resetForm(activeSection)}
                  className="px-3 py-2 bg-background border border-border rounded text-white w-full text-sm"
                >
                  Reset
                </button>
                <button
                  onClick={load}
                  className="px-3 py-2 bg-background border border-border rounded text-white w-full text-sm inline-flex items-center justify-center gap-1"
                >
                  <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
            </div>

            <ul className="space-y-2 pb-6">
              {visibleTasks.map((t) => (
                <li key={t._id} className="rounded-lg border border-border bg-background/60 p-2.5 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white break-words">{t.description}</p>
                    <span className="text-[11px] uppercase rounded bg-primary/15 text-primary px-2 py-0.5 shrink-0">
                      {t.platform}
                    </span>
                  </div>
                  <div className="text-xs text-subtext break-all">{t.link}</div>
                  <div className="flex items-center gap-2 text-xs text-subtext">
                    <span>{t.reward} TPC</span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      className="px-2 py-1 rounded bg-primary/20 text-primary inline-flex items-center gap-1"
                      onClick={() => handleEdit(t)}
                    >
                      <FiEdit className="w-4 h-4" /> Edit
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-red-500/20 text-red-300 inline-flex items-center gap-1"
                      onClick={() => handleDelete(t._id)}
                    >
                      <FiTrash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>
                </li>
              ))}
              {visibleTasks.length === 0 && (
                <p className="text-center text-subtext text-sm py-2">No tasks in this section.</p>
              )}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
