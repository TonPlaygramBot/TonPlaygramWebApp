import React from 'react';

export default function ConfirmPopup({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 space-y-4 text-text w-80">
        <p className="text-sm text-center">{message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onConfirm} className="flex-1 lobby-tile text-sm">
            Yes
          </button>
          <button type="button" onClick={onCancel} className="flex-1 lobby-tile text-sm">
            No
          </button>
        </div>
      </div>
    </div>
  );
}
