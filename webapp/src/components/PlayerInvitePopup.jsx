import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoomSelector from './RoomSelector.jsx';
import GiftPopup from './GiftPopup.jsx';
import GiftIcon from './GiftIcon.jsx';
import { FaTv } from 'react-icons/fa';
import { getAccountInfo, getSnakeResults, getWatchCount } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';

function getGameFromTableId(id) {
  if (!id) return 'snake';
  const prefix = id.split('-')[0];
  const normalized = prefix === 'pollroyale' ? 'poolroyale' : prefix;
  if (
    [
      'snake',
      'fallingball',
      'goalrush',
      'poolroyale',
    ].includes(normalized)
  )
    return normalized;
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
              <p className="text-sm break-all">
                <span className="text-white-shadow">Account:</span>{' '}
                <span className="text-yellow-400 text-outline-black">
                  {player.accountId}
                </span>
              </p>
            )}
            {balance !== undefined && (
              <p className="text-sm flex items-center justify-center gap-1">
                <span className="text-white-shadow">Balance:</span>
                <img
                  src="/assets/icons/ezgif-54c96d8a9b9236.webp"
                  alt="TPC"
                  className="inline w-4 h-4"
                />
                <span className="text-yellow-400 text-outline-black">
                  {balance}
                </span>
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
                      className="w-5 h-5"
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
          <div className="space-y-1">
            <p className="font-semibold text-white-shadow">Game</p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                {
                  id: 'snake',
                  src: '/assets/icons/snakes_and_ladders.webp',
                  alt: 'Snake & Ladders',
                },
                {
                  id: 'fallingball',
                  src: '/assets/icons/Falling Ball .png',
                  alt: 'Falling Ball',
                },
                {
                  id: 'goalrush',
                  src: '/assets/icons/goal_rush_card_1200x675.webp',
                  alt: 'Goal Rush',
                },
                {
                  id: 'poolroyale',
                  src: '/assets/icons/pool-royale.svg',
                  alt: 'Pool Royale',
                },
              ].map((g) => (
                <img
                  key={g.id}
                  src={g.src}
                  alt={g.alt}
                  onClick={() => setGame(g.id)}
                  className={`w-14 h-14 rounded cursor-pointer border-2 ${
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
              className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow text-sm"
            >
              Invite
            </button>
            <button
              onClick={() => setGiftOpen(true)}
              className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow text-sm"
            >
              Send NFT
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 bg-primary hover:bg-primary-hover rounded text-white-shadow text-sm"
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
