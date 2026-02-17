import { useSession } from './auth/useSession';
import { WalletsScreen } from './wallets/WalletsScreen';

export function App() {
  const session = useSession();

  if (session.loading) return <p>Authenticating with Telegram...</p>;
  if (session.missingTelegram) {
    return <p>This Mini App must be opened inside Telegram. Telegram initData is missing.</p>;
  }
  if (session.error) return <p>Auth error: {session.error}</p>;
  if (!session.account) return <p>No account found.</p>;

  return <WalletsScreen session={session} />;
}
