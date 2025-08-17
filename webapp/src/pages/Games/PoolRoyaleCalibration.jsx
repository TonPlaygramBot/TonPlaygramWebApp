import { useEffect, useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import {
  getPoolRoyaleCalibration,
  savePoolRoyaleCalibration
} from '../../utils/api.js';

export default function PoolRoyaleCalibration() {
  useTelegramBackButton();
  const [dims, setDims] = useState({ width: 1000, height: 2000, bgWidth: 0, bgHeight: 0, bgX: 0, bgY: 0 });
  const [pockets, setPockets] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPoolRoyaleCalibration();
        if (!res.error) {
          if (res.width) {
            setDims({
              width: res.width,
              height: res.height,
              bgWidth: res.bgWidth,
              bgHeight: res.bgHeight,
              bgX: res.bgX,
              bgY: res.bgY
            });
          }
          if (Array.isArray(res.pockets)) setPockets(res.pockets);
        }
      } catch {}
    }
    load();
  }, []);
  function handleChange(e) {
    const { name, value } = e.target;
    setDims(d => ({ ...d, [name]: Number(value) }));
  }

  async function save() {
    try {
      await savePoolRoyaleCalibration(
        dims.width,
        dims.height,
        dims.bgWidth,
        dims.bgHeight,
        dims.bgX,
        dims.bgY,
        pockets
      );
      alert('Calibration saved');
    } catch {}
  }

  return (
    <div className="relative flex flex-col items-center justify-center h-screen">
      <div className="flex flex-col space-y-4 text-center">
        <div>
          <label className="block mb-1">Table Width</label>
          <input
            type="number"
            name="width"
            value={dims.width}
            onChange={handleChange}
            className="border px-2 py-1 rounded text-center bg-transparent"
          />
        </div>
        <div>
          <label className="block mb-1">Table Height</label>
          <input
            type="number"
            name="height"
            value={dims.height}
            onChange={handleChange}
            className="border px-2 py-1 rounded text-center bg-transparent"
          />
        </div>
      </div>
      <button
        onClick={save}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-background px-4 py-2 rounded"
      >
        Save
      </button>
    </div>
  );
}

