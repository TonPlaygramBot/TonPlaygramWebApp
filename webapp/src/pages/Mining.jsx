import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import LoginOptions from '../components/LoginOptions.jsx';
import { getTelegramId, getTelegramPhotoUrl, getPlayerId } from '../utils/telegram.js';
import { FaCircle } from 'react-icons/fa';
import DailyCheckIn from '../components/DailyCheckIn.jsx';
import SpinGame from '../components/SpinGame.jsx';
import MiningCard from '../components/MiningCard.tsx';
import LuckyNumber from '../components/LuckyNumber.jsx';
import RouletteMini from '../components/RouletteMini.jsx';
import MiningTransactionsCard from '../components/MiningTransactionsCard.jsx';
import {
  getLeaderboard,
  getReferralInfo,
  claimReferral,
  fetchTelegramInfo,
  getProfile,
  listFriendRequests,
  acceptFriendRequest,
  getOnlineCount,
  getOnlineUsers
} from '../utils/api.js';
import UserSearchBar from '../components/UserSearchBar.jsx';
import { BOT_USERNAME } from '../utils/constants.js';
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';
import { socket } from '../utils/socket.js';
import InvitePopup from '../components/InvitePopup.jsx';
import PlayerInvitePopup from '../components/PlayerInvitePopup.jsx';

function normalizeRequests(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.requests)) return payload.requests;
  return [];
}

