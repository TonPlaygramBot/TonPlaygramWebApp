import React from 'react';
import TableSelector from './TableSelector.jsx';

export default function TablePopup({ open, tables, onSelect, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            &times;
          </button>
        )}
        <img
          src="/assets/icons/TonPlayGramLogo.webp"
          alt="TonPlaygram Logo"
          className="w-10 h-10 mx-auto"
        />
        <h3 className="text-lg font-bold text-center">Select a Table</h3>
        <TableSelector tables={tables} selected={null} onSelect={onSelect} />
      </div>
    </div>
  );
}
