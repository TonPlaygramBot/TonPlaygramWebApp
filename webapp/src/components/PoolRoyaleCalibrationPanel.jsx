import { useEffect, useState } from 'react';
import { getPoolRoyaleCalibration, savePoolRoyaleCalibration } from '../utils/api.js';

export default function PoolRoyaleCalibrationPanel({ initial, onClose, onSave }) {
  const [dims, setDims] = useState({
    width: 1000,
    height: 2000,
    bgWidth: 0,
    bgHeight: 0,
    bgX: 0,
    bgY: 0,
    pocketRadius: 50,
    pockets: []
  });

  useEffect(() => {
    async function load() {
      try {
        const res = await getPoolRoyaleCalibration();
        if (!res.error) {
          setDims((d) => ({
            ...d,
            ...res,
            pocketRadius: res.pocketRadius || res.pr || d.pocketRadius,
            pockets: Array.isArray(res.pockets) ? res.pockets : []
          }));
        }
      } catch {}
    }
    if (initial) {
      setDims((d) => ({
        ...d,
        ...initial,
        pocketRadius: initial.pocketRadius || initial.pr || d.pocketRadius,
        pockets: Array.isArray(initial.pockets) ? initial.pockets : []
      }));
    } else {
      load();
    }
  }, [initial]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setDims((d) => ({ ...d, [name]: Number(value) }));
  };

  const handleSave = async () => {
    try {
      await savePoolRoyaleCalibration(
        dims.width,
        dims.height,
        dims.bgWidth,
        dims.bgHeight,
        dims.bgX,
        dims.bgY,
        dims.pockets,
        dims.pocketRadius
      );
      const payload = { ...dims };
      if (onSave) onSave(payload);
    } catch {}
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-text bg-transparent">
      <div className="flex flex-col items-center gap-4 p-4">
        <label className="w-64">Field Width: {dims.width}
          <input
            type="range"
            name="width"
            min="500"
            max="1500"
            value={dims.width}
            onChange={handleChange}
            className="w-full"
          />
        </label>
        <label className="w-64">Field Height: {dims.height}
          <input
            type="range"
            name="height"
            min="1000"
            max="3000"
            value={dims.height}
            onChange={handleChange}
            className="w-full"
          />
        </label>
        <label className="w-64">Pocket Size: {dims.pocketRadius}
          <input
            type="range"
            name="pocketRadius"
            min="10"
            max="200"
            value={dims.pocketRadius}
            onChange={handleChange}
            className="w-full"
          />
        </label>
        <div className="flex gap-2 pt-4">
          <button
            onClick={handleSave}
            className="bg-primary text-background px-4 py-2 rounded"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="bg-gray-500 text-background px-4 py-2 rounded"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}
