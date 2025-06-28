import React from 'react';

export default function AirdropPopup({ open, onClaim }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70" style={{ zIndex: 60 }}>
      <div className="prism-box p-6 space-y-4 text-text w-80">
        <h3 className="text-lg font-bold text-center">Airdrop</h3>
        <div className="flex justify-center gap-2">
          <div className="prism-box w-8 h-8" />
          <div className="prism-box w-8 h-8" />
          <div className="prism-box w-8 h-8" />
        </div>
        <p className="text-sm text-center">Thank you for your support dev</p>
        <button onClick={onClaim} className="w-full lobby-tile text-sm">Claim 10k TPC</button>
      </div>
    </div>
  );
}
