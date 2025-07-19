import React from 'react';
import { createPortal } from 'react-dom';

export default function GameEndPopup({
  open,
  ranking,
  onPlayAgain,
  onReturn,
  onClose
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
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
        <h3 className="text-lg font-bold text-center">Game Over</h3>
        <ol className="list-decimal list-inside space-y-1 text-center">
          {ranking.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button
            onClick={onPlayAgain}
            className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded"
          >
            Play Again
          </button>
          <button
            onClick={onReturn}
            className="flex-1 px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded"
          >
            Return to Lobby
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
