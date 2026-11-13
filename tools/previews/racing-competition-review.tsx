import React from 'react';
import {createRoot} from 'react-dom/client';
import BaseKartRoyale from '../../webapp/src/games/kartroyale/BaseKartRoyale';

// Uses the production garage, renderer, simulation, audio and touch controls.
// Matchmaking is disabled because this standalone review has no account server.
createRoot(document.getElementById('root')!).render(<BaseKartRoyale playerName="You"/>);
