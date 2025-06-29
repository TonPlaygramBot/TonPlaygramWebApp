import React from 'react';
import { TonConnectButton as ConnectButton } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const sizeClass = small ? 'px-2 py-0.5 text-sm' : 'px-3 py-1';
  return (
    <div className={`mt-2 ${className}`}>
      <ConnectButton className={`lobby-tile cursor-pointer ${sizeClass}`} />
    </div>
  );
}
