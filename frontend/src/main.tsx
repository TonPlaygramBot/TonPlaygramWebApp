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
import { GoogleOAuthProvider } from '@react-oauth/google';

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
  transports: { [bsc.id]: http() },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'missing-google-client-id'}>
      <TonConnectUIProvider manifestUrl={`${window.location.origin}/tonconnect-manifest.json`}>
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
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
