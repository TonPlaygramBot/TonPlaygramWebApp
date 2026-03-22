import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AiOutlineMessage } from 'react-icons/ai';
import LiveVideoChatPanel from './LiveVideoChatPanel.jsx';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';

export default function GameLiveAvatarOverlay({ gameSlug, children }) {
  const { search } = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [liveMode, setLiveMode] = useState(false);
  const [showLivePanel, setShowLivePanel] = useState(false);

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

  return (
    <>
      {children}
      <div className="fixed bottom-24 left-2 z-[65] pointer-events-auto flex flex-col gap-3 items-start">
        <button
          type="button"
          onClick={() => {
            setLiveMode((prev) => !prev);
            setShowLivePanel((prev) => (!liveMode ? true : prev));
          }}
          className={`flex flex-col items-center rounded px-2 py-1 text-[10px] font-semibold ${
            liveMode
              ? 'bg-emerald-500/25 text-emerald-100'
              : 'bg-transparent text-white hover:bg-white/10'
          }`}
        >
          <AiOutlineMessage className="text-xl" />
          <span>{liveMode ? 'Avatar' : 'Live'}</span>
        </button>
      </div>
      <LiveVideoChatPanel
        open={showLivePanel && liveMode}
        onClose={() => {
          setShowLivePanel(false);
        }}
        roomId={roomId}
        localStream={liveChat.localStream}
        localMediaState={liveChat.mediaState}
        remotePeers={liveChat.remotePeers}
        isConnected={liveChat.isConnected}
        error={liveChat.error}
        onStart={() => {
          setLiveMode(true);
          liveChat.startLiveChat();
        }}
        onStop={() => {
          liveChat.stopLiveChat();
          setLiveMode(false);
          setShowLivePanel(false);
        }}
        onToggleMicrophone={liveChat.toggleMicrophone}
        onToggleCamera={liveChat.toggleCamera}
      />
    </>
  );
}
