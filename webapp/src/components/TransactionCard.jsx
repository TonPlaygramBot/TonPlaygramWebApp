import React from 'react';
import { getAvatarUrl } from '../utils/avatarUtils.js';

export default function TransactionCard({ tx, profile, onClick }) {
  if (!tx) return null;
  const name = (
    profile?.nickname || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
  ).slice(0, 30);
  const account = tx.type === 'send' ? tx.toAccount : tx.fromAccount;
  const amountClass = tx.amount > 0 ? 'text-green-500' : 'text-red-500';
  return (
    <div
      className="flex items-center space-x-2 border-b border-border pb-2 cursor-pointer hover:bg-white/10"
      onClick={onClick}
    >
      {profile?.photo && (
        <img
          src={getAvatarUrl(profile.photo)}
          alt=""
          className="w-12 h-12 rounded-full object-cover"
        />
      )}
      <div className="flex-1">
        <div className="font-semibold">{name || 'Unknown'}</div>
        <div className="text-xs text-subtext">Account: {account}</div>
        <div className="text-xs text-subtext">{new Date(tx.date).toLocaleString()}</div>
        {tx.hash && (
          <div className="text-xs text-subtext break-all">{tx.hash}</div>
        )}
      </div>
      <div className={amountClass}>{tx.amount}</div>
    </div>
  );
}
