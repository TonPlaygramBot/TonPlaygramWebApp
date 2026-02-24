import React, { Suspense, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

import Home from './pages/Home.jsx';
import Mining from './pages/Mining.jsx';
import Wallet from './pages/Wallet.jsx';
import Tasks from './pages/Tasks.jsx';
import Referral from './pages/Referral.jsx';
import MyAccount from './pages/MyAccount.jsx';
import Store from './pages/Store.jsx';
import Messages from './pages/Messages.jsx';
import Trending from './pages/Trending.jsx';
import Notifications from './pages/Notifications.jsx';
import InfluencerAdmin from './pages/InfluencerAdmin.jsx';
import Nfts from './pages/Nfts.jsx';
import PlatformStatsDetails from './pages/PlatformStatsDetails.jsx';
import Exchange from './pages/Exchange.jsx';

import SnakeAndLadder from './pages/Games/SnakeAndLadder.jsx';
import SnakeMultiplayer from './pages/Games/SnakeMultiplayer.jsx';
import SnakeResults from './pages/Games/SnakeResults.jsx';
import Lobby from './pages/Games/Lobby.jsx';
import Games from './pages/Games.jsx';
import GameTransactions from './pages/GameTransactions.jsx';
import MiningTransactions from './pages/MiningTransactions.jsx';
import SpinPage from './pages/spin.tsx';
import GoalRush from './pages/Games/GoalRush.jsx';
import GoalRushLobby from './pages/Games/GoalRushLobby.jsx';
import AirHockey from './pages/Games/AirHockey.jsx';
import AirHockeyLobby from './pages/Games/AirHockeyLobby.jsx';
import MurlanRoyale from './pages/Games/MurlanRoyale.jsx';
import MurlanRoyaleLobby from './pages/Games/MurlanRoyaleLobby.jsx';
import LudoBattleRoyal from './pages/Games/LudoBattleRoyal.jsx';
import LudoBattleRoyalLobby from './pages/Games/LudoBattleRoyalLobby.jsx';
import TexasHoldem from './pages/Games/TexasHoldem.jsx';
import TexasHoldemLobby from './pages/Games/TexasHoldemLobby.jsx';
import DominoRoyal from './pages/Games/DominoRoyal.jsx';
import DominoRoyalLobby from './pages/Games/DominoRoyalLobby.jsx';

const ChessBattleRoyal = React.lazy(() => import('./pages/Games/ChessBattleRoyal.jsx'));
const ChessBattleRoyalLobby = React.lazy(() => import('./pages/Games/ChessBattleRoyalLobby.jsx'));
import PoolRoyale from './pages/Games/PoolRoyale.jsx';
import PoolRoyaleLobby from './pages/Games/PoolRoyaleLobby.jsx';
import PoolRoyaleCareer from './pages/Games/PoolRoyaleCareer.jsx';
import SnookerRoyal from './pages/Games/SnookerRoyal.jsx';
import SnookerRoyalLobby from './pages/Games/SnookerRoyalLobby.jsx';
import TableTennisRoyal from './pages/Games/TableTennisRoyal.tsx';
import TableTennisRoyalLobby from './pages/Games/TableTennisRoyalLobby.jsx';

import StoreThumbnailStudioPoolRoyale from './pages/Tools/StoreThumbnailStudioPoolRoyale.jsx';

import Layout from './components/Layout.jsx';
import TonConnectSync from './components/TonConnectSync.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';
import useTelegramFullscreen from './hooks/useTelegramFullscreen.js';
import useStablePortraitViewport from './hooks/useStablePortraitViewport.js';
import useReferralClaim from './hooks/useReferralClaim.js';
import useNativePushNotifications from './hooks/useNativePushNotifications.js';
import { BOT_USERNAME } from './utils/constants.js';
import { isTelegramWebView } from './utils/telegram.js';

export default function App() {
  // Enforce canonical origin for wallet connection flows.
  // TonConnect can hang if the manifest URL/origin mismatch.
  // Keep this as early as possible.
  if (typeof window !== 'undefined') {
    const canonical = import.meta.env.VITE_PUBLIC_APP_URL || 'https://tonplaygram-bot.onrender.com';
    try {
      const canonicalUrl = new URL(canonical);
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (!isLocalhost && canonicalUrl.origin !== window.location.origin) {
        const next = new URL(window.location.href);
        next.protocol = canonicalUrl.protocol;
        next.host = canonicalUrl.host;
        window.location.replace(next.toString());
        return null;
      }
    } catch {
      // ignore bad canonical URL
    }
  }

  useTelegramAuth();
  useTelegramFullscreen();
  useStablePortraitViewport();
  useReferralClaim();
  useNativePushNotifications();

  const canonicalOrigin = useMemo(
    () => import.meta.env.VITE_PUBLIC_APP_URL || 'https://tonplaygram-bot.onrender.com',
    [],
  );

  // Always load the TonConnect manifest from the canonical origin.
  // This avoids wallet prompts like "connect to tonplaygram.com" when the app is opened
  // under an unexpected domain (Telegram proxy domains, mirrors, etc.).
  const manifestUrl = useMemo(() => {
    const canon = canonicalOrigin.replace(/\/$/, '');
    // Cache-bust manifest so wallets always read the latest app name/icon.
    return `${canon}/tonconnect-manifest.json?v=2026-02-18`;
  }, [canonicalOrigin]);
  const returnUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.href) {
      const currentUrl = new URL(window.location.href);
      currentUrl.hash = '';
      return currentUrl.toString();
    }
    return new URL(import.meta.env.BASE_URL || '/', canonicalOrigin).toString();
  }, [canonicalOrigin]);
  const telegramReturnUrl = `https://t.me/${BOT_USERNAME}?startapp=account`;
  const actionsConfiguration = useMemo(
    () => ({
      // TonConnect expects a strategy keyword here (not a URL).
      // "back" works across regular browsers + Telegram webview.
      returnStrategy: 'back',
      // Where TonConnect should return the user after approving in-wallet.
      twaReturnUrl: isTelegramWebView() ? telegramReturnUrl : returnUrl,
    }),
    [returnUrl, telegramReturnUrl],
  );

  return (
    <BrowserRouter>
      <TonConnectUIProvider
        manifestUrl={manifestUrl}
        actionsConfiguration={actionsConfiguration}
      >
        <TonConnectSync />
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mining" element={<Mining />} />
            <Route
              path="/mining/transactions"
              element={<MiningTransactions />}
            />
            <Route path="/games" element={<Games />} />
            <Route path="/games/transactions" element={<GameTransactions />} />
            <Route path="/games/:game/lobby" element={<Lobby />} />
            <Route path="/games/snake" element={<SnakeAndLadder />} />
            <Route path="/games/snake/mp" element={<SnakeMultiplayer />} />
            <Route path="/games/snake/results" element={<SnakeResults />} />
            <Route path="/games/goalrush/lobby" element={<GoalRushLobby />} />
            <Route path="/games/goalrush" element={<GoalRush />} />
            <Route path="/games/airhockey/lobby" element={<AirHockeyLobby />} />
            <Route path="/games/airhockey" element={<AirHockey />} />
            <Route
              path="/games/chessbattleroyal/lobby"
              element={(
                <Suspense fallback={<div className="p-4 text-center">Loading Chess Lobby…</div>}>
                  <ChessBattleRoyalLobby />
                </Suspense>
              )}
            />
            <Route
              path="/games/chessbattleroyal"
              element={(
                <Suspense fallback={<div className="p-4 text-center">Loading Chess Battle Royal…</div>}>
                  <ChessBattleRoyal />
                </Suspense>
              )}
            />
            <Route
              path="/games/ludobattleroyal/lobby"
              element={<LudoBattleRoyalLobby />}
            />
            <Route
              path="/games/ludobattleroyal"
              element={<LudoBattleRoyal />}
            />
            <Route
              path="/games/texasholdem/lobby"
              element={<TexasHoldemLobby />}
            />
            <Route path="/games/texasholdem" element={<TexasHoldem />} />
            <Route
              path="/games/domino-royal/lobby"
              element={<DominoRoyalLobby />}
            />
            <Route path="/games/domino-royal" element={<DominoRoyal />} />
            <Route
              path="/games/murlanroyale/lobby"
              element={<MurlanRoyaleLobby />}
            />
            <Route path="/games/murlanroyale" element={<MurlanRoyale />} />
            <Route
              path="/games/poolroyale/lobby"
              element={<PoolRoyaleLobby />}
            />
            <Route
              path="/games/poolroyale/career"
              element={<PoolRoyaleCareer />}
            />
            <Route path="/games/poolroyale" element={<PoolRoyale />} />
            <Route
              path="/games/snookerroyale/lobby"
              element={<SnookerRoyalLobby />}
            />
            <Route path="/games/snookerroyale" element={<SnookerRoyal />} />
            <Route
              path="/games/tabletennisroyal/lobby"
              element={<TableTennisRoyalLobby />}
            />
            <Route path="/games/tabletennisroyal" element={<TableTennisRoyal />} />
            <Route
              path="/games/pollroyale/lobby"
              element={<Navigate to="/games/poolroyale/lobby" replace />}
            />
            <Route
              path="/games/pollroyale"
              element={<Navigate to="/games/poolroyale" replace />}
            />
            <Route path="/spin" element={<SpinPage />} />
            <Route path="/admin/influencer" element={<InfluencerAdmin />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/store" element={<Navigate to="/store/all" replace />} />
            <Route path="/store/:gameSlug" element={<Store />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/account" element={<MyAccount />} />
            <Route path="/nfts" element={<Nfts />} />
            <Route path="/platform-stats" element={<PlatformStatsDetails />} />
            <Route path="/exchange" element={<Exchange />} />
            {/* Internal tools (used for automated store thumbnail generation) */}
            <Route
              path="/tools/store-thumb/poolroyale/table-finish/:finishId"
              element={<StoreThumbnailStudioPoolRoyale />}
            />
          </Routes>
        </Layout>
      </TonConnectUIProvider>
    </BrowserRouter>
  );
}
