import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

export default function GameLiveAvatarOverlay({ gameSlug, children }) {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [liveMode, setLiveMode] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState('/assets/icons/profile.svg');
  const [anchorStyle, setAnchorStyle] = useState({
    left: '0px',
    top: '0px',
    width: '88px',
    height: '88px',
    opacity: 0
  });
  const localVideoRef = useRef(null);
  const anchorRefreshRef = useRef(null);

  const displayName = useMemo(() => {
    if (typeof window === 'undefined') return 'Player';
    const username = window.localStorage.getItem('telegramUsername');
    const firstName = window.localStorage.getItem('telegramFirstName');
    const lastName = window.localStorage.getItem('telegramLastName');
    return (
      username || `${firstName || ''} ${lastName || ''}`.trim() || 'Player'
    );
  }, []);

  const roomId = useMemo(() => {
    const accountId =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('accountId') || 'guest'
        : 'guest';
    const sessionId =
      params.get('table') ||
      params.get('tableId') ||
      params.get('room') ||
      params.get('roomId') ||
      'default';
    return `live-${gameSlug}-${sessionId}-${accountId}`;
  }, [gameSlug, params]);

  const liveChat = useLiveVideoChat({
    roomId,
    displayName,
    enabled: liveMode
  });

  useEffect(() => {
    if (liveMode) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [liveMode, liveChat.startLiveChat, liveChat.stopLiveChat]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedPhoto =
      window.localStorage.getItem('telegramPhotoUrl') ||
      window.localStorage.getItem('telegramAvatar') ||
      '';
    if (storedPhoto) setAvatarUrl(storedPhoto);
  }, []);

  useEffect(() => {
    setMicrophoneEnabled(liveChat.mediaState.microphone !== false);
    setCameraEnabled(liveChat.mediaState.camera !== false);
  }, [liveChat.mediaState.camera, liveChat.mediaState.microphone]);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = liveChat.localStream || null;
  }, [liveChat.localStream]);

  useEffect(() => {
    const isVisible = (node, rect) => {
      if (!node || !rect) return false;
      if (rect.width < 18 || rect.height < 18) return false;
      if (rect.bottom < 0 || rect.right < 0) return false;
      if (rect.top > window.innerHeight || rect.left > window.innerWidth)
        return false;
      const style = window.getComputedStyle(node);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        Number(style.opacity) !== 0
      );
    };

    const evaluateCandidate = (node) => {
      if (!node) return { node: null, score: -1, rect: null };
      const rect = node.getBoundingClientRect();
      if (!isVisible(node, rect)) return { node: null, score: -1, rect: null };
      const src = node.getAttribute('src') || '';
      const idx = node
        .closest('[data-player-index]')
        ?.getAttribute('data-player-index');
      const nearBottom = rect.top > window.innerHeight * 0.45 ? 60 : 0;
      const playerIndexScore = idx === '0' ? 800 : 0;
      const avatarMatchScore =
        avatarUrl && src && src.includes(avatarUrl) ? 400 : 0;
      const profileScore = src.includes('profile') ? 120 : 0;
      const sizePenalty =
        Math.abs(rect.width - 52) + Math.abs(rect.height - 52);
      const score =
        playerIndexScore +
        avatarMatchScore +
        profileScore +
        nearBottom -
        sizePenalty;
      return { node, rect, score };
    };

    const resolveAnchor = () => {
      const selectors = [
        '[data-player-index=\"0\"] img',
        '[data-player-index=\"0\"] video',
        'img[alt=\"player avatar\"]',
        'img[alt=\"Player avatar\"]',
        'img[alt*=\"player\" i]',
        'img[src*=\"profile\"]',
        '.avatar img'
      ];
      const all = selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll(selector))
      );
      const candidates = all
        .map((node) => evaluateCandidate(node))
        .filter((entry) => entry.node && entry.rect && entry.score > -1)
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      if (!best?.rect) return;
      const { rect } = best;
      const size = Math.max(rect.width, rect.height) * 2;
      const left = rect.left + rect.width / 2 - size / 2;
      const top = rect.top + rect.height / 2 - size / 2;
      setAnchorStyle({
        left: `${Math.max(0, left)}px`,
        top: `${Math.max(0, top)}px`,
        width: `${size}px`,
        height: `${size}px`,
        opacity: 1
      });
    };

    const scheduleResolve = () => {
      if (anchorRefreshRef.current)
        window.cancelAnimationFrame(anchorRefreshRef.current);
      anchorRefreshRef.current = window.requestAnimationFrame(resolveAnchor);
    };

    scheduleResolve();
    window.addEventListener('resize', scheduleResolve);
    window.addEventListener('scroll', scheduleResolve, true);
    const mutationObserver = new MutationObserver(scheduleResolve);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true
    });
    const intervalId = window.setInterval(scheduleResolve, 450);

    return () => {
      window.removeEventListener('resize', scheduleResolve);
      window.removeEventListener('scroll', scheduleResolve, true);
      mutationObserver.disconnect();
      window.clearInterval(intervalId);
      if (anchorRefreshRef.current)
        window.cancelAnimationFrame(anchorRefreshRef.current);
    };
  }, [avatarUrl, gameSlug]);

  return (
    <>
      {children}
      <div
        className="fixed z-[65] pointer-events-auto flex flex-col items-center gap-1"
        style={anchorStyle}
      >
        <button
          type="button"
          onClick={() => {
            setLiveMode((prev) => !prev);
          }}
          className={`relative h-full w-full overflow-hidden rounded-full border text-[10px] font-semibold transition ${
            liveMode
              ? 'border-emerald-300 bg-emerald-500/20'
              : 'border-white/30 bg-black/45 hover:bg-white/10'
          }`}
          aria-label={
            liveMode
              ? 'Turn off live avatar video'
              : 'Turn on live avatar video'
          }
        >
          {liveMode ? (
            <video
              ref={(node) => {
                localVideoRef.current = node;
              }}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover scale-x-[-1]"
            />
          ) : (
            <img
              src={avatarUrl}
              alt="Player avatar"
              className="h-full w-full object-cover"
              onError={(event) => {
                event.currentTarget.src = '/assets/icons/profile.svg';
              }}
            />
          )}
          {liveMode ? (
            <span className="absolute bottom-0.5 right-0.5 rounded-full bg-emerald-400 px-1 text-[8px] font-bold text-slate-900">
              LIVE
            </span>
          ) : null}
        </button>
        {liveMode ? (
          <div className="mt-1 flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2 py-1">
            <button
              type="button"
              className="rounded-full px-1.5 text-xs text-white hover:bg-white/10"
              onClick={() => {
                liveChat.toggleMicrophone();
                setMicrophoneEnabled((prev) => !prev);
              }}
              aria-label={
                microphoneEnabled ? 'Mute microphone' : 'Unmute microphone'
              }
            >
              {microphoneEnabled ? '🎙️' : '🔇'}
            </button>
            <button
              type="button"
              className="rounded-full px-1.5 text-xs text-white hover:bg-white/10"
              onClick={() => {
                liveChat.toggleCamera();
                setCameraEnabled((prev) => !prev);
              }}
              aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}
            >
              {cameraEnabled ? '📷' : '🚫'}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
