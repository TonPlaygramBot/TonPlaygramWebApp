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
  'Great comeback 🏆',
];

export default function QuickMessagePopup({
  open,
  onClose,
  onSend,
  overlayClassName = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70',
  panelClassName = 'bg-surface border border-border rounded p-4 space-y-2 w-64',
  messageButtonClassName = 'text-sm border border-border rounded px-1 py-0.5',
  messageButtonActiveClassName = 'bg-accent',
  sendButtonClassName = 'w-full px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black',
}) {
  const [message, setMessage] = useState(MESSAGES[0]);
  if (!open) return null;
  return createPortal(
    <div
      className={overlayClassName}
      onClick={onClose}
    >
      <div
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
          {MESSAGES.map((m) => (
            <button
              key={m}
              onClick={() => setMessage(m)}
              className={`${messageButtonClassName} ${
                message === m ? messageButtonActiveClassName : ''
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          className={sendButtonClassName}
          onClick={() => {
            onSend && onSend(message);
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
