import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function TransactionDetailsPopup({ tx, onClose }) {
  const [counterparty, setCounterparty] = useState(null);

  useEffect(() => {
    if (!tx) return;
    getLeaderboard().then((data) => {
      const users = data?.users || [];
      const account = tx.type === 'send' ? tx.toAccount : tx.fromAccount;
      const profile = users.find((u) => u.accountId === account);
      setCounterparty(profile || null);
    });
  }, [tx]);

  if (!tx) return null;

  const token = (tx.token || 'TPC').toUpperCase();
  const icon = `/icons/${token.toLowerCase()}.svg`;
  const isSend = tx.type === 'send';
  const account = isSend ? tx.toAccount : tx.fromAccount;
  const nameOverride = isSend ? tx.toName : tx.fromName;
  const nameFromProfile = counterparty?.nickname || `${counterparty?.firstName || ''} ${counterparty?.lastName || ''}`.trim();
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
          {counterparty && (
            <div className="flex items-center space-x-2">
              {counterparty.photo && (
                <img
                  src={getAvatarUrl(counterparty.photo)}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              )}
              <div className="text-left">
                <div>{isSend ? 'To:' : 'From:'} {displayName}</div>
                <div className="text-xs text-subtext">TPC Account #{account}</div>
              </div>
            </div>
          )}
          {!counterparty && account && (
            <div className="text-sm">
              {isSend ? 'To' : 'From'} account #{account}
            </div>
          )}
          <div className="text-xs text-subtext">
            {new Date(tx.date).toLocaleString()}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
