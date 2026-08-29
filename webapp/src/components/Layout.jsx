import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket.js';
import { acceptFriendRequest, rejectFriendRequest, pingOnline } from '../utils/api.js';
import { getPlayerId, getTelegramId } from '../utils/telegram.js';
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
import { getGameInvitePath } from '../utils/gameInviteUrl.js';

const GAME_ACTIVE_KEY = 'tonplaygram-game-active';

function showGameInviteNotification(invite) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  const title = 'New game invite';
  const gameName = String(invite?.game || 'snake').replace(/[-_]/g, ' ');
  const stake = Number(invite?.amount) > 0
    ? ` for ${invite.amount} ${invite.token || 'TPG'}`
    : '';
  const options = {
    body: `${invite?.fromName || 'A TonPlaygram player'} invited you to ${gameName}${stake}. Open TonPlaygram to accept or reject.`,
    icon: '/assets/icons/file_00000000efd081f78539cff614489f91.png',
    tag: invite?.roomId ? `game-invite-${invite.roomId}` : 'game-invite',
  };

  const display = () => {
    const notification = new Notification(title, options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  };

  if (Notification.permission === 'granted') display();
  else if (Notification.permission === 'default') {
    Notification.requestPermission()
      .then((permission) => permission === 'granted' && display())
      .catch(() => {});
  }
}


