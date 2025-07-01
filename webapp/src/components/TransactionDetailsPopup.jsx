import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function TransactionDetailsPopup({ tx, onClose }) {
  const [fromProfile, setFromProfile] = useState(null);
  const [toProfile, setToProfile] = useState(null);
  const [otherName, setOtherName] = useState('');
  useEffect(() => {
    if (!tx) return;
    getLeaderboard().then((data) => {
      const users = data?.users || [];
      if (tx.fromAccount) {
        const p = users.find((u) => u.accountId === tx.fromAccount);
        setFromProfile(p || null);
        if (!tx.fromName && p && (p.nickname || p.firstName || p.lastName)) {
          setOtherName(
            p.nickname || `${p.firstName || ''} ${p.lastName || ''}`.trim()
          );
        }
      } else {
        setFromProfile(null);
      }
      if (tx.toAccount) {
        const p = users.find((u) => u.accountId === tx.toAccount);
        setToProfile(p || null);
      } else {
        setToProfile(null);
      }
    });
  }, [tx]);
  if (!tx) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-4 rounded space-y-2 text-text w-80 relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        <h3 className="text-lg font-bold text-center capitalize">{tx.type} details</h3>
        {(tx.type === 'send' || tx.type === 'receive') && (
          <p className="text-sm text-center">
            {tx.type === 'send' ? 'Sent' : 'Received'}{' '}
            {Math.abs(tx.amount)} TPC{' '}
            <img src="/icons/tpc.svg" alt="tpc" className="inline w-4 h-4" /> on{' '}
            {new Date(tx.date).toLocaleDateString()} {' '}
            {tx.type === 'send' ? 'to' : 'from'} account {tx.type === 'send' ? tx.toAccount : tx.fromAccount}{' '}
            {(tx.type === 'send' ? toProfile : fromProfile) && (
              <>
                {' '}belonging to{' '}
                {(tx.type === 'send' ? toProfile : fromProfile).nickname ||
                  `${(tx.type === 'send' ? toProfile : fromProfile).firstName || ''} ${(tx.type === 'send' ? toProfile : fromProfile).lastName || ''}`.trim()}
              </>
            )}
          </p>
        )}
        <div className="text-sm space-y-2">
          <div className="flex justify-between"><span>Amount:</span><span className={tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}>{tx.amount}</span></div>
          {tx.fromAccount && (
            <div className="flex items-center space-x-2">
              <span>From:</span>
              <img src="/icons/tpc.svg" alt="tpc" className="w-4 h-4" />
              {fromProfile?.photo && (
                <img src={getAvatarUrl(fromProfile.photo)} alt="" className="w-6 h-6 rounded-full" />
              )}
              <div>
                <div>{tx.fromName || fromProfile?.nickname || `${fromProfile?.firstName || ''} ${fromProfile?.lastName || ''}`.trim() || otherName}</div>
                <div className="text-xs text-subtext">{tx.fromAccount}</div>
              </div>
            </div>
          )}
          {tx.toAccount && (
            <div className="flex items-center space-x-2">
              <span>To:</span>
              <img src="/icons/tpc.svg" alt="tpc" className="w-4 h-4" />
              {toProfile?.photo && (
                <img src={getAvatarUrl(toProfile.photo)} alt="" className="w-6 h-6 rounded-full" />
              )}
              <div>
                <div>{tx.toName || toProfile?.nickname || `${toProfile?.firstName || ''} ${toProfile?.lastName || ''}`.trim()}</div>
                <div className="text-xs text-subtext">{tx.toAccount}</div>
              </div>
            </div>
          )}
          {tx.game && (
            <div className="flex justify-between"><span>Game:</span><span>{tx.game}</span></div>
          )}
          {tx.players && (
            <div className="flex justify-between"><span>Players:</span><span>{tx.players}</span></div>
          )}
          <div className="flex justify-between"><span>Date:</span><span>{new Date(tx.date).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Status:</span><span>{tx.status}</span></div>
        </div>
      </div>
    </div>,
    document.body
  );
}
