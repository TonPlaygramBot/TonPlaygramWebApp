import React from 'react';
import ReactDOM from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import './index.css';
import { registerTelegramServiceWorker } from './pwa/registerServiceWorker.js';
import { warmGameCaches } from './pwa/preloadGames.js';
import { initNativeBridge } from './utils/nativeBridge.ts';
import { setupNativePushNotifications } from './utils/pushNotifications.js';

async function bootstrap() {
  if (Capacitor.isNativePlatform()) {
    await initNativeBridge();
    void setupNativePushNotifications();
  }

  // Prevent Telegram in-app browser swipe-down from closing the game
  if (window.Telegram?.WebApp?.disableVerticalSwipes) {
    window.Telegram.WebApp.disableVerticalSwipes();
  }

  // Register a Telegram-friendly service worker for instant updates
  const registered = await registerTelegramServiceWorker();
  if (registered) {
    warmGameCaches();
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

void bootstrap();
