import PublicWallet from '../components/PublicWallet.jsx';

export default function DevelopmentWallet() {
  const accountId = import.meta.env.VITE_DEV_WALLET_ID;
  return <PublicWallet title="Development Wallet" accountId={accountId} />;
}