export default function Mining() {
  useTelegramBackButton();
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <LoginOptions />;
  }
  const accountId = getPlayerId();

  const [referral, setReferral] = useState(null);
  const [claim, setClaim] = useState('');
  const [claimMsg, setClaimMsg] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [rank, setRank] = useState(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState(
    loadAvatar() || getTelegramPhotoUrl()
  );
  const [friendRequests, setFriendRequests] = useState([]);
  const [inviteTarget, setInviteTarget] = useState(null);
  const [stake, setStake] = useState({ token: 'TPC', amount: 100 });
  const [myName, setMyName] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [mode, setMode] = useState('1v1');
  const [selected, setSelected] = useState([]);
  const [groupPopup, setGroupPopup] = useState(false);

  useEffect(() => {
    getReferralInfo(telegramId).then(setReferral);
    getLeaderboard(telegramId).then((data) => {
      setLeaderboard(data.users);
      setRank(data.rank);
    });
    listFriendRequests(telegramId).then((requests) => setFriendRequests(normalizeRequests(requests)));

    const saved = loadAvatar();
    if (saved) {
      setMyPhotoUrl(saved);
      getProfile(telegramId)
        .then((p) =>
          setMyName(
            p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim(),
          ),
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
          setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
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
    const updatePhoto = () => {
      const saved = loadAvatar();
      if (saved) {
        setMyPhotoUrl(saved);
      } else {
        getProfile(telegramId)
          .then((p) => {
            setMyPhotoUrl(p?.photo || getTelegramPhotoUrl());
            if (p?.photo) saveAvatar(p.photo);
            setMyName(p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim());
          })
          .catch(() => setMyPhotoUrl(getTelegramPhotoUrl()));
      }
    };
    window.addEventListener('profilePhotoUpdated', updatePhoto);
    return () => window.removeEventListener('profilePhotoUpdated', updatePhoto);
  }, [telegramId]);

  useEffect(() => {
    function loadOnline() {
      getOnlineUsers().then((d) => setOnlineUsers(d.users || []));
      getOnlineCount().then((d) => setOnlineCount(d.count || 0));
    }
    loadOnline();
    const id = setInterval(loadOnline, 30000);
    return () => clearInterval(id);
  }, []);

  if (!referral) return <div className="p-4">Loading...</div>;

  const link = `https://t.me/${BOT_USERNAME}?start=${referral.referralCode}`;
  const totalBoost =
    (referral.bonusMiningRate || 0) + (referral.storeMiningRate || 0);

  return (
    <>
      <div className="mining-page-content">
        <section className="relative bg-surface border border-border rounded-xl p-4 space-y-3 text-text overflow-hidden wide-card">
          <img
            src="/assets/icons/snakes_and_ladders.webp"
            className="background-behind-board object-cover"
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="flex items-center justify-center gap-2 text-yellow-300">
            <FaCircle className="w-2 h-2" />
            <span className="text-xs uppercase tracking-wide font-semibold">Mining Hub</span>
            <FaCircle className="w-2 h-2" />
          </div>
          <h1 className="text-2xl font-bold text-center text-white text-outline-black">Mine, Boost, Claim</h1>
          <p className="text-sm text-subtext text-center">
            Start a 12-hour mining cycle, increase your reward with referrals, and track progress live.
            Complete check-ins and mini-games below to accelerate your growth.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Cycle</p>
              <p className="text-white font-semibold">12 Hours</p>
            </div>
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Base Reward</p>
              <p className="text-white font-semibold">Up to 1000 TPC</p>
            </div>
            <div className="bg-black/20 rounded-lg border border-border p-2 text-center">
              <p className="text-subtext">Online Now</p>
              <p className="text-white font-semibold">{onlineCount}</p>
            </div>
          </div>
        </section>

        <section className="space-y-3 wide-card">
          <h2 className="text-lg font-semibold text-white text-outline-black">Core Mining Loop</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            {[
              { title: '1) Start', detail: 'Tap Start Mining to begin your 12-hour session.' },
              { title: '2) Boost', detail: 'Invite friends and activate store boosts for faster earnings.' },
              { title: '3) Claim', detail: 'Session auto-finishes in 12h. Restart quickly to keep momentum.' },
            ].map((step) => (
              <div key={step.title} className="bg-surface border border-border rounded-xl p-3">
                <p className="text-white font-semibold">{step.title}</p>
                <p className="text-subtext mt-1">{step.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <MiningCard />
        <MiningTransactionsCard />

        <section className="space-y-3 wide-card">
          <h2 className="text-lg font-semibold text-white text-outline-black">Daily Boost Actions</h2>
          <p className="text-xs text-subtext">
            These actions improve your consistency and help you compound mining rewards every day.
          </p>
          <DailyCheckIn />
          <SpinGame />
          <LuckyNumber />
          <RouletteMini />
        </section>

        <div className="relative bg-surface border border-border rounded-xl p-4 space-y-4 text-text overflow-hidden wide-card">
          <img
            src="/assets/icons/snakes_and_ladders.webp"
            className="background-behind-board object-cover"
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h2 className="text-xl font-bold text-center text-white">Community & Referral Center</h2>

          {friendRequests.length > 0 && (
            <section className="space-y-1">
              <h3 className="text-lg font-semibold">Friend Requests</h3>
              {friendRequests.map((fr) => (
                <div key={fr._id} className="lobby-tile flex items-center justify-between">
                  <span>{fr.from}</span>
                  <button
                    onClick={async () => {
                      await acceptFriendRequest(fr._id);
                      listFriendRequests(telegramId).then((requests) =>
                        setFriendRequests(normalizeRequests(requests))
                      );
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
            <h3 className="text-lg font-semibold">Referral Stats</h3>
            <p className="text-white text-outline-black">
              Invited friends:{' '}
              <span className="text-yellow-400 text-outline-black">
                {referral.referralCount}
              </span>
            </p>
            {totalBoost > 0 && (
              <p className="text-white text-outline-black">
                Mining boost:{' '}
                <span className="text-yellow-400 text-outline-black">
                  +{(totalBoost * 100).toFixed(0)}%
                </span>
              </p>
            )}
            {referral.storeMiningRate && referral.storeMiningExpiresAt && (
              <p className="text-sm text-subtext">
                Boost ends in {Math.max(
                  0,
                  Math.floor(
                    (new Date(referral.storeMiningExpiresAt).getTime() - Date.now()) /
                      86400000,
                  ),
                )}
                d
              </p>
            )}
          </section>

          <section className="space-y-1">
            <h3 className="text-lg font-semibold">Share Your Invite Link</h3>
            <p className="text-xs text-subtext">
              Send this link to friends. When they join and mine, your boost increases.
            </p>
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
                className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
              >
                Copy
              </button>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="text"
                placeholder="Paste link or code"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
                className="flex-1 bg-surface border border-border rounded px-2 py-1 text-sm"
              />
              <button
                onClick={async () => {
                  const c = claim.includes('start=') ? claim.split('start=')[1] : claim;
                  try {
                    const res = await claimReferral(telegramId, c.trim());
                    if (!res.error) {
                      setClaimMsg('Referral claimed!');
                      getReferralInfo(telegramId).then(setReferral);
                    } else {
                      setClaimMsg(res.error || res.message || 'Failed');
                    }
                  } catch {
                    setClaimMsg('Failed');
                  }
                }}
                className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-sm text-white-shadow"
              >
                Claim
              </button>
            </div>
            {claimMsg && <p className="text-xs text-subtext">{claimMsg}</p>}
          </section>

          <section className="space-y-1">
            <h3 className="text-lg font-semibold text-center">Add Friends</h3>
            <p className="text-xs text-subtext text-center">
              Search players and connect to grow your network and unlock more social rewards.
            </p>
            <UserSearchBar />
          </section>
        </div>
      </div>

      <PlayerInvitePopup
        open={!!inviteTarget}
        player={inviteTarget}
        stake={stake}
        onStakeChange={setStake}
        onInvite={() => {
          if (inviteTarget) {
            const roomId = `invite-${accountId}-${inviteTarget.accountId}-${Date.now()}-2`;
            socket.emit(
              'invite1v1',
              {
                fromId: accountId,
                fromName: myName,
                toId: inviteTarget.accountId,
                roomId,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/snake?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              },
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
        onAccept={() => {
          if (selected.length > 0) {
            const roomId = `invite-${accountId}-${Date.now()}-${selected.length + 1}`;
            socket.emit(
              'inviteGroup',
              {
                fromId: accountId,
                fromName: myName,
                toIds: selected.map((u) => u.accountId),
                opponentNames: selected.map((u) => u.nickname || `${u.firstName || ''} ${u.lastName || ''}`.trim()),
                roomId,
                token: stake.token,
                amount: stake.amount,
              },
              (res) => {
                if (res && res.success) {
                  window.location.href = `/games/snake?table=${roomId}&token=${stake.token}&amount=${stake.amount}`;
                } else {
                  alert(res?.error || 'Failed to send invite');
                }
              },
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
    </>
  );
}
