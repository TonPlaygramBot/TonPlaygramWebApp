import React from 'react';
import { createRoot } from 'react-dom/client';
import { BackgammonGame } from '../../pages/Games/TavullBattleRoyal.jsx';
const root = document.getElementById('backgammon-playable-root');
if (root) createRoot(root).render(<BackgammonGame preview />);
