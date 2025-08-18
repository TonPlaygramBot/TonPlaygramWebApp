import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getPoolRoyaleCalibration } from '../../utils/api.js';
import { getTelegramId } from '../../utils/telegram.js';
import PoolRoyaleCalibrationPanel from '../../components/PoolRoyaleCalibrationPanel.jsx';

export default function PoolRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const [calibration, setCalibration] = useState(null);
  const [showPanel, setShowPanel] = useState(false);

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
  if (typeof calibration?.bgX === 'number') iframeParams.set('bx', calibration.bgX);
  if (typeof calibration?.bgY === 'number') iframeParams.set('by', calibration.bgY);
  if (typeof calibration?.pocketRadius === 'number')
    iframeParams.set('pr', calibration.pocketRadius);
  if (Array.isArray(calibration?.pockets)) {
    calibration.pockets.forEach((p, i) => {
      if (typeof p.x === 'number') iframeParams.set(`p${i + 1}x`, p.x);
      if (typeof p.y === 'number') iframeParams.set(`p${i + 1}y`, p.y);
    });
  }
  if (Array.isArray(calibration?.anchors)) {
    calibration.anchors.forEach((p, i) => {
      if (typeof p.x === 'number') iframeParams.set(`c${i + 1}x`, p.x);
      if (typeof p.y === 'number') iframeParams.set(`c${i + 1}y`, p.y);
    });
  }
  const src = `/pool-royale.html?${iframeParams.toString()}`;

  const tgId = getTelegramId();
  const devIds = [
    import.meta.env.VITE_DEV_ACCOUNT_ID,
    import.meta.env.VITE_DEV_ACCOUNT_ID_1,
    import.meta.env.VITE_DEV_ACCOUNT_ID_2
  ]
    .filter(Boolean)
    .map((id) => Number(id));
  const isDev = tgId && devIds.includes(Number(tgId));

  return (
    <div className="relative w-full h-screen">
      {isDev && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute top-2 right-2 z-10 text-2xl"
          aria-label="Configure"
        >
          ⚙️
        </button>
      )}
      <iframe src={src} title="Pool Royale 🎱" className="w-full h-full border-0" />
      {showPanel && (
        <PoolRoyaleCalibrationPanel
          initial={calibration}
          onClose={() => setShowPanel(false)}
          onSave={setCalibration}
        />
      )}
    </div>
  );
}
