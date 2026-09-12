import React from 'react';
import { createRoot } from 'react-dom/client';
import KartRoyale from './BaseKartRoyale';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <KartRoyale />
  </React.StrictMode>
);
