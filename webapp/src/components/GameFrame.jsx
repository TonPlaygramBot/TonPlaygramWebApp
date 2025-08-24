import { useState } from 'react';
import BottomLeftIcons from './BottomLeftIcons.jsx';
import InfoPopup from './InfoPopup.jsx';

export default function GameFrame({ src, title, info }) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title={title} className="w-full h-full border-0" />
      <BottomLeftIcons
        onInfo={() => setShowInfo(true)}
        showChat={false}
        showGift={false}
      />
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title={title}
        info={info}
      />
    </div>
  );
}
