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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 pointer-events-auto">
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
              <div className="flex justify-center space-x-2">
                <img
                  src="/assets/icons/snakes_and_ladders.webp"
                  alt="Snake & Ladders"
                  onClick={() => setGame('snake')}
                  className={`w-16 h-16 rounded cursor-pointer border-2 ${game === 'snake' ? 'border-primary' : 'border-border'}`}
                />
                <img
                  src="/assets/icons/Crazy_Dice_Duel_Promo.webp"
                  alt="Crazy Dice Duel"
                  onClick={() => setGame('crazydice')}
                  className={`w-16 h-16 rounded cursor-pointer border-2 ${game === 'crazydice' ? 'border-primary' : 'border-border'}`}
                />
              </div>
            </div>
            <RoomSelector
              selected={stake}
              onSelect={onStakeChange}
              tokens={['TPC']}
            />
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
