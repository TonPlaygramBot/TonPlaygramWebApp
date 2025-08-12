import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoomSelector from './RoomSelector.jsx';
import GiftPopup from './GiftPopup.jsx';
import GiftIcon from './GiftIcon.jsx';
import { FaTv } from 'react-icons/fa';
import { getAccountInfo, getSnakeResults, getWatchCount } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';
import AchievementsCard from './AchievementsCard.jsx';

function getGameFromTableId(id) {
  if (!id) return 'snake';
  const prefix = id.split('-')[0];
  if (['snake', 'ludo', 'crazydice', 'horse'].includes(prefix)) return prefix;
  return 'snake';
}

export default function PlayerInvitePopup({
  open,
  player,
  stake,
  onStakeChange,
  onInvite,
  onClose,
}) {
  const [info, setInfo] = useState(null);
  const [records, setRecords] = useState([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [game, setGame] = useState('snake');
  const [watchCount, setWatchCount] = useState(0);

  useEffect(() => {
    if (!open || !player) return;
    if (player.accountId) {
      getAccountInfo(player.accountId)
        .then(setInfo)
        .catch(() => {});
    }
    getSnakeResults()
      .then((data) => {
        const name =
          player.nickname || `${player.firstName || ''} ${player.lastName || ''}`.trim();
        const rec = (data.results || []).filter(
          (r) => r.winner === name || (Array.isArray(r.participants) && r.participants.includes(name))
        );
        setRecords(rec.slice(0, 5));
      })
      .catch(() => {});
  }, [open, player]);

  useEffect(() => {
    if (!open || !player?.currentTableId) return;
    getWatchCount(player.currentTableId)
      .then((c) => setWatchCount(c.count))
      .catch(() => {});
  }, [open, player]);

  if (!open || !player) return null;

  const gifts = info?.gifts || [];
  const balance = info?.balance ?? player.balance;
  const name = player.nickname || `${player.firstName || ''} ${player.lastName || ''}`.trim();

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70"
        onClick={onClose}
      >
        <div
          className="bg-surface border border-border rounded p-4 space-y-3 w-96 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center space-y-1">
            <img
              src={player.photo || player.photoUrl || '/assets/icons/profile.svg'}
              alt="user"
              className="w-24 h-24 rounded-full mx-auto"
            />
            <p className="font-semibold">{name}</p>
            {player.accountId && (
              <p className="text-sm break-all">Account: {player.accountId}</p>
            )}
            {balance !== undefined && (
              <p className="text-sm flex items-center justify-center gap-1">
                Balance:
                <img
                  src="/assets/icons/file_000000005f0c61f48998df883554c3e8 (2).webp"
                  alt="TPC"
                  className="inline w-4 h-4"
                />
                {balance}
              </p>
            )}
            {player.currentTableId && (
              <div className="flex items-center justify-center gap-1 mt-1 text-sm">
                <span className="text-red-500">Playing</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const game = getGameFromTableId(player.currentTableId);
                    window.location.href = `/games/${game}?table=${player.currentTableId}&watch=1`;
                  }}
                  className="text-white flex items-center space-x-1"
                >
                  <FaTv />
                  <span>Watch</span>
                  <span className="text-green-500">{watchCount}</span>
                </button>
              </div>
            )}
          </div>
          <div>
            <h4 className="font-semibold">NFTs</h4>
            <div className="flex space-x-1 overflow-x-auto">
              {gifts.length ? (
                gifts.map((g) => {
                  const gi = NFT_GIFTS.find((x) => x.id === g.gift) || {};
                  return (
                    <GiftIcon
                      key={g._id}
                      icon={gi.icon}
                      className="w-6 h-6"
                      title={gi.name || g.gift}
                    />
                  );
                })
              ) : (
                <p className="text-sm text-subtext">None</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="font-semibold">Recent Games</h4>
            <ul className="text-sm space-y-0.5 list-disc list-inside">
              {records.length ? (
                records.map((r, idx) => (
                  <li key={idx} className="break-all">
                    <span className="font-semibold">{r.winner}</span> vs{' '}
                    {r.participants.filter((p) => p !== r.winner).join(', ') || 'AI'}
                  </li>
                ))
              ) : (
                <li>No records</li>
              )}
            </ul>
          </div>
          <AchievementsCard telegramId={player.telegramId} />
          <div className="space-y-1">
            <p className="font-semibold">Game</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                {
                  id: 'snake',
                  src: '/assets/icons/snakes_and_ladders.webp',
                  alt: 'Snake & Ladders',
                },
                {
                  id: 'crazydice',
                  src: '/assets/icons/Crazy_Dice_Duel_Promo.webp',
                  alt: 'Crazy Dice Duel',
                },
                {
                  id: 'fallingball',
                  src: '/assets/icons/falling_ball.svg',
                  alt: 'Falling Ball',
                },
                {
                  id: 'brickbreaker',
                  src: '/assets/icons/brick_breaker.svg',
                  alt: 'Brick Breaker Royale',
                },
                {
                  id: 'bubblepoproyale',
                  src: '/assets/icons/bubble_pop.svg',
                  alt: 'Bubble Pop Royale',
                },
                {
                  id: 'bubblesmashroyale',
                  src: '/assets/icons/bubble_smash.svg',
                  alt: 'Bubble Smash Royale',
                },
                {
                  id: 'airhockey',
                  src: '/assets/icons/air_hockey.svg',
                  alt: 'Air Hockey',
                },
              ].map((g) => (
                <img
                  key={g.id}
                  src={g.src}
                  alt={g.alt}
                  onClick={() => setGame(g.id)}
                  className={`w-16 h-16 rounded cursor-pointer border-2 ${
                    game === g.id ? 'border-yellow-400 bg-yellow-100' : 'border-border'
                  }`}
                />
              ))}
            </div>
          </div>
          <RoomSelector
            selected={stake}
            onSelect={onStakeChange}
            tokens={['TPC']}
          />
          <div className="flex justify-center gap-2">
            <button
              onClick={() => onInvite(game)}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            >
              Invite
            </button>
            <button
              onClick={() => setGiftOpen(true)}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            >
              Send NFT
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <GiftPopup
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        players={[{
          id: player.accountId,
          name,
          photoUrl: player.photo || player.photoUrl || '/assets/icons/profile.svg',
          index: 0,
        }]}
        senderIndex={0}
      />
    </>,
    document.body
  );
}
