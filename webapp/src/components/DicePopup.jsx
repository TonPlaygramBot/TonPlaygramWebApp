import React from 'react';
import DiceRoller from './DiceRoller.jsx';

export default function DicePopup({ open, onClose, onRollEnd }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-5 h-5 flex items-center justify-center"
        >
          &times;
        </button>
        <div className="hex-table p-8">
          <DiceRoller onRollEnd={onRollEnd} />
        </div>
      </div>
    </div>
  );
}
