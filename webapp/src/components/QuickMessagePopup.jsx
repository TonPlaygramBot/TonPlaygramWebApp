import { useState } from 'react';
import { createPortal } from 'react-dom';

const MESSAGES = [
  'Nice bro 😀',
  'Well done 👍',
  "You're lucky 🍀",
  "You're cute 😊",
  "You're beautiful 😍",
  'No way 😲',
  'Damn it 😡',
  'Love it ❤️',
  'Good job 👏',
];

export default function QuickMessagePopup({ open, onClose, players = [], onSend }) {
  const [target, setTarget] = useState(players[0]?.index || 0);
  const [message, setMessage] = useState(MESSAGES[0]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded p-4 space-y-2 w-64"
        onClick={(e) => e.stopPropagation()}
      >
        <select
          className="w-full border border-border rounded p-1 bg-surface"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        >
          {players.map((p) => (
            <option key={p.index} value={p.index}>
              {p.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
          {MESSAGES.map((m) => (
            <button
              key={m}
              onClick={() => setMessage(m)}
              className={`text-sm border border-border rounded px-1 py-0.5 ${
                message === m ? 'bg-accent' : ''
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          className="w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
          onClick={() => {
            onSend && onSend(target, message);
            onClose();
          }}
        >
          Send
        </button>
      </div>
    </div>,
    document.body,
  );
}
