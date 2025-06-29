import React from 'react';
import { TonConnectButton as ConnectButton } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const sizeClass = small ? 'px-1 py-0 text-xs' : 'px-3 py-1';
  return (
    <div className={`mt-2 ${className}`}>
      <ConnectButton className={`lobby-tile cursor-pointer ${sizeClass}`} />
    </div>
  );
}
