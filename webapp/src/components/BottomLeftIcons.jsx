import { useState, useEffect } from 'react';
import { AiOutlineInfoCircle, AiOutlineMessage } from 'react-icons/ai';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';
export default function BottomLeftIcons({
  onInfo,
  onChat,
  onGift,
  className = 'fixed z-20 flex flex-col gap-[0.6rem] pointer-events-auto',
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
    <div
      className={className}
      style={{
        left: 'calc(0.75rem + env(safe-area-inset-left, 0px))',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)'
      }}
    >
      {showChat && onChat && (
        <button
          onClick={onChat}
          className="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/20 bg-black/60 p-0 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <AiOutlineMessage className="text-[1.1rem] leading-none" />
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.08em]">Chat</span>
        </button>
      )}
      {showGift && onGift && (
        <button
          onClick={onGift}
          className="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/20 bg-black/60 p-0 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <span className="text-[1.1rem] leading-none">🎁</span>
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.08em]">Gift</span>
        </button>
      )}
      {showInfo && (
        <button
          onClick={onInfo}
          className="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/20 bg-black/60 p-0 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <AiOutlineInfoCircle className="text-[1.1rem] leading-none" />
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.08em]">Info</span>
        </button>
      )}
      {showMute && (
        <button
          onClick={toggle}
          className="flex h-[3.15rem] w-[3.15rem] flex-col items-center justify-center gap-1 rounded-[14px] border border-white/20 bg-black/60 p-0 text-white shadow-[0_8px_18px_rgba(0,0,0,0.35)] backdrop-blur-md"
        >
          <span className="text-[1.1rem] leading-none">{muted ? '🔇' : '🔊'}</span>
          <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.08em]">
            {muted ? 'Unmute' : 'Mute'}
          </span>
        </button>
      )}
    </div>
  );
}
