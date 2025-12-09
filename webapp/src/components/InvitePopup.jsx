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
                  ? '/assets/icons/ezgif-54c96d8a9b9236.webp'
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
                  {
                    id: 'snookerclub',
                    src: '/assets/icons/pool-royale.svg',
                    alt: 'Snooker Club',
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
