import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { savePollRoyaleCalibration } from '../utils/api.js';

const STORAGE_KEY = 'pollRoyaleCalibration';

export default function PoolCalibrationModal({ open, onClose, onSave }) {
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(2000);

  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.width) setWidth(parsed.width);
        if (parsed.height) setHeight(parsed.height);
      }
    } catch {}
  }, [open]);

  const handleSave = async () => {
    const data = { width, height };
    try {
      await savePollRoyaleCalibration(width, height);
    } catch {}
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
    if (onSave) onSave(data);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-50">
      <div className="relative flex-1">
        <div
          className="absolute border-2 border-red-500"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        />
      </div>
      <div className="bg-surface text-text p-4 space-y-2">
        <label className="block text-sm">Width: {width}px</label>
        <input
          type="range"
          min="100"
          max="2000"
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-full"
        />
        <label className="block text-sm">Height: {height}px</label>
        <input
          type="range"
          min="100"
          max="3000"
          value={height}
          onChange={(e) => setHeight(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-1 bg-border rounded text-text"
          >
            Exit
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1 bg-primary hover:bg-primary-hover text-background rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
