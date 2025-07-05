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
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border rounded p-4 space-y-4 text-text w-72">
        {incoming ? (
          <p className="text-center">
            {name} wants to play you for {stake?.amount}{' '}
            <img
              loading="lazy"
              src={
                stake?.token === 'TPC'
                  ? '/assets/icons/TPCcoin.png'
                  : `/icons/${stake?.token || 'TPC'}.png`
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
            <RoomSelector selected={stake} onSelect={onStakeChange} />
          </>
        )}
        <div className="flex justify-center gap-2">
          <button
            onClick={onAccept}
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded"
          >
            Yes
          </button>
          <button
            onClick={onReject}
            className="px-3 py-1 bg-primary hover:bg-primary-hover rounded"
          >
            No
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
