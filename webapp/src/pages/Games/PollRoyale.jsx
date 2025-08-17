import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import { getPollRoyaleCalibration } from '../../utils/api.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const [calibration, setCalibration] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getPollRoyaleCalibration();
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
  const src = `/poll-royale.html?${iframeParams.toString()}`;

  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title="8 Poll Royale" className="w-full h-full border-0" />
    </div>
  );
}
