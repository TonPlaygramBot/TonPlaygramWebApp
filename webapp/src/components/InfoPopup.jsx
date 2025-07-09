import React from 'react';
import { createPortal } from 'react-dom';

export default function InfoPopup({ open, onClose, title, info, children }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="prism-box p-6 space-y-4 text-text w-96 relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        {title && <h3 className="text-lg font-bold text-center">{title}</h3>}
        {info && <p className="text-sm text-subtext text-center">{info}</p>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
