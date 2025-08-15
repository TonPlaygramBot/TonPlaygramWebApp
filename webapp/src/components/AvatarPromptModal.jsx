import React from 'react';

export default function AvatarPromptModal({ open, onPick, onKeep }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80 text-center">
        <h3 className="text-lg font-bold text-red-600 drop-shadow-[0_0_2px_black]">Choose Your Avatar</h3>
        <p className="text-sm text-subtext">Would you like to pick a new avatar?</p>
        <button
          onClick={onPick}
          className="px-4 py-1 bg-primary hover:bg-primary-hover rounded w-full"
        >
          Pick Avatar
        </button>
        <button
          onClick={onKeep}
          className="px-4 py-1 border border-border bg-surface rounded w-full"
        >
          Keep Original Photo
        </button>
      </div>
    </div>
  );
}
