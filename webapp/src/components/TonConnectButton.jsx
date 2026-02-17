import React from 'react';
import { TonConnectButton as ConnectButton } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '' }) {
  const sizeClass = small ? 'scale-90 origin-left' : '';
  return (
    <div className={`mt-2 ${className}`}>
      <div className={sizeClass}>
        <ConnectButton />
      </div>
    </div>
  );
}
