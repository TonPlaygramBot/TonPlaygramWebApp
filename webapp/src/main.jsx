import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerTelegramServiceWorker } from './pwa/registerServiceWorker.js';
import { warmGameCaches } from './pwa/preloadGames.js';
import { initNativeBridge, isNativeWebView } from './utils/nativeBridge.ts';

async function bootstrap() {
  if (isNativeWebView()) {
    await initNativeBridge();
  }

  // Prevent Telegram in-app browser swipe-down from closing the game
  if (window.Telegram?.WebApp?.disableVerticalSwipes) {
    window.Telegram.WebApp.disableVerticalSwipes();
  }

  // Register a Telegram-friendly service worker for instant updates
  void registerTelegramServiceWorker().finally(warmGameCaches);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
