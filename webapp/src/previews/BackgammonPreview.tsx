import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { BackgammonGame } from '../pages/Games/TavullBattleRoyal.jsx';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <BackgammonGame />
  </MemoryRouter>
);
