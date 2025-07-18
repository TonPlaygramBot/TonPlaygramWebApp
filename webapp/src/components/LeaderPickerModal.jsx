import React, { useState, useEffect } from 'react';
import { LEADER_AVATARS } from '../utils/leaderAvatars.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function LeaderPickerModal({ open, onClose, count = 1, onSave, selected = [] }) {
  const [chosen, setChosen] = useState(selected);

  useEffect(() => {
    setChosen(selected);
  }, [selected, open]);

  if (!open) return null;

  const toggle = (src) => {
    setChosen((prev) => {
      if (prev.includes(src)) return prev.filter((s) => s !== src);
      if (prev.length >= count) return prev;
      return [...prev, src];
    });
  };

  const confirm = () => {
    onSave(chosen.slice(0, count));
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-center text-text w-96 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold">Select your opponents</h3>
        <div className="flex flex-wrap justify-center gap-2">
          {LEADER_AVATARS.map((src) => (
            <div
              key={src}
              className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 ${chosen.includes(src) ? 'ring-4 ring-accent' : ''}`}
              onClick={() => toggle(src)}
            >
              <img src={getAvatarUrl(src)} alt="leader" className="w-full h-full rounded-full object-cover" />
            </div>
          ))}
        </div>
        <button
          onClick={confirm}
          disabled={chosen.length !== count}
          className="w-full px-4 py-1 bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
