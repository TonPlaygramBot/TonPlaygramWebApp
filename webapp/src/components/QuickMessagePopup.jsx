import { useState } from 'react';
import { createPortal } from 'react-dom';

const MESSAGES = [
  'Nice bro 😀',
  'Well done 👍',
  "You're lucky 🍀",
  'No way 😲',
  'Damn it 😡',
  'Love it ❤️',
  'Good job 👏',
  'So close 😬',
  'Amazing move 😎',
  'Too hard 😖',
  'Yay! 🎉',
  'This is fun 🤩',
  "I'm lost 🤯",
  'Great comeback 🏆'
];

export default function QuickMessagePopup({ open, onClose, onSend }) {
  const [message, setMessage] = useState(MESSAGES[0]);
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded p-4 space-y-2 w-64 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
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
            onSend && onSend(message);
            onClose();
          }}
        >
          Send
        </button>
      </div>
    </div>,
    document.body
  );
}
