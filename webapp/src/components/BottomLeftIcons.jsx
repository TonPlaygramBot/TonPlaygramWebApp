import { useState, useEffect } from 'react';
import { AiOutlineInfoCircle, AiOutlineMessage } from 'react-icons/ai';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';
export default function BottomLeftIcons({
  onInfo,
  onChat,
  onGift,
  className = 'fixed left-1 bottom-4 flex flex-col items-center space-y-2 z-20',
  buttonClassName = 'p-1 flex flex-col items-center',
  labelClassName = 'text-xs',
  iconClassName = '',
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
        <button onClick={onChat} className={buttonClassName}>
          <AiOutlineMessage className={`text-xl ${iconClassName}`.trim()} />
          <span className={labelClassName}>Chat</span>
        </button>
      )}
      {showGift && onGift && (
        <button onClick={onGift} className={buttonClassName}>
          <span className={`text-xl ${iconClassName}`.trim()}>🎁</span>
          <span className={labelClassName}>Gift</span>
        </button>
      )}
      {showInfo && (
        <button onClick={onInfo} className={buttonClassName}>
          <AiOutlineInfoCircle className={`text-xl ${iconClassName}`.trim()} />
          <span className={labelClassName}>Info</span>
        </button>
      )}
      {showMute && (
        <button onClick={toggle} className={buttonClassName}>
          <span className={`text-lg ${iconClassName}`.trim()}>{muted ? '🔇' : '🔊'}</span>
          <span className={labelClassName}>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
      )}
    </div>
  );
}
