import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUserFriends, FaGamepad, FaComments, FaMicrophone, FaMicrophoneSlash, FaPhoneSlash, FaVideo, FaVideoSlash, FaUsers } from 'react-icons/fa';
import LoginOptions from './LoginOptions.jsx';
import { socket } from '../utils/socket.js';
import { getPlayerId, getTelegramId } from '../utils/telegram.js';
import useLiveVideoChat from '../hooks/useLiveVideoChat.js';
import {
  acceptFriendRequest,
  getUnreadCount,
  listFriendRequests
} from '../utils/api.js';

const FRIEND_REQUEST_REFRESH_MS = 15000;

const INVITES_STORAGE_KEY = 'tonplaygram-game-invites';

function normalizeRequests(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requests)) return payload.requests;
  return [];
}

function loadStoredInvites() {
  try {
    const raw = localStorage.getItem(INVITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistInvites(invites) {
  try {
    localStorage.setItem(INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch {
    // ignore persistence failures
  }
}

function SocialVideoTile({ title, stream, muted = false, isVideo = true }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream || null;
  }, [stream]);

  return (
    <div className="relative min-h-[8rem] overflow-hidden rounded-2xl border border-cyan-300/30 bg-black/50 shadow-[0_0_24px_rgba(34,211,238,.12)]">
      {stream && isVideo ? (
        <video ref={videoRef} autoPlay playsInline muted={muted} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full min-h-[8rem] flex-col items-center justify-center gap-2 bg-gradient-to-br from-cyan-950/80 via-slate-950 to-fuchsia-950/70 p-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-xl text-cyan-200">
            <FaUsers />
          </div>
          <p className="text-xs font-semibold text-white">{title}</p>
          <p className="text-[10px] text-cyan-100/70">Voice connected</p>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
        {title}
      </span>
    </div>
  );
}

function SocialCallStudio({ displayName }) {
  const [roomName, setRoomName] = useState('tonplaygram-social-hub');
  const [mode, setMode] = useState('video');
  const [joined, setJoined] = useState(false);
  const roomId = useMemo(() => `social-hub-${roomName.trim() || 'lobby'}`, [roomName]);
  const liveChat = useLiveVideoChat({
    roomId,
    displayName,
    enabled: joined,
    video: mode === 'video'
  });

  useEffect(() => {
    if (joined) {
      liveChat.startLiveChat();
      return;
    }
    liveChat.stopLiveChat();
  }, [joined, roomId, liveChat.startLiveChat, liveChat.stopLiveChat]);

  const isVideo = mode === 'video';

  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-300/30 bg-gradient-to-br from-slate-950 via-cyan-950/50 to-fuchsia-950/40 shadow-[0_0_30px_rgba(6,182,212,.16)]">
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-cyan-200">Open-source WebRTC</p>
            <h4 className="text-base font-bold text-white">Group Voice + Video Room</h4>
            <p className="text-xs text-cyan-100/70">Free peer-to-peer video, voice and text-ready signaling for friends or groups.</p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold text-emerald-200">FREE</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            disabled={joined}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300"
            aria-label="Social call room name"
          />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode('voice')} disabled={joined} className={`rounded-xl px-3 py-2 text-xs font-semibold ${!isVideo ? 'bg-emerald-500 text-white' : 'bg-white/10 text-cyan-100'}`}>Voice</button>
            <button onClick={() => setMode('video')} disabled={joined} className={`rounded-xl px-3 py-2 text-xs font-semibold ${isVideo ? 'bg-cyan-500 text-white' : 'bg-white/10 text-cyan-100'}`}>Video</button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <SocialVideoTile title="You" stream={liveChat.localStream} muted isVideo={isVideo} />
          {liveChat.remotePeers.length === 0 ? (
            <SocialVideoTile title="Waiting for group" stream={null} isVideo={false} />
          ) : liveChat.remotePeers.slice(0, 5).map((peer) => (
            <SocialVideoTile key={peer.socketId} title={peer.displayName || 'Friend'} stream={peer.stream} isVideo={isVideo && peer.mediaState?.camera !== false} />
          ))}
        </div>
        {liveChat.error && <p className="rounded-xl border border-red-400/30 bg-red-950/60 p-2 text-xs text-red-100">{liveChat.error}</p>}
      </div>
      <div className="flex items-center justify-center gap-3 border-t border-white/10 bg-black/25 px-4 py-3">
        <button onClick={liveChat.toggleMicrophone} disabled={!joined} className="rounded-full bg-white/10 p-3 text-white disabled:opacity-40" aria-label="Toggle social microphone">{liveChat.mediaState.microphone ? <FaMicrophone /> : <FaMicrophoneSlash />}</button>
        {isVideo && <button onClick={liveChat.toggleCamera} disabled={!joined} className="rounded-full bg-white/10 p-3 text-white disabled:opacity-40" aria-label="Toggle social camera">{liveChat.mediaState.camera ? <FaVideo /> : <FaVideoSlash />}</button>}
        <button onClick={() => setJoined((value) => !value)} className={`rounded-full px-5 py-3 text-sm font-bold text-white ${joined ? 'bg-red-600' : 'bg-cyan-500'}`}>{joined ? <span className="flex items-center gap-2"><FaPhoneSlash /> Leave</span> : 'Join room'}</button>
      </div>
    </div>
  );
}

export default function HomeSocialHub() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [friendRequests, setFriendRequests] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [invites, setInvites] = useState(() => loadStoredInvites());
  const displayName = useMemo(() => {
    try {
      return window.localStorage.getItem('telegramUsername') || window.localStorage.getItem('telegramFirstName') || `TPC ${getPlayerId()}`;
    } catch {
      return 'TonPlaygram player';
    }
  }, []);

  const receivedInvites = useMemo(
    () =>
      invites.filter(
        (invite) =>
          invite.fromId !== telegramId &&
          invite.fromTelegramId !== telegramId &&
          invite.fromAccountId !== telegramId
      ),
    [invites, telegramId]
  );
  const sentInvites = useMemo(
    () =>
      invites.filter(
        (invite) =>
          invite.fromId === telegramId ||
          invite.fromTelegramId === telegramId ||
          invite.fromAccountId === telegramId
      ),
    [invites, telegramId]
  );
  const visibleInvites = useMemo(() => receivedInvites.slice(0, 3), [receivedInvites]);
  const inviteHistory = useMemo(() => invites.slice(0, 5), [invites]);
  const incomingRequests = useMemo(
    () =>
      friendRequests.filter(
        (req) =>
          req.fromId !== telegramId &&
          req.fromTelegramId !== telegramId &&
          req.fromAccountId !== telegramId
      ),
    [friendRequests, telegramId]
  );
  const outgoingRequests = useMemo(
    () =>
      friendRequests.filter(
        (req) =>
          req.fromId === telegramId ||
          req.fromTelegramId === telegramId ||
          req.fromAccountId === telegramId
      ),
    [friendRequests, telegramId]
  );

  useEffect(() => {
    let active = true;
    const refreshFriendRequests = () =>
      listFriendRequests(telegramId)
        .then((requests) => {
          if (active) setFriendRequests(normalizeRequests(requests));
        })
        .catch(() => {
          if (active) setFriendRequests([]);
        });
    refreshFriendRequests();
    const refreshId = window.setInterval(
      refreshFriendRequests,
      FRIEND_REQUEST_REFRESH_MS
    );
    getUnreadCount(telegramId)
      .then((count) => {
        if (active) setUnreadCount(count?.count ?? count ?? 0);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });
    return () => {
      active = false;
      window.clearInterval(refreshId);
    };
  }, [telegramId]);

  useEffect(() => {
    const onFriendRequest = () => {
      listFriendRequests(telegramId)
        .then((requests) => setFriendRequests(normalizeRequests(requests)))
        .catch(() => {});
    };
    socket.on('friendRequest', onFriendRequest);
    return () => socket.off('friendRequest', onFriendRequest);
  }, [telegramId]);

  useEffect(() => {
    const onInvite = (invite) => {
      setInvites((prev) => {
        const nextInvite = { ...invite, receivedAt: Date.now() };
        const next = [nextInvite, ...prev].slice(0, 5);
        persistInvites(next);
        return next;
      });
    };
    socket.on('gameInvite', onInvite);
    return () => socket.off('gameInvite', onInvite);
  }, []);

  async function handleAccept(requestId) {
    await acceptFriendRequest(requestId);
    const updated = await listFriendRequests(telegramId);
    setFriendRequests(normalizeRequests(updated));
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtext">Social</p>
          <h3 className="text-lg font-semibold text-white">Messages Hub</h3>
        </div>
      </div>

      <SocialCallStudio displayName={displayName} />

      <div className="grid gap-3">
        <Link
          to="/messages"
          className="rounded-lg border border-border bg-background/40 p-3 flex items-center justify-between hover:border-primary transition"
        >
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaComments className="text-primary" /> Messages
            </p>
            <p className="text-xs text-subtext">
              {unreadCount ? `${unreadCount} unread messages` : 'Chat with your friends.'}
            </p>
          </div>
          <span className="text-xs text-primary">Open</span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaUserFriends className="text-primary" /> Friend Requests
            </p>
            <span className="text-xs text-subtext">
              {incomingRequests.length} pending
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtext">
              Incoming
            </p>
            {incomingRequests.length === 0 ? (
              <p className="text-xs text-subtext">No new requests right now.</p>
            ) : (
              <div className="space-y-2">
                {incomingRequests.slice(0, 3).map((req) => (
                  <div
                    key={req._id || req.requestId || req.fromId}
                    className="flex items-center justify-between text-xs text-subtext border border-border rounded p-2"
                  >
                    <span className="text-white">
                      {req.fromName || req.fromNickname || req.fromId || 'Player'}
                    </span>
                    <button
                      onClick={() => handleAccept(req._id || req.requestId)}
                      className="px-2 py-1 rounded bg-primary hover:bg-primary-hover text-white text-[11px]"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtext">
              Sent
            </p>
            {outgoingRequests.length === 0 ? (
              <p className="text-xs text-subtext">No outgoing requests yet.</p>
            ) : (
              <div className="space-y-2">
                {outgoingRequests.slice(0, 3).map((req) => (
                  <div
                    key={req._id || req.requestId || req.toId}
                    className="flex items-center justify-between text-xs text-subtext border border-border rounded p-2"
                  >
                    <span className="text-white">
                      {req.toName || req.toNickname || req.toId || 'Player'}
                    </span>
                    <span className="text-[10px] text-subtext">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaGamepad className="text-primary" /> Game Invites
            </p>
            <span className="text-xs text-subtext">{invites.length} active</span>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtext">
              Received
            </p>
            {visibleInvites.length === 0 ? (
              <p className="text-xs text-subtext">
                New invites appear here when friends challenge you.
              </p>
            ) : (
              <div className="space-y-2">
                {visibleInvites.map((invite, idx) => (
                  <div
                    key={`${invite.roomId || 'invite'}-${idx}`}
                    className="flex items-center justify-between text-xs text-subtext border border-border rounded p-2"
                  >
                    <div>
                      <p className="text-white">
                        {invite.fromName || invite.fromId || 'Friend'} ·{' '}
                        {(invite.game || 'snake').toUpperCase()}
                      </p>
                      <p className="text-[10px] text-subtext">
                        Stake: {invite.amount || 0} {invite.token || 'TPC'}
                      </p>
                    </div>
                    <Link
                      to={`/games/${invite.game || 'snake'}?table=${invite.roomId}&token=${invite.token}&amount=${invite.amount}`}
                      className="px-2 py-1 rounded bg-primary hover:bg-primary-hover text-white text-[11px]"
                    >
                      Join
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtext">
              Sent
            </p>
            {sentInvites.length === 0 ? (
              <p className="text-xs text-subtext">
                No sent invites yet. Challenge friends to track them here.
              </p>
            ) : (
              <div className="space-y-2">
                {sentInvites.slice(0, 2).map((invite, idx) => (
                  <div
                    key={`sent-${invite.roomId || invite.game || 'invite'}-${idx}`}
                    className="flex items-center justify-between text-[11px] text-subtext border border-border rounded p-2"
                  >
                    <span className="text-white">
                      {(invite.game || 'snake').toUpperCase()} ·{' '}
                      {invite.toName || invite.toId || 'Friend'}
                    </span>
                    <span className="text-[10px] text-subtext">Pending</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtext">
              Invite History
            </p>
            {inviteHistory.length === 0 ? (
              <p className="text-xs text-subtext">No invite history yet.</p>
            ) : (
              <div className="space-y-2">
                {inviteHistory.map((invite, idx) => (
                  <div
                    key={`history-${invite.roomId || invite.game || 'invite'}-${idx}`}
                    className="flex items-center justify-between text-[11px] text-subtext border border-border rounded p-2"
                  >
                    <span className="text-white">
                      {(invite.game || 'snake').toUpperCase()} ·{' '}
                      {invite.fromName || invite.fromId || 'Friend'}
                    </span>
                    <span className="text-[10px] text-subtext">
                      {invite.receivedAt ? new Date(invite.receivedAt).toLocaleDateString() : 'Recently'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
