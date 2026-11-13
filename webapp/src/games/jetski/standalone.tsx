import React from 'react';
import { createRoot } from 'react-dom/client';
import JetskiGame from './Game';
createRoot(document.getElementById('root')!).render(
  <JetskiGame
    preview
    onExit={() =>
      window.location.assign('https://tonplaygram-bot.onrender.com/games')
    }
  />
);
