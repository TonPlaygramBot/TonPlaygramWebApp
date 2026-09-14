import React from 'react';
import { createRoot } from 'react-dom/client';
import DominoRoyalArena from '../src/pages/Games/DominoRoyalArena.jsx';

// Render the production arena without the application shell or login flow.
// A true iframe viewport keeps all camera and hand-layout calculations intact.
const params = new URLSearchParams(window.location.search);
if (!params.has('players') && !params.has('playerCount')) {
  params.set('players', '2');
  window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Domino Royal stage root is missing.');
createRoot(rootElement).render(<DominoRoyalArena />);
