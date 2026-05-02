import React, { useState } from 'react';
import TennisRoyalGame from './TennisRoyalGame';

type View = 'games' | 'lobby' | 'game';

export default function GamesPage() {
  const [view, setView] = useState<View>('games');
    
  if (view === 'game') return <TennisRoyalGame />;

  if (view === 'lobby') {
    return (
      <div style={{ minHeight: '100vh', background: '#0b1220', color: 'white', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Tennis Royal Lobby</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ background: '#111827', borderRadius: 12, padding: 10 }}>🇦🇱 You</div>
          <div style={{ background: '#111827', borderRadius: 12, padding: 10 }}>🇺🇸 Rival</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <div>Mode</div>
          <div>1v1 vs AI or Online configured in game module</div>
        </div>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => setView('game')}>Start Match</button>
          <button onClick={() => setView('games')} style={{ marginLeft: 8 }}>Back to Games</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#030712', color: 'white', padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1>Games Page</h1>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 16, padding: 14 }}>
          <h3 style={{ margin: 0 }}>🎾 Tennis Royal</h3>
          <p style={{ margin: '8px 0' }}>1v1 tennis battle with flags avatars, lobby, menu and graphics settings.</p>
          <button onClick={() => setView('lobby')}>Open Lobby</button>
        </div>
      </div>
    </div>
  );
}
