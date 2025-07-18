import React, { useState, useEffect } from 'react';
import { FLAG_EMOJIS } from '../utils/flagEmojis.js';
import { FLAG_CATEGORIES } from '../utils/flagCategories.js';

export default function FlagPickerModal({ open, onClose, count = 1, onSave, selected = [], onComplete }) {
  const continents = Object.keys(FLAG_CATEGORIES);
  const [category, setCategory] = useState(continents[0]);
  const [chosen, setChosen] = useState([]);

  useEffect(() => {
    setChosen(selected.map(i => FLAG_EMOJIS[i]));
  }, [selected, open]);

  if (!open) return null;

  const handleComplete = (selection) => {
    const indices = selection
      .map((f) => FLAG_EMOJIS.indexOf(f))
      .filter((i) => i >= 0);
    onSave(indices.slice(0, count));
    onClose();
    if (onComplete) onComplete(indices.slice(0, count));
  };

  const toggle = (flag) => {
    setChosen((prev) => {
      let next = prev;
      if (prev.includes(flag)) {
        next = prev.filter((f) => f !== flag);
      } else if (prev.length < count) {
        next = [...prev, flag];
        if (next.length === count) handleComplete(next);
      }
      return next;
    });
  };

  const confirm = () => {
    handleComplete(chosen);
  };

  const randomize = () => {
    const allFlags = Object.values(FLAG_CATEGORIES).flat();
    const random = [];
    while (random.length < count) {
      const flag = allFlags[Math.floor(Math.random() * allFlags.length)];
      if (!random.includes(flag)) random.push(flag);
    }
    handleComplete(random);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded text-center text-text w-96 max-h-[90vh] flex flex-col space-y-4">
        <h3 className="text-lg font-bold">Select your opponents</h3>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
          <div className="flex flex-wrap justify-center gap-2">
            {continents.map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`lobby-tile ${category === c ? 'lobby-selected' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {FLAG_CATEGORIES[category].map(flag => (
              <div
                key={flag}
                className={`w-12 h-12 flex items-center justify-center text-2xl cursor-pointer hover:opacity-80 ${chosen.includes(flag) ? 'ring-4 ring-accent' : ''}`}
                onClick={() => toggle(flag)}
              >
                {flag}
              </div>
            ))}
          </div>
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
