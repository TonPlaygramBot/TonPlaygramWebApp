import React from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmPopup({ open, message, onConfirm, onCancel }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 space-y-4 text-text w-80 relative">
        <button
          onClick={() => {
            if (window.confirm('Are you sure you want to close?')) {
              onCancel();
            }
          }}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        <p className="text-sm text-center">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 lobby-tile text-sm cursor-pointer"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 lobby-tile text-sm cursor-pointer"
          >
            No
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
