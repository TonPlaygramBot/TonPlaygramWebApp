import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getPoolRoyaleCalibration } from '../../utils/api.js';

export default function PoolRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const [calibration, setCalibration] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPoolRoyaleCalibration();
        if (!res.error && res.width && res.height) {
          setCalibration(res);
        }
      } catch {}
    }
    load();
  }, []);

  const iframeParams = new URLSearchParams(search);
  if (calibration?.width) iframeParams.set('cw', calibration.width);
  if (calibration?.height) iframeParams.set('ch', calibration.height);
  if (calibration?.bgWidth) iframeParams.set('bw', calibration.bgWidth);
  if (calibration?.bgHeight) iframeParams.set('bh', calibration.bgHeight);
  if (typeof calibration?.bgX === 'number')
    iframeParams.set('bx', calibration.bgX);
  if (typeof calibration?.bgY === 'number')
    iframeParams.set('by', calibration.bgY);
  if (Array.isArray(calibration?.pockets)) {
    calibration.pockets.forEach((p, i) => {
      if (typeof p.x === 'number') iframeParams.set(`p${i + 1}x`, p.x);
      if (typeof p.y === 'number') iframeParams.set(`p${i + 1}y`, p.y);
    });
  }
  const src = `/pool-royale.html?${iframeParams.toString()}`;

  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title="Pool Royale 🎱" className="w-full h-full border-0" />
    </div>
  );
}
