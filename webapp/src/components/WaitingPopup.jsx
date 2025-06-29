import React from 'react';
import { createPortal } from 'react-dom';

export default function WaitingPopup({ open, message }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 text-text w-80">
        <p className="text-sm text-center">{message}</p>
      </div>
    </div>,
    document.body,
  );
}
