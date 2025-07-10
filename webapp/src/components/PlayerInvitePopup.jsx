import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import RoomSelector from './RoomSelector.jsx';
import GiftPopup from './GiftPopup.jsx';
import GiftIcon from './GiftIcon.jsx';
import { getAccountInfo, getSnakeResults } from '../utils/api.js';
import { NFT_GIFTS } from '../utils/nftGifts.js';

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
              <p className="text-sm">Balance: {balance}</p>
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
          <div className="space-y-1">
            <p className="font-semibold">Game</p>
            <select
              value={game}
              onChange={(e) => setGame(e.target.value)}
              className="w-full border border-border rounded px-2 py-1 bg-surface"
            >
              <option value="snake">Snake &amp; Ladders</option>
              <option value="crazydice">Crazy Dice Duel</option>
            </select>
          </div>
          <RoomSelector selected={stake} onSelect={onStakeChange} />
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
