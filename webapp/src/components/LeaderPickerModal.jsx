import React, { useState, useEffect } from 'react';
import { LEADER_AVATARS, LEADER_NAMES } from '../utils/leaderAvatars.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function LeaderPickerModal({ open, onClose, count = 1, onSave, selected = [], onComplete }) {
  const [chosen, setChosen] = useState(selected);

  useEffect(() => {
    setChosen(selected);
  }, [selected, open]);

  if (!open) return null;

  const handleComplete = (selection) => {
    onSave(selection.slice(0, count));
    onClose();
    if (onComplete) onComplete(selection.slice(0, count));
  };

  const toggle = (src) => {
    setChosen((prev) => {
      let next = prev;
      if (prev.includes(src)) {
        next = prev.filter((s) => s !== src);
      } else if (prev.length < count) {
        next = [...prev, src];
        if (next.length === count) handleComplete(next);
      }
      return next;
    });
  };

  const confirm = () => {
    handleComplete(chosen);
  };

  const randomize = () => {
    const random = [];
    while (random.length < count) {
      const leader = LEADER_AVATARS[Math.floor(Math.random() * LEADER_AVATARS.length)];
      if (!random.includes(leader)) random.push(leader);
    }
    handleComplete(random);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded text-center text-text w-96 max-h-[90vh] flex flex-col space-y-4">
        <h3 className="text-lg font-bold">Select your opponents</h3>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-wrap justify-center gap-2">
          {LEADER_AVATARS.map((src, i) => (
            <div key={src} className="flex flex-col items-center w-20">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 ${chosen.includes(src) ? 'ring-4 ring-accent' : ''}`}
                onClick={() => toggle(src)}
              >
                <img src={getAvatarUrl(src)} alt="leader" className="w-full h-full rounded-full object-cover" />
              </div>
              <span className="text-xs mt-1 text-center whitespace-nowrap">{LEADER_NAMES[i]}</span>
            </div>
          ))}
        </div>
        <div className="flex space-x-2 pt-2 mt-auto">
          <button
            onClick={confirm}
            disabled={chosen.length !== count}
            className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover text-background rounded disabled:opacity-50"
          >
            Confirm
          </button>
          <button
            onClick={randomize}
            className="flex-1 px-4 py-1 border border-border bg-surface rounded"
          >
            Quick Play
          </button>
        </div>
      </div>
    </div>
  );
}
