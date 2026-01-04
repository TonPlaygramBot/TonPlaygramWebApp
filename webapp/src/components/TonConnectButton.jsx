import React from 'react';
import { TonConnectButton as ConnectButton } from '@tonconnect/ui-react';

export default function TonConnectButton({ small = false, className = '', fullWidth = false }) {
  const sizeClass = small ? 'px-1 py-0 text-xs' : 'px-3 py-1';
  const widthClass = fullWidth ? 'w-full justify-center' : '';
  return (
    <div className={`mt-2 ${className}`}>
      <ConnectButton className={`lobby-tile cursor-pointer ${sizeClass} ${widthClass}`} />
    </div>
  );
}
