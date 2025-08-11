import PublicWallet from '../components/PublicWallet.jsx';

export default function GamesWallet() {
  const accountId = import.meta.env.VITE_GAMES_ACCOUNT_ID;
  return <PublicWallet title="Games Wallet" accountId={accountId} />;
}