export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [friendRequest, setFriendRequest] = useState(null);
  const [friendRequestAction, setFriendRequestAction] = useState('');
  const [friendRequestError, setFriendRequestError] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callNotice, setCallNotice] = useState('');
  const [messageNotice, setMessageNotice] = useState('');
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
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notification = new Notification('New friend request', {
          body: `${request?.fromName || 'A TonPlaygram player'} wants to add you as a friend.`,
          icon: request?.fromPhoto || '/assets/icons/profile.svg',
          tag: `friend-request-${request?.requestId || Date.now()}`
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      }
    };
    socket.on('friendRequest', onFriendRequest);
    return () => socket.off('friendRequest', onFriendRequest);
  }, []);

  async function respondToFriendRequest(action) {
    if (!friendRequest?.requestId || friendRequestAction) return;
    setFriendRequestAction(action);
    setFriendRequestError('');
    try {
      if (action === 'accept') await acceptFriendRequest(friendRequest.requestId);
      else await rejectFriendRequest(friendRequest.requestId);
      setCallNotice(action === 'accept' ? 'Friend request accepted' : 'Friend request rejected');
      window.setTimeout(() => setCallNotice(''), 5000);
      setFriendRequest(null);
    } catch (error) {
      setFriendRequestError(error?.message || `Could not ${action} this request. Please try again.`);
    } finally {
      setFriendRequestAction('');
    }
  }

  useEffect(() => {
    const onPushInvite = (event) => {
      setInvite(event.detail);
      showGameInviteNotification(event.detail);
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
      }
    };
    window.addEventListener('game-invite-push', onPushInvite);
    return () => window.removeEventListener('game-invite-push', onPushInvite);
  }, []);

  useEffect(() => {
    const onAccepted = ({ byName } = {}) => {
      const message = `${byName || 'A player'} accepted your friend request`;
      setCallNotice(message);
      window.setTimeout(() => setCallNotice(''), 5000);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notification = new Notification('Friend request accepted', {
          body: message,
          icon: '/assets/icons/profile.svg',
          tag: 'friend-request-accepted'
        });
        notification.onclick = () => { window.focus(); notification.close(); };
      }
    };
    socket.on('friendRequestAccepted', onAccepted);
    return () => socket.off('friendRequestAccepted', onAccepted);
  }, []);

  useEffect(() => {
    const identity = getTelegramId() || getPlayerId();
    if (identity) socket.emit('register', { playerId: identity, tpcAccountNumber: identity });
    const onMessage = (message = {}) => {
      if (location.pathname === '/messages') return;
      setMessageNotice('You received a new message');
      if (inviteSoundRef.current && !isGameMuted()) inviteSoundRef.current.play().catch(() => {});
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const notification = new Notification('New message', {
          body: String(message.text || 'Open TonPlaygram to read it.').slice(0, 120),
          icon: '/assets/icons/profile.svg',
          tag: `message-${message._id || Date.now()}`
        });
        notification.onclick = () => { window.focus(); navigate('/messages'); notification.close(); };
      }
    };
    socket.on('privateMessage', onMessage);
    return () => socket.off('privateMessage', onMessage);
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!messageNotice) return undefined;
    const id = window.setTimeout(() => setMessageNotice(''), 5000);
    return () => window.clearTimeout(id);
  }, [messageNotice]);

  useEffect(() => {
    const ring = () => {
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
      }
    };
    const onIncomingCall = (call) => {
      setIncomingCall(call);
      setCallNotice(`${call?.fromName || 'Someone'} is calling you now`);
      ring();
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const title = `Incoming ${call?.type === 'video' ? 'video' : 'voice'} call`;
        const body = `${call?.fromName || 'TonPlaygram player'} is calling you now`;
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: call?.fromPhoto || '/assets/icons/profile.svg' });
        } else if (Notification.permission === 'default') {
          Notification.requestPermission().then((permission) => {
            if (permission === 'granted') {
              new Notification(title, { body, icon: call?.fromPhoto || '/assets/icons/profile.svg' });
            }
          }).catch(() => {});
        }
      }
    };
    const onStartCall = (event) => {
      setActiveCall(event.detail);
      setCallNotice(`${event.detail?.name || 'Friend'} is ringing…`);
    };
    const onAccepted = ({ roomId } = {}) => {
      if (!roomId || activeCall?.roomId === roomId) setCallNotice('Call connected');
    };
    const onEnded = ({ roomId, reason } = {}) => {
      if (!roomId || activeCall?.roomId === roomId) {
        setActiveCall(null);
        setCallNotice(reason === 'declined' ? 'Call declined' : 'Call ended');
      }
      setIncomingCall((current) => (current?.roomId === roomId ? null : current));
    };
    socket.on('friendCall:incoming', onIncomingCall);
    const onIncomingCallPush = (event) => onIncomingCall(event.detail || {});
    window.addEventListener('friend-call:incoming-push', onIncomingCallPush);
    socket.on('friendCall:accepted', onAccepted);
    socket.on('friendCall:ended', onEnded);
    window.addEventListener('friend-call:start', onStartCall);
    return () => {
      socket.off('friendCall:incoming', onIncomingCall);
      window.removeEventListener('friend-call:incoming-push', onIncomingCallPush);
      socket.off('friendCall:accepted', onAccepted);
      socket.off('friendCall:ended', onEnded);
      window.removeEventListener('friend-call:start', onStartCall);
    };
  }, [activeCall?.roomId]);

  useEffect(() => {
    if (!callNotice || activeCall || incomingCall) return undefined;
    const id = window.setTimeout(() => setCallNotice(''), 2800);
    return () => window.clearTimeout(id);
  }, [activeCall, callNotice, incomingCall]);

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
      const nextInvite = {
        fromId,
        fromName,
        roomId,
        token,
        amount,
        group,
        opponentNames,
        game
      };
      setInvite(nextInvite);
      showGameInviteNotification(nextInvite);
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
      }
    };
    socket.on('gameInvite', onInvite);
    return () => socket.off('gameInvite', onInvite);
  }, []);

  useEffect(() => {
    const onAccepted = (acceptedInvite) => {
      navigate(getGameInvitePath(acceptedInvite));
    };
    const onRejected = () => setCallNotice('Your game invite was rejected');
    socket.on('gameInviteAccepted', onAccepted);
    socket.on('gameInviteRejected', onRejected);
    return () => {
      socket.off('gameInviteAccepted', onAccepted);
      socket.off('gameInviteRejected', onRejected);
    };
  }, [navigate]);

  useEffect(() => {
    let id;
    const registerAndPing = () => {
      const playerId = getPlayerId();
      if (!playerId) return;
      if (!socket.connected) socket.connect();
      socket.emit('register', { playerId, tpcAccountNumber: playerId });
      const status = localStorage.getItem('onlineStatus') || 'online';
      pingOnline(playerId, status).catch(() => {});
    };
    try {
      registerAndPing();
      id = setInterval(registerAndPing, 30000);
      socket.on('connect', registerAndPing);
      window.addEventListener('focus', registerAndPing);
      window.addEventListener('storage', registerAndPing);
    } catch {}
    return () => {
      clearInterval(id);
      socket.off('connect', registerAndPing);
      window.removeEventListener('focus', registerAndPing);
      window.removeEventListener('storage', registerAndPing);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomId = params.get('table');
    if (params.get('inviteAccept') !== '1' || !roomId) return;
    socket.emit('gameInvite:accept', { roomId, playerId: getPlayerId() }, (response) => {
      if (!response?.success) {
        setCallNotice('This game invite expired or is no longer available');
        return;
      }
      navigate(getGameInvitePath(response.invite || {
        roomId,
        game: params.get('game') || location.pathname.split('/')[2],
        token: params.get('token'),
        amount: params.get('amount')
      }), { replace: true });
    });
  }, [location.pathname, location.search, navigate]);

  const showNavbar = !(
    location.pathname.startsWith('/games/') &&
    !location.pathname.includes('/lobby')
  );

  const isFlamingo = location.pathname.startsWith('/flamingo');

  const isLobby = location.pathname.includes('/lobby');

  const showFooter = !location.pathname.startsWith('/games/') && !isFlamingo;
  const showHeader =
    !isFlamingo && (!location.pathname.startsWith('/games/') || isLobby);

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
            src="/assets/icons/file_00000000efd081f78539cff614489f91.png"
            alt="TonPlaygram logo"
            className="h-[190px]"
          />
        </header>
      )}
      <main
        className={`flex-grow ${
          showNavbar && !isFlamingo
            ? isLobby
              ? 'w-full p-4 pb-28'
              : 'container mx-auto p-4 pb-28'
            : 'w-full p-0'
        }`}
      >
        {children}
      </main>

      {/* Fixed Bottom Navbar */}

      {showNavbar && !isFlamingo && (
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
          if (invite) {
            socket.emit('gameInvite:accept', { roomId: invite.roomId, playerId: getPlayerId() }, (response) => {
              if (!response?.success) {
                setCallNotice('This game invite expired or is no longer available');
                return;
              }
              const accepted = response.invite || invite;
              navigate(getGameInvitePath(accepted));
            });
          }
          setInvite(null);
        }}
        onReject={() => {
          if (invite) socket.emit('gameInvite:reject', { roomId: invite.roomId, playerId: getPlayerId() });
          setInvite(null);
        }}
      />

      {friendRequest && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center bg-black/70 p-4 pb-24" role="dialog" aria-modal="true" aria-label="New friend request">
          <div className="w-full max-w-sm rounded-3xl border border-cyan-300/30 bg-[#101b2a] p-6 text-center shadow-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">New friend request</p>
            <img src={friendRequest.fromPhoto || '/assets/icons/profile.svg'} alt="" className="mx-auto mt-4 h-16 w-16 rounded-full border-2 border-cyan-300 object-cover" />
            <h2 className="mt-3 text-xl font-bold text-white">{friendRequest.fromName || 'TonPlaygram player'}</h2>
            <p className="mt-1 text-sm text-white/65">wants to add you as a friend.</p>
            {friendRequestError && <p role="alert" className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{friendRequestError}</p>}
            <div className="mt-6 grid grid-cols-3 gap-2">
              <button type="button" disabled={Boolean(friendRequestAction)} onClick={() => respondToFriendRequest('accept')} className="rounded-xl bg-cyan-500 px-2 py-3 text-sm font-semibold text-[#07111d] disabled:opacity-60">{friendRequestAction === 'accept' ? 'Accepting…' : 'Accept'}</button>
              <button type="button" disabled={Boolean(friendRequestAction)} onClick={() => respondToFriendRequest('reject')} className="rounded-xl bg-red-600 px-2 py-3 text-sm font-semibold text-white disabled:opacity-60">{friendRequestAction === 'reject' ? 'Rejecting…' : 'Reject'}</button>
              <button type="button" disabled={Boolean(friendRequestAction)} onClick={() => { setFriendRequestError(''); setFriendRequest(null); }} className="rounded-xl border border-white/15 px-2 py-3 text-sm font-semibold text-white disabled:opacity-60">Hide</button>
            </div>
          </div>
        </div>
      )}

      {callNotice && (
        <div className="fixed left-4 right-4 top-4 z-[91] mx-auto max-w-sm rounded-2xl border border-cyan-300/30 bg-[#081525]/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
          {callNotice}
        </div>
      )}

      {messageNotice && (
        <button type="button" onClick={() => navigate('/messages')} className="fixed left-4 right-4 top-4 z-[92] mx-auto max-w-sm rounded-2xl border border-violet-300/40 bg-[#17122d]/95 px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
          {messageNotice} · Tap to open
        </button>
      )}

      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-4 pb-24">
          <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#101b2a] p-6 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-widest text-cyan-300">Incoming {incomingCall.type} call</p>
            <img src={incomingCall.fromPhoto || '/assets/icons/profile.svg'} alt="" className="mx-auto mt-4 h-20 w-20 rounded-full border-4 border-cyan-300 object-cover shadow-xl" />
            <h2 className="mt-3 text-xl font-bold">{incomingCall.fromName || 'Friend'}</h2>
            <p className="mt-1 text-sm text-white/65">Real-time Messenger call invitation</p>
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
