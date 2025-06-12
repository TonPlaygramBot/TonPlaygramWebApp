import React from 'react';
import ConnectWallet from './ConnectWallet.jsx';

export default function Branding() {
  return (
    <div className="text-center py-6 space-y-2">
      <div className="hexagon w-16 h-16 mx-auto bg-accent flex items-center justify-center">
        <span className="text-3xl font-extrabold text-background">P</span>
      </div>
      <h1 className="text-2xl font-bold text-text">TONPLAYGRAM</h1>
      <p className="text-accent text-xs tracking-widest">PLAY. EARN. DOMINATE.</p>
      <div className="flex justify-center">
        <ConnectWallet />
      </div>
    </div>
  );
}
