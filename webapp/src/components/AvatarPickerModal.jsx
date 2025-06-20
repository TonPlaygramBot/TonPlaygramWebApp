import React from 'react';

const BOY_AVATARS = [
  'https://api.dicebear.com/7.x/open-peeps/png?seed=boy1',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=boy2',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=boy3&skinColor=9b5e43',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=boy4&accessories[]=glasses',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=boy5'
];

const GIRL_AVATARS = [
  'https://api.dicebear.com/7.x/open-peeps/png?seed=girl1',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=girl2',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=girl3&skinColor=9b5e43',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=girl4&accessories[]=glasses',
  'https://api.dicebear.com/7.x/open-peeps/png?seed=girl5'
];

export default function AvatarPickerModal({ open, onClose, onSelect }) {
  if (!open) return null;

  const renderRow = (avatars) => (
    <div className="flex justify-center space-x-2">
      {avatars.map((src) => (
        <img
          key={src}
          src={src}
          alt="avatar"
          className="w-20 h-20 rounded-full cursor-pointer hover:opacity-80"
          onClick={() => onSelect(src)}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-center text-text">
        <h3 className="text-lg font-bold">Pick a Profile Avatar</h3>
        <div>
          <p className="font-semibold mb-1">Boys</p>
          {renderRow(BOY_AVATARS)}
        </div>
        <div>
          <p className="font-semibold mb-1 mt-2">Girls</p>
          {renderRow(GIRL_AVATARS)}
        </div>
        <button onClick={onClose} className="mt-4 px-4 py-1 bg-primary hover:bg-primary-hover rounded w-full">
          Close
        </button>
      </div>
    </div>
  );
}
