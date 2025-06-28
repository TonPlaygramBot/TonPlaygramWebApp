import React, { useEffect, useState } from 'react';
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
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(manifestUrl)
      .then((res) => {
        if (!res.ok) throw new Error('Manifest fetch failed');
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Failed to load TonConnect manifest. Check VITE_TONCONNECT_MANIFEST.
      </div>
    );
  }

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
