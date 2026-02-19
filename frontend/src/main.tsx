import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const solanaWallets = [new PhantomWalletAdapter()];
const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [
    walletConnect({
      projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      metadata: {
        name: 'TonPlaygram',
        description: 'TonPlaygram Wallet Link',
        url: window.location.origin,
        icons: ['https://walletconnect.com/walletconnect-logo.png'],
      },
      showQrModal: true,
    }),
  ],
  transports: {
    [bsc.id]: http(),
  },
});

// Enforce canonical origin for wallet connection flows.
// TonConnect can hang if the manifest URL/origin mismatch.
const CANONICAL_ORIGIN = import.meta.env.VITE_PUBLIC_APP_URL || 'https://tonplaygram-bot.onrender.com';
try {
  const canonicalUrl = new URL(CANONICAL_ORIGIN);
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isLocalhost && canonicalUrl.origin !== window.location.origin) {
    const next = new URL(window.location.href);
    next.protocol = canonicalUrl.protocol;
    next.host = canonicalUrl.host;
    window.location.replace(next.toString());
  }
} catch {
  // ignore bad canonical URL
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TonConnectUIProvider
      // Always point manifest at the canonical origin.
      manifestUrl={`${CANONICAL_ORIGIN.replace(/\/$/, '')}/tonconnect-manifest.json?v=2026-02-18`}
      actionsConfiguration={{
        returnStrategy: 'back',
        // Only used in Telegram WebView; harmless elsewhere.
        twaReturnUrl: window.location.href,
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider endpoint="https://api.mainnet-beta.solana.com">
            <WalletProvider wallets={solanaWallets} autoConnect>
              <App />
            </WalletProvider>
          </ConnectionProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </TonConnectUIProvider>
  </React.StrictMode>,
);
