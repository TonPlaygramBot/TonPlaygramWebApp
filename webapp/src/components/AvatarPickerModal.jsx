import React from 'react';

// Use DiceBear's adventurer-neutral SVG avatars which are gender-neutral
// and small text-based files instead of binary PNG images.
const AVATARS = [
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=avatar1',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=avatar2',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=avatar3',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=avatar4',
  'https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=avatar5'
];

export default function AvatarPickerModal({ open, onClose, onSelect }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-center text-text">
        <h3 className="text-lg font-bold">Pick a Profile Avatar</h3>
        <div className="flex justify-center space-x-2">
          {AVATARS.map((src) => (
            <img
              key={src}
              src={src}
              alt="avatar"
              className="w-20 h-20 rounded-full cursor-pointer hover:opacity-80"
              onClick={() => onSelect(src)}
            />
          ))}
        </div>
        <button onClick={onClose} className="mt-4 px-4 py-1 bg-primary hover:bg-primary-hover rounded w-full">
          Close
        </button>
      </div>
    </div>
  );
}
