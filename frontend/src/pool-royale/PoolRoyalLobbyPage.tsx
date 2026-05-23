import React from 'react';
import SevenFootShowoodPreview from './SevenFootShowoodPreview';

export default function PoolRoyalLobbyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#010101' }}>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.9), rgba(0,0,0,0.35))',
          padding: '8px 10px 14px',
          color: '#e2e8f0',
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 900, color: '#ffffff' }}>Pool Royal · Lobby Page</div>
        <div style={{ fontSize: 11, marginTop: 2 }}>
          Chinese 8-Ball now uses 9ft mapping. Snooker uses 7ft Showood mapping. Both use same setup menu.
        </div>
      </header>
      <SevenFootShowoodPreview />
    </div>
  );
}
