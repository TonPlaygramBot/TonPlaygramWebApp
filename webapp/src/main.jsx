import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import './index.css';

const manifestUrl =
  import.meta.env.VITE_TONCONNECT_MANIFEST ||
  (import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL}/tonconnect-manifest.json`
    : `${window.location.origin}/tonconnect-manifest.json`);

function WalletApp() {
  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <App />
    </TonConnectUIProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletApp />
  </React.StrictMode>
);
