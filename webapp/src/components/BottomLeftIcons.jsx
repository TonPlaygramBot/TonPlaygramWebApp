import { useState } from 'react';
import { AiOutlineInfoCircle } from 'react-icons/ai';
import { Headphones } from 'lucide-react';
import RadioPopup from './RadioPopup.jsx';

export default function BottomLeftIcons({ onInfo, muted, toggleMute }) {
  const [showRadio, setShowRadio] = useState(false);
  return (
    <>
      <div className="fixed left-1 bottom-4 flex flex-col items-center space-y-2 z-20">
        <button onClick={() => setShowRadio(true)} className="p-2 flex flex-col items-center">
          <Headphones className="w-6 h-6" />
          <span className="text-xs">Radio</span>
        </button>
        <button onClick={onInfo} className="p-2 flex flex-col items-center">
          <AiOutlineInfoCircle className="text-2xl" />
          <span className="text-xs">Info</span>
        </button>
        <button onClick={toggleMute} className="p-2 flex flex-col items-center">
          <span className="text-xl">{muted ? '🔇' : '🔊'}</span>
          <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
        </button>
      </div>
      <RadioPopup open={showRadio} onClose={() => setShowRadio(false)} />
    </>
  );
}
