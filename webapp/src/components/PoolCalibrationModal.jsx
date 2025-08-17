import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { savePollRoyaleCalibration } from '../utils/api.js';

const STORAGE_KEY = 'pollRoyaleCalibration';

export default function PoolCalibrationModal({ open, onClose, onSave, onChange }) {
  const [width, setWidth] = useState(1000);
  const [height, setHeight] = useState(2000);
  const areaRef = useRef(null);
  const [drag, setDrag] = useState(null);

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

  useEffect(() => {
    if (onChange) onChange({ width, height });
  }, [width, height, onChange]);

  useEffect(() => {
    if (!drag) return;
    function handleMove(e) {
      const rect = areaRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (drag === 'width') {
        let w = Math.abs(e.clientX - centerX) * 2;
        w = Math.min(2000, Math.max(100, Math.round(w)));
        setWidth(w);
      } else if (drag === 'height') {
        let h = Math.abs(e.clientY - centerY) * 2;
        h = Math.min(3000, Math.max(100, Math.round(h)));
        setHeight(h);
      }
    }
    function end() {
      setDrag(null);
    }
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', end);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', end);
    };
  }, [drag]);

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
    <div className="fixed inset-0 z-50 flex flex-col bg-black bg-opacity-50 pointer-events-auto">
      <div ref={areaRef} className="relative flex-1">
        <div
          className="absolute border-2 border-red-500"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div
            className="absolute inset-y-0 -right-2 w-4 cursor-ew-resize"
            onPointerDown={() => setDrag('width')}
          />
          <div
            className="absolute -bottom-2 inset-x-0 h-4 cursor-ns-resize"
            onPointerDown={() => setDrag('height')}
          />
        </div>
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
