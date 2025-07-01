import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function TransactionDetailsPopup({ tx, onClose }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!tx) {
      setUser(null);
      return;
    }
    getLeaderboard().then((data) => {
      const leaderboard = data?.users || [];
      const profile = leaderboard.find(
        (u) => u.accountNumber === tx.tpcAccountNumber
      );
      setUser(profile || null);
    });
  }, [tx]);

  if (!tx) return null;

  const token = (tx.token || 'TPC').toUpperCase();
  const icon = `/icons/${token.toLowerCase()}.svg`;
  const isSend = tx.type === 'send';
  const account = tx.tpcAccountNumber || (isSend ? tx.toAccount : tx.fromAccount);
  const nameOverride = isSend ? tx.toName : tx.fromName;
  const nameFromProfile = user?.name || user?.nickname || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  const displayName = nameOverride || nameFromProfile || '';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-4 rounded space-y-4 text-text w-80 relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        <h3 className="text-lg font-bold text-center">Transaction Details</h3>
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2">
            <img src={icon} alt={token} className="w-5 h-5" />
            <span className="font-semibold">
              {isSend ? 'Sent' : 'Received'} {Math.abs(tx.amount)} {token}
            </span>
          </div>
          {user && (
            <div className="flex items-center space-x-2">
              {user.profileImage || user.photo ? (
                <img
                  src={getAvatarUrl(user.profileImage || user.photo)}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center uppercase">
                  {displayName.slice(0, 2)}
                </div>
              )}
              <div className="text-left">
                <div>{isSend ? 'To:' : 'From:'} {displayName}</div>
                <div className="text-xs text-subtext">TPC Account #{account}</div>
              </div>
            </div>
          )}
          {!user && account && (
            <div className="text-sm">
              {isSend ? 'To' : 'From'} account #{account}
            </div>
          )}
          <div className="text-xs text-subtext">
            {new Date(tx.timestamp || tx.date).toLocaleString()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
