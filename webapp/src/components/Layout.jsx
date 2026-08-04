import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket.js';
import { acceptFriendRequest, pingOnline } from '../utils/api.js';
import { getPlayerId } from '../utils/telegram.js';
import { isGameMuted, getGameVolume } from '../utils/sound.js';
import { chatBeep as inviteBeep } from '../assets/coreSoundData.js';
import usePwaInstallPrompt from '../hooks/usePwaInstallPrompt.js';
import InvitePopup from './InvitePopup.jsx';
import FriendCallOverlay from './FriendCallOverlay.jsx';

import Navbar from './Navbar.jsx';

import Footer from './Footer.jsx';
import PwaInstallBanner from './PwaInstallBanner.jsx';
import UpdatingOverlay from './UpdatingOverlay.jsx';
import useAppUpdate from '../hooks/useAppUpdate.js';

const GAME_ACTIVE_KEY = 'tonplaygram-game-active';


export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [friendRequest, setFriendRequest] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const inviteSoundRef = useRef(null);
  const {
    canInstall,
    canShowTelegramInstall,
    mode,
    promptToInstall,
    openExternalInstall,
    dismiss
  } = usePwaInstallPrompt();
  const { isUpdating } = useAppUpdate();

  useEffect(() => {
    const onFriendRequest = (request) => {
      setFriendRequest(request);
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
      }
    };
    socket.on('friendRequest', onFriendRequest);
    return () => socket.off('friendRequest', onFriendRequest);
  }, []);

  useEffect(() => {
    const onIncomingCall = (call) => setIncomingCall(call);
    const onStartCall = (event) => setActiveCall(event.detail);
    const onEnded = ({ roomId } = {}) => {
      if (!roomId || activeCall?.roomId === roomId) setActiveCall(null);
    };
    socket.on('friendCall:incoming', onIncomingCall);
    socket.on('friendCall:ended', onEnded);
    window.addEventListener('friend-call:start', onStartCall);
    return () => {
      socket.off('friendCall:incoming', onIncomingCall);
      socket.off('friendCall:ended', onEnded);
      window.removeEventListener('friend-call:start', onStartCall);
    };
  }, [activeCall?.roomId]);

  useEffect(() => {
    inviteSoundRef.current = new Audio(inviteBeep);
    inviteSoundRef.current.volume = getGameVolume();
    inviteSoundRef.current.muted = isGameMuted();
    inviteSoundRef.current.load();
    const volumeHandler = () => {
      if (inviteSoundRef.current) inviteSoundRef.current.volume = getGameVolume();
    };
    const muteHandler = () => {
      if (inviteSoundRef.current) inviteSoundRef.current.muted = isGameMuted();
    };
    window.addEventListener('gameVolumeChanged', volumeHandler);
    window.addEventListener('gameMuteChanged', muteHandler);
    return () => {
      window.removeEventListener('gameVolumeChanged', volumeHandler);
      window.removeEventListener('gameMuteChanged', muteHandler);
      inviteSoundRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const onInvite = ({
      fromId,
      fromName,
      roomId,
      token,
      amount,
      group,
      opponentNames,
      game
    }) => {
      setInvite({
        fromId,
        fromName,
        roomId,
        token,
        amount,
        group,
        opponentNames,
        game
      });
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
      }
    };
    socket.on('gameInvite', onInvite);
    return () => socket.off('gameInvite', onInvite);
  }, []);

  useEffect(() => {
    let id;
    try {
      const playerId = getPlayerId();
      function ping() {
        const status = localStorage.getItem('onlineStatus') || 'online';
        pingOnline(playerId, status).catch(() => {});
      }
      ping();
      id = setInterval(ping, 30000);
    } catch {}
    return () => clearInterval(id);
  }, []);

  const showNavbar = !(
    location.pathname.startsWith('/games/') &&
    !location.pathname.includes('/lobby')
  );

  const isLobby = location.pathname.includes('/lobby');

  const showFooter = !location.pathname.startsWith('/games/');
  const showHeader =
    !location.pathname.startsWith('/games/') ||
    isLobby;

  useEffect(() => {
    if (location.pathname === '/mining') {
      document.body.classList.add('mining-page');
    } else {
      document.body.classList.remove('mining-page');
    }
  }, [location.pathname]);

  useEffect(() => {
    const isCareerPage = location.pathname.includes('/career');
    const isGamePage =
      location.pathname.startsWith('/games/') &&
      !location.pathname.includes('/lobby') &&
      !isCareerPage;
    if (isGamePage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [location.pathname]);

  useEffect(() => {
    const isGameActive =
      location.pathname.startsWith('/games/') &&
      !location.pathname.includes('/lobby') &&
      !location.pathname.includes('/transactions') &&
      !location.pathname.endsWith('/results');
    let previous = false;
    try {
      previous = localStorage.getItem(GAME_ACTIVE_KEY) === 'true';
      if (previous === isGameActive) return;
      localStorage.setItem(GAME_ACTIVE_KEY, isGameActive ? 'true' : 'false');
    } catch {}
    window.dispatchEvent(new CustomEvent('tonplaygram-game-activity', { detail: { active: isGameActive } }));
    if (!isGameActive && previous) {
      window.dispatchEvent(new Event('tonplaygram-game-ended'));
    }
  }, [location.pathname]);

  const showPwaBanner = showNavbar && (canInstall || canShowTelegramInstall);

  return (
    <div
      className="flex flex-col text-text relative overflow-hidden"
      style={{ minHeight: "var(--tg-viewport-stable-height, var(--app-viewport-stable-height, var(--app-viewport-height, 100dvh)))" }}
    >
      {showHeader && (
        <header className="w-full bg-surface border-b-2 border-accent flex justify-center py-0.5">
          <img
            src="/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp"
            alt="TonPlaygram logo"
            className="h-[190px]"
          />
        </header>
      )}
      <main
        className={`flex-grow ${
          showNavbar
            ? isLobby
              ? 'w-full p-4 pb-28'
              : 'container mx-auto p-4 pb-28'
            : 'w-full p-0'
        }`}
      >
        {children}
      </main>

      {/* Fixed Bottom Navbar */}

      {showNavbar && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <Navbar />
        </div>
      )}

      {showFooter && <Footer />}

      <InvitePopup
        open={!!invite}
        name={invite?.fromName || invite?.fromId}
        opponents={invite?.opponentNames || []}
        stake={{ token: invite?.token, amount: invite?.amount }}
        incoming
        group={Array.isArray(invite?.group)}
        onAccept={() => {
          if (invite)
            navigate(
              `/games/${invite.game || 'snake'}?table=${invite.roomId}&token=${invite.token}&amount=${invite.amount}`
            );
          setInvite(null);
        }}
        onReject={() => setInvite(null)}
      />

      {friendRequest && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-4 pb-24" role="dialog" aria-modal="true" aria-label="New friend request">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-[#101b2a] p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">New friend request</p>
            <img src={friendRequest.fromPhoto || '/assets/icons/profile.svg'} alt="" className="mx-auto mt-4 h-16 w-16 rounded-full border-2 border-cyan-300 object-cover" />
            <h2 className="mt-3 text-xl font-bold text-white">{friendRequest.fromName || 'TonPlaygram player'}</h2>
            <p className="mt-1 text-sm text-white/65">wants to add you as a friend.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setFriendRequest(null)} className="rounded-xl border border-white/15 px-4 py-3 font-semibold text-white">Not now</button>
              <button type="button" onClick={async () => { await acceptFriendRequest(friendRequest.requestId); setFriendRequest(null); }} className="rounded-xl bg-cyan-500 px-4 py-3 font-semibold text-[#07111d]">Accept</button>
            </div>
          </div>
        </div>
      )}

      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 pb-24">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#101b2a] p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-cyan-300">Incoming {incomingCall.type} call</p>
            <h2 className="mt-2 text-xl font-bold">{incomingCall.fromName || 'Friend'}</h2>
            <div className="mt-6 flex justify-center gap-4">
              <button onClick={() => { socket.emit('friendCall:reject', incomingCall); setIncomingCall(null); }} className="rounded-full bg-red-600 px-6 py-3 font-semibold">Decline</button>
              <button onClick={() => { socket.emit('friendCall:accept', incomingCall); setActiveCall({ ...incomingCall, name: incomingCall.fromName }); setIncomingCall(null); }} className="rounded-full bg-emerald-600 px-6 py-3 font-semibold">Accept</button>
            </div>
          </div>
        </div>
      )}
      <FriendCallOverlay call={activeCall} displayName="TonPlaygram player" onEnd={() => { socket.emit('friendCall:end', activeCall); setActiveCall(null); }} />

      <PwaInstallBanner
        mode={showPwaBanner ? mode : 'none'}
        onInstall={mode === 'telegram' ? openExternalInstall : promptToInstall}
        onDismiss={dismiss}
      />

      <UpdatingOverlay active={isUpdating} />
    </div>
  );
}
