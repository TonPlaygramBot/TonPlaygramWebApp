import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import './index.css';
import { registerTelegramServiceWorker } from './pwa/registerServiceWorker.js';
import { warmGameCaches } from './pwa/preloadGames.js';
import { initNativeBridge } from './utils/nativeBridge.ts';

async function bootstrap() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    await initNativeBridge();
  }

  // Prevent Telegram in-app browser swipe-down from closing the game
  if (window.Telegram?.WebApp?.disableVerticalSwipes) {
    window.Telegram.WebApp.disableVerticalSwipes();
  }

  if (!isNative) {
    // Register a Telegram-friendly service worker for instant updates
    void registerTelegramServiceWorker().finally(warmGameCaches);
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
