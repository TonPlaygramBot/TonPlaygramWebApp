import { useEffect, useState } from 'react';
import { FaCircle, FaTv } from 'react-icons/fa';
import LoginOptions from './LoginOptions.jsx';
import { getTelegramId, getTelegramPhotoUrl, getPlayerId } from '../utils/telegram.js';
import {
  getLeaderboard,
  getOnlineCount,
  getOnlineUsers,
  fetchTelegramInfo,
  getProfile,
  getWatchCount,
  pingOnline,
} from '../utils/api.js';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';
import { socket } from '../utils/socket.js';
import InvitePopup from './InvitePopup.jsx';
import PlayerInvitePopup from './PlayerInvitePopup.jsx';

function getGameFromTableId(id) {
  if (!id) return 'snake';
  const prefix = id.split('-')[0];
  if (
    [
      'snake',
      'fallingball',
      'goalrush',
      'poolroyale',
      'pooluk',
    ].includes(prefix)
  )
    return prefix;
  return 'snake';
}

export default function LeaderboardCard() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const accountId = getPlayerId();

  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState(
    loadAvatar() || getTelegramPhotoUrl()
  );
  const [inviteTarget, setInviteTarget] = useState(null);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [myName, setMyName] = useState('');
  const [status, setStatus] = useState(
    localStorage.getItem('onlineStatus') || 'online'
  );
  const [onlineUsers, setOnlineUsers] = useState({});
  const [onlineCount, setOnlineCount] = useState(0);
  const [watchCounts, setWatchCounts] = useState({});
  const [aiPlaying, setAiPlaying] = useState(false);
  const [mode, setMode] = useState('1v1');
  const [selected, setSelected] = useState([]);
  const [groupPopup, setGroupPopup] = useState(false);

  useEffect(() => {
    const saved = loadAvatar();
    if (saved) {
      setMyPhotoUrl(saved);
      getProfile(telegramId)
        .then((p) =>
          setMyName(
            p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim()
          )
        )
        .catch(() => {});
    } else {
      getProfile(telegramId)
        .then((p) => {
          if (p?.photo) {
            setMyPhotoUrl(p.photo);
            saveAvatar(p.photo);
          } else {
            fetchTelegramInfo(telegramId).then((info) => {
              if (info?.photoUrl) setMyPhotoUrl(info.photoUrl);
            });
          }
          setMyName(
            p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim()
          );
        })
        .catch(() => {
          fetchTelegramInfo(telegramId).then((info) => {
            if (info?.photoUrl) setMyPhotoUrl(info.photoUrl);
            setMyName(`${info?.firstName || ''} ${info?.lastName || ''}`.trim());
          });
        });
    }
  }, [telegramId]);

  useEffect(() => {
    function loadLeaderboard() {
      getLeaderboard(telegramId).then((data) => {
        setLeaderboard(data.users);
        setRank(data.rank);
      });
    }
    loadLeaderboard();
    const id = setInterval(loadLeaderboard, 15000);
    return () => clearInterval(id);
  }, [telegramId]);

  useEffect(() => {
    const tables = new Set(
      leaderboard.map((u) => u.currentTableId).filter(Boolean),
    );
    const myTable = leaderboard.find((u) => u.accountId === accountId)?.currentTableId;
    if (myTable) tables.add(myTable);
    if (aiPlaying && !myTable) {
      const local = localStorage.getItem('snakeCurrentTable');
      if (local) tables.add(local);
    }
    if (tables.size === 0) return;
    Promise.all(
      [...tables].map((id) => getWatchCount(id).then((c) => [id, c.count])),
    )
      .then((arr) => {
        const obj = {};
        arr.forEach(([id, cnt]) => {
          obj[id] = cnt;
        });
        setWatchCounts(obj);
      })
      .catch(() => {});
  }, [leaderboard, aiPlaying]);

  useEffect(() => {
    function loadOnline() {
      getOnlineUsers()
        .then((d) => {
          const obj = {};
          (d.users || []).forEach((u) => {
            obj[String(u.id)] = u.status;
          });
          setOnlineUsers(obj);
        })
        .catch(() => {});
      getOnlineCount()
        .then((d) => setOnlineCount(d.count || 0))
        .catch(() => {});
    }
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem('onlineStatus', status);
    pingOnline(accountId, status).catch(() => {});
  }, [status, accountId]);

  useEffect(() => {
    const checkAi = () =>
      [1, 2, 3].some((i) => localStorage.getItem(`snakeGameState_${i}`));
    setAiPlaying(checkAi());
    const handler = () => setAiPlaying(checkAi());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <>
      <section
        id="leaderboard"
        className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card mt-4 -ml-3"
      >
        <img
          src="/assets/icons/snakes_and_ladders.webp"
          className="background-behind-board object-cover"
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <h3 className="text-lg font-semibold text-center">Leaderboard</h3>
        <div className="flex items-center justify-between">
          <span className="flex items-center space-x-2">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setSelected([]);
              }}
              className="bg-surface border border-border rounded text-sm"
            >
              <option value="1v1">1v1</option>
              <option value="group">Group</option>
            </select>
            {mode === 'group' && (
              <button
                onClick={() => setGroupPopup(true)}
                disabled={selected.length === 0}
                className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow disabled:opacity-50"
              >
                Invite {selected.length}/3
              </button>
            )}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="bg-surface border border-border rounded text-sm"
            >
              <option value="online">Online</option>
              <option value="busy">Busy</option>
              <option value="offline">Offline</option>
            </select>
            <FaCircle
              className={onlineCount > 0 ? 'text-green-500' : 'text-red-500'}
              size={10}
            />
            <span className="ml-1">{onlineCount}</span>
          </span>
        </div>
        <div className="max-h-[80rem] overflow-y-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left">
                <th
                  className="p-2 text-white"
                  style={{ WebkitTextStroke: '1px black' }}
                >
                  #
                </th>
                <th className="p-2 w-14"></th>
                <th
                  className="p-2 text-white"
                  style={{ WebkitTextStroke: '1px black' }}
                >
                  User
                </th>
                <th
                  className="p-2 text-right text-white"
                  style={{ WebkitTextStroke: '1px black' }}
                >
                  TPC
                </th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, idx) => (
                <tr
                  key={u.accountId || u.telegramId}
                  className={`border-b border-border h-16 ${
                    u.accountId === accountId ? 'bg-accent text-black' : 'cursor-pointer'
                  }`}
                  onClick={() => {
                    if (u.accountId === accountId || u.currentTableId) return;
                    if (mode === 'group') {
                      setSelected((prev) => {
                        const exists = prev.find((p) => p.accountId === u.accountId);
                        if (exists) return prev.filter((p) => p.accountId !== u.accountId);
                        if (prev.length >= 3) return prev;
                        return [...prev, u];
                      });
                    } else {
                      setInviteTarget(u);
                    }
                  }}
                >
                  <td className="p-2 text-white" style={{ WebkitTextStroke: '1px black' }}>
                    {idx + 1}
                  </td>
                  <td className="p-2 w-12 relative">
                    <img
                      src={getAvatarUrl(
                        u.accountId === accountId
                          ? myPhotoUrl || '/assets/icons/profile.svg'
                          : u.photo || u.photoUrl || '/assets/icons/profile.svg'
                      )}
                      alt="avatar"
                      className="w-12 h-12 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                    {u.accountId !== accountId && null}
                  </td>
                  <td className="p-2 flex flex-col items-start">
                    <div className="flex items-center">
                      {mode === 'group' && u.accountId !== accountId && (
                        <input
                          type="checkbox"
                          disabled={!!u.currentTableId}
                          checked={selected.some((p) => p.accountId === u.accountId)}
                          onChange={() => {}}
                          className="mr-1"
                        />
                      )}
                      <span
                        className="text-white"
                        style={{ WebkitTextStroke: '1px black' }}
                      >
                        {u.nickname || `${u.firstName} ${u.lastName}`.trim() || 'User'}
                      </span>
                      {(() => {
                        const userStatus = u.currentTableId
                          ? 'playing'
                          : onlineUsers[String(u.accountId)];
                        if (userStatus === 'online')
                          return <FaCircle className="ml-1 text-green-500" size={8} />;
                        if (userStatus === 'busy')
                          return <FaCircle className="ml-1 text-orange-500" size={8} />;
                        if (userStatus === 'playing')
                          return <FaCircle className="ml-1 text-red-500" size={8} />;
                        return null;
                      })()}
                    </div>
                    {u.currentTableId && (
                      <div className="flex items-center mt-1 text-xs space-x-1">
                        <span className="text-red-500">Playing</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const game = getGameFromTableId(u.currentTableId);
                            window.location.href = `/games/${game}?table=${u.currentTableId}&watch=1`;
                          }}
                          className="text-white flex items-center space-x-1"
                        >
                          <FaTv />
                          <span>Watch</span>
                          <span className="text-green-500">{watchCounts[u.currentTableId] || 0}</span>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="p-2 text-right flex items-center justify-end space-x-1">
                    <span
                      className="text-yellow-400"
                      style={{ WebkitTextStroke: '1px black' }}
                    >
                      {u.balance}
                    </span>
                  </td>
                </tr>
              ))}
              {rank && rank > 100 && (
                <tr className="bg-accent text-black h-16">
                  <td
                    className="p-2 text-white"
                    style={{ WebkitTextStroke: '1px black' }}
                  >
                    {rank}
                  </td>
                  <td className="p-2 w-12 relative">
                    <img
                      src={getAvatarUrl(myPhotoUrl || '/assets/icons/profile.svg')}
                      alt="avatar"
                      className="w-12 h-12 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                  </td>
                  <td className="p-2 flex flex-col items-start">
                    <div className="flex items-center">
                      <span
                        className="text-white"
                        style={{ WebkitTextStroke: '1px black' }}
                      >
                        You
                      </span>
                      {(() => {
                        const myTable = leaderboard.find(
                          (u) => u.accountId === accountId
                        )?.currentTableId;
                        const myStatus = myTable
                          ? 'playing'
                          : aiPlaying
                          ? 'playing'
                          : onlineUsers[String(accountId)];
                        if (myStatus === 'online')
                          return <FaCircle className="ml-1 text-green-500" size={8} />;
                        if (myStatus === 'busy')
                          return <FaCircle className="ml-1 text-orange-500" size={8} />;
                        if (myStatus === 'playing')
                          return <FaCircle className="ml-1 text-red-500" size={8} />;
                        return null;
                      })()}
                    </div>
                    {(() => {
                      const myTable = leaderboard.find(
                        (u) => u.accountId === accountId
                      )?.currentTableId;
                      if (!aiPlaying && !myTable) return null;
                      return (
                        <div className="flex items-center mt-1 text-xs space-x-1">
                          <span className="text-red-500">Playing</span>
                          {myTable && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const game = getGameFromTableId(myTable);
                                window.location.href = `/games/${game}?table=${myTable}&watch=1`;
                              }}
                              className="text-white flex items-center space-x-1"
                            >
                              <FaTv />
                              <span>Watch</span>
                              <span className="text-green-500">{watchCounts[myTable] || 0}</span>
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="p-2 text-right flex items-center justify-end space-x-1">
                    <span
                      className="text-yellow-400"
                      style={{ WebkitTextStroke: '1px black' }}
                    >
                      {leaderboard.find((u) => u.accountId === accountId)?.balance ?? '...'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PlayerInvitePopup
        open={!!inviteTarget}
        player={inviteTarget}
        stake={stake}
        onStakeChange={setStake}
        onInvite={(game) => {
          if (inviteTarget) {
            const roomId = `invite-${accountId}-${inviteTarget.accountId}-${Date.now()}-2`;
            socket.emit(
              'invite1v1',
              {
                fromId: accountId,
                fromTelegramId: telegramId,
                fromName: myName,
                toId: inviteTarget.accountId,
                toTelegramId: inviteTarget.telegramId,
                roomId,
                game,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/${game}?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              }
            );
          }
          setInviteTarget(null);
        }}
        onClose={() => setInviteTarget(null)}
      />
      <InvitePopup
        open={groupPopup}
        name={selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim())}
        stake={stake}
        onStakeChange={setStake}
        group
        opponents={selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim())}
        onAccept={(game) => {
          if (selected.length > 0) {
            const roomId = `invite-${accountId}-${Date.now()}-${selected.length + 1}`;
            socket.emit(
              'inviteGroup',
              {
                fromId: accountId,
                fromTelegramId: telegramId,
                fromName: myName,
                toIds: selected.map((u) => u.accountId),
                telegramIds: selected.map((u) => u.telegramId),
                opponentNames: selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim()),
                roomId,
                game,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/${game}?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              }
            );
          }
          setGroupPopup(false);
          setSelected([]);
        }}
        onReject={() => {
          setGroupPopup(false);
          setSelected([]);
        }}
      />
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-4 right-4 text-3xl"
        aria-label="Back to top"
      >
        ☝️
      </button>
    </>
  );
}
