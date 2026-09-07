import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import ArcheryRoyalGame from './ArcheryRoyalGame';

createRoot(document.getElementById('archery-royal-preview')!).render(
  <MemoryRouter initialEntries={['/?mode=ai&difficulty=tour&arena=royal-grounds']}>
    <ArcheryRoyalGame onLobby={() => {}} preview />
  </MemoryRouter>
);
