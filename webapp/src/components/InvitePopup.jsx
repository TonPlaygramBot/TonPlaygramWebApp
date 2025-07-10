import React from 'react';
import { createPortal } from 'react-dom';
import RoomSelector from './RoomSelector.jsx';

export default function InvitePopup({
  open,
  name,
  opponents = [],
  onAccept,
  onReject,
  stake,
  onStakeChange,
  incoming,
  group,
}) {
  if (!open) return null;
  const [game, setGame] = React.useState('snake');
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border rounded p-4 space-y-4 text-text w-72">
        {incoming ? (
          <p className="text-center">
            {name} wants to play you for {stake?.amount}{' '}
            <img
              
              src={
                stake?.token === 'TPC'
                  ? '/assets/icons/TPCcoin_1.webp'
                  : stake?.token === 'TON'
                  ? '/assets/icons/TON.webp'
                  : '/assets/icons/Usdt.webp'
              }
              alt="token"
              className="inline w-4 h-4 mr-1"
            />
            {stake?.token}
            {group && opponents.length > 0 && (
              <> with {opponents.join(', ')}</>
            )}
          </p>
        ) : (
          <>
            <p className="text-center">
              Invite {Array.isArray(name) ? name.join(', ') : name} to play{' '}
              {group ? 'group' : '1v1'}?
            </p>
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
          </>
        )}
        <div className="flex justify-center gap-2">
          <button
            onClick={() => onAccept(game)}
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
          >
            Yes
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded text-black"
          >
            No
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
