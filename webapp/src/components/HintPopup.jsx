import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function HintPopup({ open, message, duration = 2000, onClose }) {
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [open, duration, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded text-center max-w-xs">
        {message}
      </div>
    </div>,
    document.body,
  );
}
