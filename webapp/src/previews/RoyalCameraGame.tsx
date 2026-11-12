import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '../index.css';

// Render the production game component directly, without account navigation or
// service-worker registration from App. There is no substitute scene/physics.
const PoolRoyal = lazy(() => import('../pages/Games/PoolRoyale.jsx'));
const SnookerRoyal = lazy(() => import('../pages/Games/SnookerRoyal.jsx'));
const snooker = new URLSearchParams(location.search).get('game') === 'snooker';
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <Suspense fallback={<p style={{ padding: 24, color: 'white' }}>Loading practice…</p>}>
      {snooker ? <SnookerRoyal /> : <PoolRoyal />}
    </Suspense>
  </BrowserRouter>
);
