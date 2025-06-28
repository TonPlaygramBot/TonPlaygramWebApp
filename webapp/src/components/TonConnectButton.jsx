import React from 'react';
import { TonConnectButton as ConnectButton } from '@tonconnect/ui-react';

export default function TonConnectButton() {
  return (
    <div className="mt-2">
      <ConnectButton className="lobby-tile px-3 py-1 cursor-pointer" />
    </div>
  );
}
