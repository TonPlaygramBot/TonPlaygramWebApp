import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom';
import PoolRoyaleCareer from '../pages/Games/PoolRoyaleCareer.jsx';
import { PoolBracket } from '../games/pool/PoolCompetitionMatch.jsx';
import { createPoolCompetition } from '../games/pool/competition.js';
import GameLiveAvatarOverlay from '../components/GameLiveAvatarOverlay.jsx';
import '../index.css';
import '../games/pool/competition.css';

const PoolRoyale = lazy(() => import('../pages/Games/PoolRoyale.jsx'));
function TournamentPreview() {
  const [size, setSize] = useState(8);
  const event = React.useMemo(() => createPoolCompetition({ players: size, name: 'You', id: 'portrait-review' }), [size]);
  const navigate = useNavigate();
  return <main className="pr-tour"><p className="pr-eyebrow">Pool Royal · Portrait review</p><h1>The road to<br/>Royal champion.</h1><p className="pr-muted">Preview the production bracket. Select a round to inspect each match.</p><div className="pr-filter">{[8, 16, 32].map(count => <button key={count} aria-pressed={size === count} onClick={() => setSize(count)}>{count} players</button>)}</div><PoolBracket key={size} event={event}/><button className="pr-primary" onClick={() => navigate(`/games/poolroyale?competition=1&type=tournament&mode=ai&variant=american&players=${size}`)}>Play vs AI →</button><button className="pr-secondary" onClick={() => navigate('/games/poolroyale?type=tournament&mode=online&variant=american')}>Online tournament</button><button className="pr-secondary" onClick={() => navigate('/games/poolroyale/career')}>Explore career & gifts</button></main>;
}
createRoot(document.getElementById('root')!).render(<HashRouter><Suspense fallback={<p style={{ color: 'white', padding: 24 }}>Loading Pool Royal…</p>}><Routes>
  <Route path="/games/poolroyale/career" element={<PoolRoyaleCareer/>}/>
  <Route path="/games/poolroyale" element={<GameLiveAvatarOverlay gameSlug="poolroyale" onlineOnly><PoolRoyale/></GameLiveAvatarOverlay>}/>
  <Route path="*" element={<TournamentPreview/>}/>
</Routes></Suspense></HashRouter>);
