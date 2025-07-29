import React from 'react';
import { createPortal } from 'react-dom';
import RoomSelector from './RoomSelector.jsx';

export default function InvitePopup({
  open,
  name,
  onAccept,
  onReject,
  stake,
  onStakeChange,
  incoming,
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-70 pointer-events-auto">
      <div className="bg-surface border border-border rounded p-4 space-y-4 text-text w-72">
        {incoming ? (
          <p className="text-center">
            {name} wants to play you for {stake?.amount} {stake?.token}
          </p>
        ) : (
          <>
            <p className="text-center">Invite {name} to play 1v1?</p>
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
