import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getLeaderboard } from '../utils/api.js';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function TransactionDetailsPopup({ tx, onClose }) {
  const [fromProfile, setFromProfile] = useState(null);
  const [toProfile, setToProfile] = useState(null);

  useEffect(() => {
    if (!tx) return;
    getLeaderboard().then((data) => {
      const users = data?.users || [];
      if (tx.fromAccount) {
        setFromProfile(users.find((u) => u.accountId === tx.fromAccount) || null);
      } else {
        setFromProfile(null);
      }
      if (tx.toAccount) {
        setToProfile(users.find((u) => u.accountId === tx.toAccount) || null);
      } else {
        setToProfile(null);
      }
    });
  }, [tx]);

  if (!tx) return null;

  const getName = (p) =>
    (p?.nickname || `${p?.firstName || ''} ${p?.lastName || ''}`.trim()).slice(
      0,
      30,
    );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div className="bg-surface border border-border p-4 rounded space-y-2 text-text w-96 relative">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
        >
          &times;
        </button>
        <h3 className="text-lg font-bold text-center capitalize">{tx.type} details</h3>
        {(tx.type === 'send' || tx.type === 'receive') && (
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              {(tx.type === 'send' ? toProfile : fromProfile)?.photo && (
                <img
                  src={getAvatarUrl((tx.type === 'send' ? toProfile : fromProfile).photo)}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              )}
              <div>
                <div className="font-semibold">
                  {tx.type === 'send' ? 'To: ' : 'From: '}
                  {getName(tx.type === 'send' ? toProfile : fromProfile) ||
                    (tx.type === 'send' ? tx.toName : tx.fromName)}
                </div>
                <div className="text-xs text-subtext">
                  Account: TPC Account #{tx.type === 'send' ? tx.toAccount : tx.fromAccount}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <span>{tx.type === 'send' ? 'Amount Sent:' : 'Amount Received:'}</span>
              <span>{Math.abs(tx.amount)} TPC</span>
            </div>
          </div>
        )}
        {tx.type !== 'send' && tx.type !== 'receive' && (
          <div className="flex justify-between">
            <span>Amount:</span>
            <span className={tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}>{tx.amount}</span>
          </div>
        )}
        {tx.game && (
          <div className="flex justify-between">
            <span>Game:</span>
            <span>{tx.game}</span>
          </div>
        )}
        {tx.players && (
          <div className="flex justify-between">
            <span>Players:</span>
            <span>{tx.players}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Timestamp:</span>
          <span>{new Date(tx.date).toLocaleString()}</span>
        </div>
        {tx.hash && (
          <div className="flex justify-between">
            <span>Tx Hash:</span>
            <span className="break-all">{tx.hash}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Status:</span>
          <span>{tx.status}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
