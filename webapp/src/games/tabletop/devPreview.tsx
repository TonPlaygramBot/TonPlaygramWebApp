// Development-only entry. Vite's production entry remains index.html and App.jsx.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import Lobby from './Lobby';
import Game from './Game';
import { TABLETOP_GAMES } from './shared/catalog.mjs';
function Catalog() {
  return (
    <main className="tt-lobby">
      <h1>Tabletop collection</h1>
      <p>Five original games · free AI practice</p>
      {TABLETOP_GAMES.map((g) => (
        <p key={g.id}>
          <Link style={{ color: g.color }} to={`/games/${g.id}/lobby`}>
            {g.name}
          </Link>
        </p>
      ))}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/games/oligarchs?mode=ai&players=4']}>
    <Routes>
      <Route path="/games" element={<Catalog />} />
      {TABLETOP_GAMES.map((g) => (
        <React.Fragment key={g.id}>
          <Route
            path={`/games/${g.id}`}
            element={<Game key={g.id} gameId={g.id} />}
          />
          <Route
            path={`/games/${g.id}/lobby`}
            element={<Lobby key={g.id} gameId={g.id} />}
          />
        </React.Fragment>
      ))}
    </Routes>
  </MemoryRouter>
);
