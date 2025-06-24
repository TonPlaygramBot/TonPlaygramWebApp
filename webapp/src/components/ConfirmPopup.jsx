import React from 'react';

export default function ConfirmPopup({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80">
        <p className="text-sm text-center">{message}</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded">
            Yes
          </button>
          <button onClick={onCancel} className="flex-1 px-4 py-1 border border-border bg-surface rounded">
            No
          </button>
        </div>
      </div>
    </div>
  );
}
