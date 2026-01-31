import React from 'react';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const [tonConnectUI] = useTonConnectUI();
  const address = useTonAddress();
  const sizeClass = small ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm';

  const handleClick = () => {
    if (!tonConnectUI) return;
    if (address) {
      tonConnectUI.disconnect();
    } else {
      tonConnectUI.openModal();
    }
  };

  const label = address ? 'TON Wallet Connected' : 'Connect TON Wallet';
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`lobby-tile cursor-pointer w-full ${sizeClass} ${className}`}
    >
      {label}
    </button>
  );
}
