import { useState, useEffect } from 'react';
import { AiOutlineInfoCircle, AiOutlineMessage } from 'react-icons/ai';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';
export default function BottomLeftIcons({
  onInfo,
  onChat,
  onGift,
  className = 'fixed left-1 bottom-4 flex flex-col items-center space-y-2 z-20',
  showInfo = true,
  showChat = true,
  showGift = true,
  showMute = true,
}) {
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
    <div className={className}>
      {showChat && onChat && (
        <button onClick={onChat} className="p-1 flex flex-col items-center">
          <AiOutlineMessage className="text-xl" />
          <span className="text-xs">Chat</span>
        </button>
      )}
      {showGift && onGift && (
        <button onClick={onGift} className="p-1 flex flex-col items-center">
          <span className="text-xl">🎁</span>
          <span className="text-xs">Gift</span>
        </button>
      )}
      {showInfo && (
        <button onClick={onInfo} className="p-1 flex flex-col items-center">
          <AiOutlineInfoCircle className="text-xl" />
          <span className="text-xs">Info</span>
        </button>
      )}
      {showMute && (
        <button onClick={toggle} className="p-1 flex flex-col items-center">
          <span className="text-lg">{muted ? '🔇' : '🔊'}</span>
          <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
        </button>
      )}
    </div>
  );
}
