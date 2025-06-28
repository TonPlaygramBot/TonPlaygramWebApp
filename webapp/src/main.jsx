import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Keep manifestUrl definition for tests but TonConnect is disabled
const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST ||
  (import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/tonconnect-manifest.json`
    : `${window.location.origin}/tonconnect-manifest.json`);

function WalletApp() {
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletApp />
  </React.StrictMode>
);
