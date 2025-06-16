import React from 'react';

export default function InfoPopup({ open, onClose, title, info }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80 relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        {title && <h3 className="text-lg font-bold text-center">{title}</h3>}
        {info && <p className="text-sm text-subtext text-center">{info}</p>}
      </div>
    </div>
  );
}
