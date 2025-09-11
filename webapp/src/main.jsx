import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Prevent Telegram in-app browser swipe-down from closing the game
if (window.Telegram?.WebApp?.disableVerticalSwipes) {
  window.Telegram.WebApp.disableVerticalSwipes();
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register a service worker to always fetch the latest files
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => {
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          // When a new service worker takes control, reload to fetch fresh assets
          window.location.reload();
        });
      })
      .catch((error) => {
        console.error('Service worker registration failed:', error);
      });
  });
}
