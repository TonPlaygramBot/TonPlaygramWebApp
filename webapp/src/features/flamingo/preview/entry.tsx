import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import CommunityWallApp from '../CommunityWallApp';
createRoot(document.getElementById('tonplaygram-wall-preview')!).render(
  <MemoryRouter initialEntries={['/wall']}>
    <CommunityWallApp />
  </MemoryRouter>
);
