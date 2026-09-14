// Runs the production game directly, without the application/account shell.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import FourInRowRoyal from '../src/pages/Games/FourInRowRoyal';
import '../src/index.css';

createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/games/fourinrowroyale?mode=ai&username=You']}>
    <FourInRowRoyal />
  </MemoryRouter>
);
