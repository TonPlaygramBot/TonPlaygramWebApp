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
  showLabels = true,
  muted: controlledMuted,
  onToggleMute,
}) {
  const [muted, setMuted] = useState(isGameMuted());

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  useEffect(() => {
    if (typeof controlledMuted === 'boolean') {
      setMuted(controlledMuted);
    }
  }, [controlledMuted]);

  const toggle = () => {
    if (typeof onToggleMute === 'function') {
      const next = !muted;
      onToggleMute(next);
      setMuted(next);
      return;
    }
    toggleGameMuted();
    setMuted(isGameMuted());
  };

  return (
    <div className={className}>
      {showChat && onChat && (
        <button onClick={onChat} className="p-1 flex flex-col items-center">
          <AiOutlineMessage className="text-xl" aria-hidden />
          {showLabels ? <span className="text-xs">Chat</span> : <span className="sr-only">Chat</span>}
        </button>
      )}
      {showGift && onGift && (
        <button onClick={onGift} className="p-1 flex flex-col items-center">
          <span className="text-xl" role="img" aria-hidden>
            🎁
          </span>
          {showLabels ? <span className="text-xs">Gift</span> : <span className="sr-only">Gift</span>}
        </button>
      )}
      {showInfo && (
        <button onClick={onInfo} className="p-1 flex flex-col items-center">
          <AiOutlineInfoCircle className="text-xl" aria-hidden />
          {showLabels ? <span className="text-xs">Info</span> : <span className="sr-only">Info</span>}
        </button>
      )}
      {showMute && (
        <button onClick={toggle} className="p-1 flex flex-col items-center">
          <span className="text-lg" role="img" aria-hidden>
            {muted ? '🔇' : '🔊'}
          </span>
          {showLabels ? (
            <span className="text-xs">{muted ? 'Unmute' : 'Mute'}</span>
          ) : (
            <span className="sr-only">{muted ? 'Unmute' : 'Mute'}</span>
          )}
        </button>
      )}
    </div>
  );
}
