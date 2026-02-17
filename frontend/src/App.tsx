import { GoogleLogin } from '@react-oauth/google';
import { useAccount, useConnect, useSignMessage } from 'wagmi';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState } from 'react';
import { useSession } from './auth/useSession';
import { api } from './lib/api';
import { getTelegramInitData } from './lib/telegram';
import { WalletsScreen } from './wallets/WalletsScreen';
import { ExchangePage } from './exchange/ExchangePage';

export function App() {
  const session = useSession();
  const [page, setPage] = useState<'home' | 'wallets' | 'exchange'>('home');

  const solWallet = useWallet();
  const { address: evmAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { signMessageAsync } = useSignMessage();
  const [tonConnectUI] = useTonConnectUI();
  const tonAddress = useTonAddress();

  const loginTelegram = async () => {
    const initData = getTelegramInitData();
    if (!initData) throw new Error('Open inside Telegram Mini App for Telegram login');
    const data = await api<any>('/api/auth/telegram', { method: 'POST', body: JSON.stringify({ initData }) });
    session.consumeAuth(data);
  };

  const loginGoogle = async (idToken: string) => {
    const data = await api<any>('/api/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) });
    session.consumeAuth(data);
  };

  const loginWallet = async (chain: 'solana' | 'evm' | 'ton') => {
    if (chain === 'solana') {
      if (!solWallet.connected) await solWallet.connect();
      if (!solWallet.publicKey || !solWallet.signMessage) throw new Error('Solana wallet signMessage not supported');
      const nonce = await api<{ nonce: string; message: string }>('/api/auth/wallet/nonce?chain=solana');
      const sig = await solWallet.signMessage(new TextEncoder().encode(nonce.message));
      const data = await api<any>('/api/auth/wallet/verify', {
        method: 'POST',
        body: JSON.stringify({ chain: 'solana', address: solWallet.publicKey.toBase58(), provider: 'phantom', nonce: nonce.nonce, message: nonce.message, signature: Array.from(sig) }),
      });
      session.consumeAuth(data);
      return;
    }

    if (chain === 'evm') {
      if (!isConnected) {
        const wc = connectors[0];
        if (!wc) throw new Error('WalletConnect connector missing');
        connect({ connector: wc });
        throw new Error('Wallet connected. Tap EVM login again to sign.');
      }
      if (!evmAddress) throw new Error('No EVM address');
      const nonce = await api<{ nonce: string; message: string }>('/api/auth/wallet/nonce?chain=evm');
      const signature = await signMessageAsync({ message: nonce.message });
      const data = await api<any>('/api/auth/wallet/verify', {
        method: 'POST',
        body: JSON.stringify({ chain: 'evm', address: evmAddress, provider: 'walletconnect', nonce: nonce.nonce, message: nonce.message, signature }),
      });
      session.consumeAuth(data);
      return;
    }

    const nonce = await api<{ nonce: string; tonProofPayload: string }>('/api/auth/wallet/nonce?chain=ton');
    tonConnectUI.setConnectRequestParameters({ state: 'ready', value: { tonProof: nonce.tonProofPayload } });
    if (!tonAddress) {
      await tonConnectUI.openModal();
      throw new Error('Connect TON wallet first, then tap again');
    }
    const wallet = tonConnectUI.wallet as any;
    const tonProof = wallet?.connectItems?.tonProof?.proof;
    if (!tonProof) throw new Error('TON proof missing');
    const data = await api<any>('/api/auth/wallet/verify', {
      method: 'POST',
      body: JSON.stringify({
        chain: 'ton',
        address: tonAddress,
        provider: wallet?.device?.appName,
        nonce: nonce.nonce,
        tonProof: { timestamp: tonProof.timestamp, domain: tonProof.domain, signature: tonProof.signature, payload: tonProof.payload, publicKey: tonProof.publicKey },
      }),
    });
    session.consumeAuth(data);
  };

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 12 }}>
      <h1>TPC Account Hub</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setPage('home')}>Home</button>
        <button onClick={() => setPage('wallets')} disabled={!session.account}>Wallets</button>
        <button onClick={() => setPage('exchange')}>Exchange</button>
      </div>

      {session.error && <p style={{ color: 'crimson' }}>{session.error}</p>}

      {page === 'home' && (
        <div>
          {!session.account ? (
            <>
              <p>Sign in with Telegram, Google, or any wallet (TON/EVM/Solana).</p>
              <button onClick={() => session.run(loginTelegram).catch(() => {})}>Sign in with Telegram</button>
              <div style={{ margin: '8px 0' }}>
                <GoogleLogin onSuccess={(cred) => { const token = cred.credential; if (!token) return; session.run(() => loginGoogle(token)).catch(() => {}); }} onError={() => session.setError('Google sign-in failed')} />
              </div>
              <button onClick={() => session.run(() => loginWallet('ton')).catch(() => {})}>Connect TON Wallet</button>
              <button onClick={() => session.run(() => loginWallet('evm')).catch(() => {})}>Connect EVM Wallet</button>
              <button onClick={() => session.run(() => loginWallet('solana')).catch(() => {})}>Connect Solana Wallet</button>
            </>
          ) : (
            <>
              <p>Account ID: {session.account.id}</p>
              <p>Primary auth: {session.account.primaryAuthMethod}</p>
              <p>Linked identity: {session.account.telegramUserId ? `Telegram ${session.account.telegramUserId}` : session.account.googleEmail ? `Google ${session.account.googleEmail}` : 'Wallet-only'}</p>
              <button onClick={() => session.logout().catch((e) => alert(e.message))}>Logout</button>
            </>
          )}
        </div>
      )}

      {page === 'wallets' && session.account && <WalletsScreen session={session} />}
      {page === 'exchange' && <ExchangePage />}
    </div>
  );
}
