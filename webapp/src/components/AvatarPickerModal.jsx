import React, { useState } from 'react';
import { FLAG_EMOJIS } from '../utils/flagEmojis.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

// Avatars are limited to flag emojis only
export const AVATARS = [...FLAG_EMOJIS];

export default function AvatarPickerModal({ open, onClose, onSave }) {
  const [selected, setSelected] = useState(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-center text-text">
        <h3 className="text-lg font-bold">Pick a Profile Avatar</h3>
        <div className="flex flex-wrap justify-center gap-2 max-h-60 overflow-auto">
          {AVATARS.map((src) => (
            <div
              key={src}
              className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 ${selected === src ? 'ring-4 ring-accent' : ''}`}
              onClick={() => setSelected(src)}
            >
              <img
                src={getAvatarUrl(src)}
                alt="avatar"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
          ))}
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              if (selected) onSave(selected);
            }}
            disabled={!selected}
            className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
          >
            Save
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-1 border border-border bg-surface rounded">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
