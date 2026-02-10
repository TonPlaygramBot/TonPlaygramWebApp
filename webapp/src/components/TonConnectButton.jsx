import React, { useCallback } from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const [tonConnectUI] = useTonConnectUI();
  const walletAddress = useTonAddress();
  const sizeClass = small ? 'px-1 py-0 text-xs' : 'px-3 py-1';
  const label = walletAddress ? 'Wallet connected' : 'Connect TON Wallet';
  const handleClick = useCallback(() => {
    tonConnectUI.openModal();
  }, [tonConnectUI]);
  return (
    <div className={`mt-2 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        className={`lobby-tile cursor-pointer ${sizeClass}`}
      >
        {label}
      </button>
    </div>
  );
}
