import React, { useState } from 'react';
import SevenFootShowoodPreview, { TABLES, TableKey } from './SevenFootShowoodPreview';

export default function PoolRoyalLobbyPage() {
  const [selected, setSelected] = useState<TableKey | null>(null);

  if (selected) {
    return <SevenFootShowoodPreview selectedTable={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <main style={{ minHeight: '100vh', background: '#020202', color: 'white', fontFamily: 'system-ui, sans-serif', padding: '14px 10px' }}>
      <section style={{ border: '1px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Pool Royal Lobby</div>
        <div style={{ fontSize: 11, marginTop: 4, color: '#cbd5e1' }}>Choose one table to play. You have exactly 2 options below.</div>
      </section>

      <section style={{ marginTop: 10, display: 'grid', gap: 10 }}>
        {(Object.keys(TABLES) as TableKey[]).map((key) => (
          <article key={key} style={{ border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: 12, background: 'rgba(0,0,0,0.4)' }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{TABLES[key].title}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: '#cbd5e1' }}>{TABLES[key].subtitle}</div>
            <button onClick={() => setSelected(key)} style={{ marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #93c5fd', background: 'rgba(59,130,246,0.24)', color: 'white', fontWeight: 800, fontSize: 12 }}>
              Play on {TABLES[key].mapping.sizeFt}
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
