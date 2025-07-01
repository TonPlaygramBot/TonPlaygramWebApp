import React from 'react';
import { createPortal } from 'react-dom';

export default function TransactionDetailsPopup({ tx, onClose }) {
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
          {tx.fromName && <div className="flex justify-between"><span>From:</span><span>{tx.fromName}</span></div>}
          {tx.fromAccount && !tx.fromName && <div className="flex justify-between"><span>From:</span><span>{tx.fromAccount}</span></div>}
          {tx.toAccount && <div className="flex justify-between"><span>To:</span><span>{tx.toAccount}</span></div>}
          <div className="flex justify-between"><span>Date:</span><span>{new Date(tx.date).toLocaleString()}</span></div>
          <div className="flex justify-between"><span>Status:</span><span>{tx.status}</span></div>
        </div>
      </div>
    </div>,
    document.body
  );
}
