import React from 'react';
import { createPortal } from 'react-dom';

export default function InfoPopup({
  open,
  onClose,
  title,
  info,
  children,
  widthClass = 'w-11/12 max-w-sm sm:w-96'
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div
        className={`prism-box p-6 space-y-4 text-text relative max-h-[90vh] overflow-y-auto ${widthClass}`}
      >
        {title && <h3 className="text-lg font-bold text-center">{title}</h3>}
        {info && <p className="text-sm text-subtext text-center">{info}</p>}
        {children}
        <button
          onClick={onClose}
          className="mx-auto block px-3 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow"
        >
          Close
        </button>
      </div>
    </div>,
    document.body
  );
}
