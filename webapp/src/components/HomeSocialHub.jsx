import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaUserFriends, FaGamepad, FaComments, FaUsers } from 'react-icons/fa';
import LoginOptions from './LoginOptions.jsx';
import { socket } from '../utils/socket.js';
import { getTelegramId } from '../utils/telegram.js';
import {
  acceptFriendRequest,
  getUnreadCount,
  listFriendRequests
} from '../utils/api.js';

const INVITES_STORAGE_KEY = 'tonplaygram-game-invites';

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

  const visibleInvites = useMemo(() => invites.slice(0, 3), [invites]);

  useEffect(() => {
    let active = true;
    listFriendRequests(telegramId)
      .then((requests) => {
        if (active) setFriendRequests(requests || []);
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
        const next = [invite, ...prev].slice(0, 5);
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
    setFriendRequests(updated || []);
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-subtext">Social</p>
          <h3 className="text-lg font-semibold text-white">Wall & Inbox Hub</h3>
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
              <FaComments className="text-primary" /> Inbox
            </p>
            <p className="text-xs text-subtext">
              {unreadCount ? `${unreadCount} unread messages` : 'Chat with your friends.'}
            </p>
          </div>
          <span className="text-xs text-primary">Open</span>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaUserFriends className="text-primary" /> Friend Requests
            </p>
            <span className="text-xs text-subtext">{friendRequests.length} pending</span>
          </div>
          {friendRequests.length === 0 ? (
            <p className="text-xs text-subtext">No new requests right now.</p>
          ) : (
            <div className="space-y-2">
              {friendRequests.slice(0, 3).map((req) => (
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

        <div className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white flex items-center gap-2">
              <FaGamepad className="text-primary" /> Game Requests
            </p>
            <span className="text-xs text-subtext">{invites.length} active</span>
          </div>
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
      </div>
    </div>
  );
}
