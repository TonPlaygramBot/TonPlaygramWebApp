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
  const localVideoRef = useRef(null);

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

  return (
    <>
      {children}
      <div className="fixed bottom-24 left-2 z-[65] pointer-events-auto flex flex-col gap-2 items-start">
        <button
          type="button"
          onClick={() => {
            setLiveMode((prev) => !prev);
          }}
          className={`relative h-11 w-11 overflow-hidden rounded-full border text-[10px] font-semibold transition ${
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
          <div className="flex items-center gap-1 rounded-full border border-white/20 bg-black/45 px-1.5 py-1">
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
