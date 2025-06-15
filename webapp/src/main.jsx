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

const BACKUP_MANIFEST =
  'https://tonplaygramwebapp.onrender.com/tonconnect-manifest.json';
const BACKUP_KEY = 'manifestBackupExpires';

function WalletApp() {
  const [error, setError] = useState(false);
  const [url, setUrl] = useState(null);

  useEffect(() => {
    async function load() {
      const expiry = Number(localStorage.getItem(BACKUP_KEY));
      const now = Date.now();

      const tryFetch = async (target, fallback) => {
        try {
          const res = await fetch(target);
          if (!res.ok) throw new Error('Manifest fetch failed');
          localStorage.setItem(BACKUP_KEY, String(now + 24 * 60 * 60 * 1000));
          setUrl(target);
        } catch {
          if (fallback) {
            await tryFetch(fallback, null);
          } else {
            setError(true);
          }
        }
      };

      if (expiry && now < expiry) {
        await tryFetch(BACKUP_MANIFEST, null);
      } else {
        await tryFetch(manifestUrl, BACKUP_MANIFEST);
      }
    }

    load();
  }, []);

  if (error) {
    return (
      <div className="p-4 text-red-500">
        Failed to load TonConnect manifest. Check VITE_TONCONNECT_MANIFEST.
      </div>
    );
  }

  if (!url) return null;

  return (
    <TonConnectUIProvider manifestUrl={url}>
      <App />
    </TonConnectUIProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <WalletApp />
  </React.StrictMode>
);
