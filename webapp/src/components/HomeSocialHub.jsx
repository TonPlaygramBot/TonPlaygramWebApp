import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUserFriends, FaGamepad, FaComments, FaUsers, FaVideo } from 'react-icons/fa';
import LoginOptions from './LoginOptions.jsx';
import { socket } from '../utils/socket.js';
import { getTelegramId } from '../utils/telegram.js';
import {
  acceptFriendRequest,
  getUnreadCount,
  listFriendRequests
} from '../utils/api.js';

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
    listFriendRequests(telegramId)
      .then((requests) => {
        if (active) setFriendRequests(normalizeRequests(requests));
      })
      .catch(() => {
        if (active) setFriendRequests([]);
      });
    getUnreadCount(telegramId)
      .then((count) => {
        if (active) setUnreadCount(count?.count ?? count ?? 0);
      })
      .catch(() => {
        if (active) setUnreadCount(0);
      });
    return () => {
      active = false;
    };
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
          <h3 className="text-lg font-semibold text-white">Wall & Messages Hub</h3>
        </div>
        <Link to="/trending" className="text-xs text-primary hover:text-primary-hover">
          Open Wall
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/trending"
          className="rounded-lg border border-border bg-background/40 p-3 flex items-center justify-between hover:border-primary transition"
        >
          <div>
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaUsers className="text-primary" /> Wall Social
            </p>
            <p className="text-xs text-subtext">
              Share updates, react to posts, and explore what’s trending.
            </p>
          </div>
          <span className="text-xs text-primary">View</span>
        </Link>
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

      <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <FaVideo className="text-primary" /> Clips & Highlights
          </p>
          <span className="text-xs text-subtext">Share</span>
        </div>
        <p className="text-xs text-subtext">
          Upload short clips, add a caption, and share to the wall or direct messages.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="video/*"
            className="text-xs text-subtext file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1 file:text-[11px] file:font-semibold file:text-background"
          />
          <button className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-background">
            Upload Clip
          </button>
        </div>
      </div>
    </div>
  );
}
