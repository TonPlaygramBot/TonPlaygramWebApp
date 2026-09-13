import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import MurlanRoyaleArena from '../pages/Games/MurlanRoyaleArena.jsx';
import '../index.css';

// Standalone offline entry using the production arena, controls and rules.
const params = new URLSearchParams(location.search);
const players = params.get('players') === '2' ? '2' : '4';
createRoot(document.getElementById('root')!).render(
  params.has('portrait') ? <iframe title="Murlan Royal portrait gameplay" src={`?players=${players}`} style={{ display:'block', border:0, width:'min(390px, 100vw)', height:844, margin:'0 auto' }} /> :
  <MemoryRouter><div style={{ height: '100dvh', width: '100%' }}>
    <MurlanRoyaleArena search={`?players=${players}&username=You`} />
  </div></MemoryRouter>
);
