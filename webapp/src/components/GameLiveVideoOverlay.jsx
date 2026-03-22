import { useEffect, useMemo, useState } from 'react';
import { AiOutlineMessage } from 'react-icons/ai';
import { useLocation } from 'react-router-dom';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';
import LiveVideoChatPanel from './LiveVideoChatPanel.jsx';

export default function GameLiveVideoOverlay({ gameSlug, children }) {
  const location = useLocation();
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
    if (typeof window === 'undefined') return `game-live-${gameSlug}`;
    const params = new URLSearchParams(location.search);
    const accountId = window.localStorage.getItem('accountId') || 'guest';
    const tableId = params.get('table') || 'default';
    return `game-live-${gameSlug}-${tableId}-${accountId}`;
  }, [gameSlug, location.search]);

  const liveChat = useLiveVideoChat({ roomId, displayName, enabled: liveMode });

  useEffect(() => {
    if (liveMode) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [liveMode, liveChat.startLiveChat, liveChat.stopLiveChat]);

  return (
    <div className="relative">
      {children}
      <div className="pointer-events-none fixed bottom-16 left-2 z-[60]">
        <button
          type="button"
          onClick={() => {
            setLiveMode((prev) => !prev);
            setShowLivePanel((prev) => (!liveMode ? true : prev));
          }}
          className={`pointer-events-auto flex flex-col items-center rounded px-2 py-1 text-[10px] font-semibold ${
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
    </div>
  );
}
