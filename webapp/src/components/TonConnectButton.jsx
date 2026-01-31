import React from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();
  const sizeClass = small ? 'px-1 py-0 text-xs' : 'px-3 py-1';
  const label = tonAddress ? 'Wallet connected' : 'Connect TON Wallet';
  const handleClick = () => {
    if (!tonConnectUI) return;
    tonConnectUI.openModal();
  };
  return (
    <div className={`mt-2 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`lobby-tile cursor-pointer ${sizeClass} w-full`}
        aria-label={tonAddress ? 'TON wallet connected' : 'Connect TON wallet'}
      >
        {label}
      </button>
    </div>
  );
}
