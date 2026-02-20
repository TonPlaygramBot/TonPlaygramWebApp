import { useState, useEffect } from 'react';
import { AiOutlineInfoCircle, AiOutlineMessage } from 'react-icons/ai';
import { isGameMuted, toggleGameMuted } from '../utils/sound.js';
export default function BottomLeftIcons({
  onInfo,
  onChat,
  onGift,
  onCamera2d,
  style,
  className = 'fixed left-1 bottom-4 flex flex-col items-center space-y-2 z-20',
  showInfo = true,
  showChat = true,
  showGift = true,
  showMute = true,
  showCamera2d = false,
  camera2dActive = false,
  buttonClassName = 'p-1 flex flex-col items-center',
  iconClassName = 'text-xl',
  labelClassName = 'text-xs',
  chatIcon,
  giftIcon,
  infoIcon,
  muteIconOn,
  muteIconOff,
  cameraIcon,
  cameraLabel = '2D',
  order = ['chat', 'gift', 'info', 'mute']
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

  const actions = {
    chat: showChat && onChat
      ? (
          <button type="button" onClick={onChat} className={buttonClassName}>
            {chatIcon ? (
              <span className={iconClassName}>{chatIcon}</span>
            ) : (
              <AiOutlineMessage className={iconClassName} />
            )}
            <span className={labelClassName}>Chat</span>
          </button>
        )
      : null,
    gift: showGift && onGift
      ? (
          <button type="button" onClick={onGift} className={buttonClassName}>
            <span className={iconClassName}>{giftIcon ?? '🎁'}</span>
            <span className={labelClassName}>Gift</span>
          </button>
        )
      : null,
    info: showInfo
      ? (
          <button type="button" onClick={onInfo} className={buttonClassName}>
            {infoIcon ? (
              <span className={iconClassName}>{infoIcon}</span>
            ) : (
              <AiOutlineInfoCircle className={iconClassName} />
            )}
            <span className={labelClassName}>Info</span>
          </button>
        )
      : null,
    mute: showMute
      ? (
          <button type="button" onClick={toggle} className={buttonClassName}>
            <span className={iconClassName}>
              {muted ? muteIconOn ?? '🔇' : muteIconOff ?? '🔊'}
            </span>
            <span className={labelClassName}>{muted ? 'Unmute' : 'Mute'}</span>
          </button>
        )
      : null,
    camera2d: showCamera2d && onCamera2d
      ? (
          <button type="button" onClick={onCamera2d} className={buttonClassName} aria-pressed={camera2dActive}>
            <span className={iconClassName}>{cameraIcon ?? '🎥'}</span>
            <span className={labelClassName}>{camera2dActive ? '3D' : cameraLabel}</span>
          </button>
        )
      : null
  };

  return (
    <div className={className} style={style}>
      {order
        .map((key) => ({ key, node: actions[key] }))
        .filter(({ node }) => node)
        .map(({ key, node }) => (
          <div key={key}>{node}</div>
        ))}
    </div>
  );
}
