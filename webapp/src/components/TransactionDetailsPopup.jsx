import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getProfileByAccount } from '../utils/api.js';

export default function TransactionDetailsPopup({ tx, onClose }) {
  const [otherName, setOtherName] = useState('');
  useEffect(() => {
    if (!tx) return;
    let id = null;
    if (tx.fromAccount && !tx.fromName) id = tx.fromAccount;
    else if (tx.toAccount && !tx.toName) id = tx.toAccount;
    if (id) {
      getProfileByAccount(id).then((p) => {
        if (p && (p.nickname || p.firstName || p.lastName)) {
          setOtherName(
            p.nickname || `${p.firstName || ''} ${p.lastName || ''}`.trim()
          );
        }
      });
    } else {
      setOtherName('');
    }
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
        <div className="text-sm space-y-1">
          <div className="flex justify-between"><span>Amount:</span><span className={tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}>{tx.amount}</span></div>
          {tx.fromAccount && (
            <div className="flex justify-between">
              <span>From:</span>
              <span>
                {tx.fromName || otherName ? (
                  <>
                    {tx.fromName || otherName} ({tx.fromAccount})
                  </>
                ) : (
                  tx.fromAccount
                )}
              </span>
            </div>
          )}
          {tx.toAccount && (
            <div className="flex justify-between">
              <span>To:</span>
              <span>
                {tx.toName ? `${tx.toName} (${tx.toAccount})` : tx.toAccount}
              </span>
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
