import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { DEV_INFO } from '../../utils/constants.js';
import PoolCalibrationModal from '../../components/PoolCalibrationModal.jsx';
import { getPollRoyaleCalibration } from '../../utils/api.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const accountId = params.get('accountId');
  const isDev = accountId === DEV_INFO.account;
  const [calibration, setCalibration] = useState(null);
  const [showCal, setShowCal] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPollRoyaleCalibration();
        if (!res.error && res.width && res.height) {
          setCalibration(res);
          return;
        }
      } catch {}
      try {
        const stored = localStorage.getItem('pollRoyaleCalibration');
        if (stored) setCalibration(JSON.parse(stored));
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
  const src = `/poll-royale.html?${iframeParams.toString()}`;

  return (
    <div className="relative w-full h-screen">
      {isDev && (
        <>
          <button
            onClick={() => setShowCal(true)}
            className="absolute z-10 top-2 right-2 px-3 py-1 bg-primary hover:bg-primary-hover text-background rounded"
          >
            Calibrate
          </button>
          <PoolCalibrationModal
            open={showCal}
            onClose={() => setShowCal(false)}
            onSave={(c) => setCalibration(c)}
            onChange={(c) => setCalibration(c)}
          />
        </>
      )}
      <iframe
        src={src}
        title="8 Poll Royale"
        className="w-full h-full border-0"
        style={{ pointerEvents: showCal ? 'none' : 'auto' }}
      />
    </div>
  );
}
