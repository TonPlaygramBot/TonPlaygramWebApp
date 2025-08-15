import React from 'react';
import TableSelector from './TableSelector.jsx';

export default function TablePopup({ open, tables, onSelect }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-6 rounded space-y-4 text-text w-80">
        <h3 className="text-lg font-bold text-center text-red-600 drop-shadow-[0_0_2px_black]">Select a Table</h3>
        <TableSelector tables={tables} selected={null} onSelect={onSelect} />
      </div>
    </div>
  );
}
