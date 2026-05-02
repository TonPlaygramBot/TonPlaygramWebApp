import React, { useState } from 'react';
import ChessBattleRoyaleStore from './ChessBattleRoyaleStore';
import Tennis from './Tennis';

const games = [
  { key: 'ludo', title: 'Ludo Battle Royale', component: <ChessBattleRoyaleStore /> },
  { key: 'tennis', title: 'Tennis', component: <Tennis /> },
];

export function App() {
  const [selected, setSelected] = useState('tennis');
  const current = games.find((g) => g.key === selected) ?? games[0];

  return (
    <div>
      <div style={{ position: 'fixed', zIndex: 10, top: 8, left: 8, display: 'flex', gap: 8 }}>
        {games.map((g) => (
          <button key={g.key} onClick={() => setSelected(g.key)}>{g.title}</button>
        ))}
      </div>
      {current.component}
    </div>
  );
}
