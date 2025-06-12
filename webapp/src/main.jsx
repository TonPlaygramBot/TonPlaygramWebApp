import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={import.meta.env.VITE_TONCONNECT_MANIFEST || '/tonconnect-manifest.json'}>
      <App />
    </TonConnectUIProvider>
  </React.StrictMode>
);
