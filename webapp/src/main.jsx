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

// Service worker lifecycle is coordinated inside usePwaUpdater to avoid gameplay interruptions
