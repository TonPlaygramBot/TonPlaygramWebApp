import { useState, useEffect } from 'react';
import { AiOutlineInfoCircle, AiOutlineMessage } from 'react-icons/ai';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';
export default function BottomLeftIcons({ onInfo, onChat, onGift }) {
  const [muted, setMuted] = useState(isGameMuted());

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  const toggle = () => {
    toggleGameMuted();
    setMuted(isGameMuted());
  };

  return (
    <div className="fixed left-1 bottom-4 flex flex-col items-center space-y-2 z-20">
      {onChat && (
        <button onClick={onChat} className="p-2 flex flex-col items-center">
          <AiOutlineMessage className="text-2xl" />
          <span className="text-xs">Chat</span>
        </button>
      )}
      {onGift && (
        <button onClick={onGift} className="p-2 flex flex-col items-center">
          <span className="text-2xl">🎁</span>
          <span className="text-xs">Gift</span>
        </button>
      )}
      <button onClick={onInfo} className="p-2 flex flex-col items-center">
        <AiOutlineInfoCircle className="text-2xl" />
        <span className="text-xs">Info</span>
      </button>
      <button onClick={toggle} className="p-2 flex flex-col items-center">
        <span className="text-xl">{muted ? '🔇' : '🔊'}</span>
        <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
      </button>
    </div>
  );
}
