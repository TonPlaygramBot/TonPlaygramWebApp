import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerTelegramServiceWorker } from './pwa/registerServiceWorker.js';
import { installChunkErrorRecovery } from './utils/cacheRecovery.js';

// Prevent Telegram in-app browser swipe-down from closing the game
if (window.Telegram?.WebApp?.disableVerticalSwipes) {
  window.Telegram.WebApp.disableVerticalSwipes();
}

// Auto-recover from stale caches that can blank the screen
installChunkErrorRecovery();

// Register a Telegram-friendly service worker for instant updates
registerTelegramServiceWorker();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
