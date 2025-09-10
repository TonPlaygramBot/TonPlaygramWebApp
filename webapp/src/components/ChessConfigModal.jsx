import React from 'react';
import { createPortal } from 'react-dom';

export default function ChessConfigModal({ open, themes, onSelect, onClose }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="prism-box p-4 space-y-4 text-text w-72">
        <h2 className="text-center text-sm font-semibold">Select Theme</h2>
        <div className="space-y-2">
          {themes.map((t) => (
            <button
              key={t.name}
              onClick={() => onSelect(t)}
              className="w-full lobby-tile text-sm cursor-pointer"
            >
              {t.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full lobby-tile text-sm cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
