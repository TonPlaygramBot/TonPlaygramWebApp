import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import {
  getLeaderboard,
  getReferralInfo,
  fetchTelegramInfo,
  getProfile,
  listFriendRequests,
  acceptFriendRequest
} from '../utils/api.js';
import UserSearchBar from '../components/UserSearchBar.jsx';
import { BOT_USERNAME } from '../utils/constants.js';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

export default function Friends() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }

  const [referral, setReferral] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState(
    loadAvatar() || getTelegramPhotoUrl()
  );
  const [friendRequests, setFriendRequests] = useState([]);

  useEffect(() => {
    getReferralInfo(telegramId).then(setReferral);
    getLeaderboard(telegramId).then((data) => {
      setLeaderboard(data.users);
      setRank(data.rank);
    });
    listFriendRequests(telegramId).then(setFriendRequests);

    const saved = loadAvatar();
    if (saved) {
      setMyPhotoUrl(saved);
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
        })
        .catch(() => {
          fetchTelegramInfo(telegramId).then((info) => {
            if (info?.photoUrl) setMyPhotoUrl(info.photoUrl);
          });
        });
    }
  }, [telegramId]);

  useEffect(() => {
    const updatePhoto = () => {
      const saved = loadAvatar();
      if (saved) {
        setMyPhotoUrl(saved);
      } else {
        getProfile(telegramId)
          .then((p) => {
            setMyPhotoUrl(p?.photo || getTelegramPhotoUrl());
            if (p?.photo) saveAvatar(p.photo);
          })
          .catch(() => setMyPhotoUrl(getTelegramPhotoUrl()));
      }
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, [telegramId]);

  if (!referral) return <div className="p-4">Loading...</div>;

  const link = `https://t.me/${BOT_USERNAME}?start=${referral.code}`;

  return (
    <div className="relative p-4 space-y-4 text-text">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board friend-background object-cover"
        alt=""
      />
      <h2 className="text-xl font-bold">Friends</h2>

      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Add Friends</h3>
        <UserSearchBar />
      </section>

      {friendRequests.length > 0 && (
        <section className="space-y-1">
          <h3 className="text-lg font-semibold">Friend Requests</h3>
          {friendRequests.map((fr) => (
            <div key={fr._id} className="lobby-tile flex items-center justify-between">
              <span>{fr.from}</span>
              <button
                onClick={async () => {
                  await acceptFriendRequest(fr._id);
                  listFriendRequests(telegramId).then(setFriendRequests);
                }}
                className="px-2 py-1 text-sm bg-primary hover:bg-primary-hover rounded"
              >
                Accept
              </button>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Friends</h3>
        <p>You have {referral.referrals} referrals</p>
      </section>

      <section className="space-y-1">
        <h3 className="text-lg font-semibold">Referral</h3>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            readOnly
            value={link}
            onClick={(e) => e.target.select()}
            className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
          />
          <button
            onClick={() => navigator.clipboard.writeText(link)}
            className="px-2 py-1 bg-primary hover:bg-primary-hover text-text rounded text-sm"
          >
            Copy
          </button>
        </div>
      </section>

      <section id="leaderboard" className="space-y-2">
        <h3 className="text-lg font-semibold">Leaderboard</h3>
        <div className="max-h-96 overflow-y-auto border border-border rounded">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border text-left">
                <th className="p-2">#</th>
                <th className="p-2 w-16"></th>
                <th className="p-2">User</th>
                <th className="p-2 text-right">TPC</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((u, idx) => (
                <tr
                  key={u.telegramId}
                  className={`border-b border-border h-16 ${u.telegramId === telegramId ? 'bg-accent text-black' : ''}`}
                >
                  <td className="p-2">{idx + 1}</td>
                  <td className="p-2 w-16">
                    <img
                      src={getAvatarUrl(
                        u.telegramId === telegramId
                          ? myPhotoUrl || '/assets/icons/profile.svg'
                          : u.photo || u.photoUrl || '/assets/icons/profile.svg'
                      )}
                      alt="avatar"
                      className="w-16 h-16 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                  </td>
                  <td className="p-2">
                    {u.nickname || `${u.firstName} ${u.lastName}`.trim() || 'User'}
                  </td>
                  <td className="p-2 text-right">{u.balance}</td>
                </tr>
              ))}
              {rank && rank > 100 && (
                <tr className="bg-accent text-black h-16">
                  <td className="p-2">{rank}</td>
                  <td className="p-2 w-16">
                    <img
                      src={getAvatarUrl(myPhotoUrl || '/assets/icons/profile.svg')}
                      alt="avatar"
                      className="w-16 h-16 hexagon border-2 border-brand-gold object-cover shadow-[0_0_12px_rgba(241,196,15,0.8)]"
                    />
                  </td>
                  <td className="p-2">You</td>
                  <td className="p-2 text-right">{leaderboard.find((u) => u.telegramId === telegramId)?.balance ?? '...'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
