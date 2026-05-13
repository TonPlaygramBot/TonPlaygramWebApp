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
import Notifications from './pages/Notifications.jsx';
import InfluencerAdmin from './pages/InfluencerAdmin.jsx';
import Nfts from './pages/Nfts.jsx';
import PlatformStatsDetails from './pages/PlatformStatsDetails.jsx';
import Exchange from './pages/Exchange.jsx';
import Layout from './components/Layout.jsx';
import TonConnectSync from './components/TonConnectSync.jsx';
import GameLiveAvatarOverlay from './components/GameLiveAvatarOverlay.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';
import useTelegramFullscreen from './hooks/useTelegramFullscreen.js';
import useMobileFullscreen from './hooks/useMobileFullscreen.js';
import useReferralClaim from './hooks/useReferralClaim.js';
import useNativePushNotifications from './hooks/useNativePushNotifications.js';
import { BOT_USERNAME } from './utils/constants.js';
import { isTelegramWebView } from './utils/telegram.js';

const SnakeAndLadder = React.lazy(
  () => import('./pages/Games/SnakeAndLadder.jsx')
);
const SnakeMultiplayer = React.lazy(
  () => import('./pages/Games/SnakeMultiplayer.jsx')
);
const SnakeResults = React.lazy(() => import('./pages/Games/SnakeResults.jsx'));
const Lobby = React.lazy(() => import('./pages/Games/Lobby.jsx'));
const Games = React.lazy(() => import('./pages/Games.jsx'));
const GameTransactions = React.lazy(
  () => import('./pages/GameTransactions.jsx')
);
const MiningTransactions = React.lazy(
  () => import('./pages/MiningTransactions.jsx')
);
const SpinPage = React.lazy(() => import('./pages/spin.tsx'));
const GoalRush = React.lazy(() => import('./pages/Games/GoalRush.jsx'));
const GoalRushLobby = React.lazy(
  () => import('./pages/Games/GoalRushLobby.jsx')
);
const AirHockey = React.lazy(() => import('./pages/Games/AirHockey.jsx'));
const AirHockeyLobby = React.lazy(
  () => import('./pages/Games/AirHockeyLobby.jsx')
);
const MurlanRoyale = React.lazy(() => import('./pages/Games/MurlanRoyale.jsx'));
const MurlanRoyaleLobby = React.lazy(
  () => import('./pages/Games/MurlanRoyaleLobby.jsx')
);
const LudoBattleRoyal = React.lazy(
  () => import('./pages/Games/LudoBattleRoyal.jsx')
);
const LudoBattleRoyalLobby = React.lazy(
  () => import('./pages/Games/LudoBattleRoyalLobby.jsx')
);
const TexasHoldem = React.lazy(() => import('./pages/Games/TexasHoldem.jsx'));
const TexasHoldemLobby = React.lazy(
  () => import('./pages/Games/TexasHoldemLobby.jsx')
);
const DominoRoyal = React.lazy(() => import('./pages/Games/DominoRoyal.jsx'));
const DominoRoyalLobby = React.lazy(
  () => import('./pages/Games/DominoRoyalLobby.jsx')
);

const ChessBattleRoyal = React.lazy(
  () => import('./pages/Games/ChessBattleRoyal.jsx')
);
const ChessBattleRoyalLobby = React.lazy(
  () => import('./pages/Games/ChessBattleRoyalLobby.jsx')
);
const CheckersBattleRoyal = React.lazy(
  () => import('./pages/Games/CheckersBattleRoyal.jsx')
);
const CheckersBattleRoyalLobby = React.lazy(
  () => import('./pages/Games/CheckersBattleRoyalLobby.jsx')
);
const FourInRowRoyal = React.lazy(
  () => import('./pages/Games/FourInRowRoyal.jsx')
);
const FourInRowRoyalLobby = React.lazy(
  () => import('./pages/Games/FourInRowRoyalLobby.jsx')
);
const TavullBattleRoyal = React.lazy(
  () => import('./pages/Games/TavullBattleRoyal.jsx')
);
const TavullBattleRoyalLobby = React.lazy(
  () => import('./pages/Games/TavullBattleRoyalLobby.jsx')
);
const PoolRoyale = React.lazy(() => import('./pages/Games/PoolRoyale.jsx'));
const PoolRoyaleLobby = React.lazy(
  () => import('./pages/Games/PoolRoyaleLobby.jsx')
);
const PoolRoyaleCareer = React.lazy(
  () => import('./pages/Games/PoolRoyaleCareer.jsx')
);
const SnookerRoyal = React.lazy(() => import('./pages/Games/SnookerRoyal.jsx'));
const SnookerRoyalLobby = React.lazy(
  () => import('./pages/Games/SnookerRoyalLobby.jsx')
);
const Tennis = React.lazy(() => import('./pages/Games/Tennis.tsx'));
const TableTennis = React.lazy(() => import('./pages/Games/TableTennis.tsx'));
const TennisLobby = React.lazy(() => import('./pages/Games/TennisLobby.jsx'));
const BowlingRealistic = React.lazy(
  () => import('./pages/Games/BowlingRealistic.tsx')
);
const FreeKickArena = React.lazy(
  () => import('./pages/Games/FreeKickArena.tsx')
);
const ShootingRange = React.lazy(
  () => import('./pages/Games/ShootingRange.tsx')
);
const StoreThumbnailStudioPoolRoyale = React.lazy(
  () => import('./pages/Tools/StoreThumbnailStudioPoolRoyale.jsx')
);

export default function App() {
  // Enforce canonical origin for wallet connection flows.
  // TonConnect can hang if the manifest URL/origin mismatch.
  // Keep this as early as possible.
  if (typeof window !== 'undefined') {
    const canonical =
      import.meta.env.VITE_PUBLIC_APP_URL ||
      'https://tonplaygram-bot.onrender.com';
    try {
      const canonicalUrl = new URL(canonical);
      const isLocalhost =
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';
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
  useMobileFullscreen();
  useReferralClaim();
  useNativePushNotifications();

  const canonicalOrigin = useMemo(
    () =>
      import.meta.env.VITE_PUBLIC_APP_URL ||
      'https://tonplaygram-bot.onrender.com',
    []
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
      twaReturnUrl: isTelegramWebView() ? telegramReturnUrl : returnUrl
    }),
    [returnUrl, telegramReturnUrl]
  );

  return (
    <BrowserRouter>
      <TonConnectUIProvider
        manifestUrl={manifestUrl}
        actionsConfiguration={actionsConfiguration}
      >
        <TonConnectSync />
        <Layout>
          <Suspense
            fallback={
              <div className="p-4 text-center">Loading TonPlaygram…</div>
            }
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/mining" element={<Mining />} />
              <Route
                path="/mining/transactions"
                element={<MiningTransactions />}
              />
              <Route path="/games" element={<Games />} />
              <Route
                path="/games/transactions"
                element={<GameTransactions />}
              />
              <Route path="/games/:game/lobby" element={<Lobby />} />
              <Route
                path="/games/snake"
                element={
                  <GameLiveAvatarOverlay gameSlug="snake">
                    <SnakeAndLadder />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route path="/games/snake/mp" element={<SnakeMultiplayer />} />
              <Route path="/games/snake/results" element={<SnakeResults />} />
              <Route path="/games/goalrush/lobby" element={<GoalRushLobby />} />
              <Route
                path="/games/goalrush"
                element={
                  <GameLiveAvatarOverlay gameSlug="goalrush">
                    <GoalRush />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/airhockey/lobby"
                element={<AirHockeyLobby />}
              />
              <Route path="/games/airhockey" element={<AirHockey />} />
              <Route path="/games/freekickarena" element={<FreeKickArena />} />
              <Route
                path="/games/chessbattleroyal/lobby"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Chess Lobby…
                      </div>
                    }
                  >
                    <ChessBattleRoyalLobby />
                  </Suspense>
                }
              />
              <Route
                path="/games/chessbattleroyal"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Chess Battle Royal…
                      </div>
                    }
                  >
                    <GameLiveAvatarOverlay gameSlug="chessbattleroyal">
                      <ChessBattleRoyal />
                    </GameLiveAvatarOverlay>
                  </Suspense>
                }
              />
              <Route
                path="/games/checkersbattleroyal/lobby"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Checkers Lobby…
                      </div>
                    }
                  >
                    <CheckersBattleRoyalLobby />
                  </Suspense>
                }
              />
              <Route
                path="/games/checkersbattleroyal"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Checkers Battle Royal…
                      </div>
                    }
                  >
                    <GameLiveAvatarOverlay gameSlug="checkersbattleroyal">
                      <CheckersBattleRoyal />
                    </GameLiveAvatarOverlay>
                  </Suspense>
                }
              />
              <Route
                path="/games/fourinrowroyale/lobby"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading 4 in a Row Lobby…
                      </div>
                    }
                  >
                    <FourInRowRoyalLobby />
                  </Suspense>
                }
              />
              <Route
                path="/games/fourinrowroyale"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">Loading 4 in a Row…</div>
                    }
                  >
                    <GameLiveAvatarOverlay gameSlug="fourinrowroyale">
                      <FourInRowRoyal />
                    </GameLiveAvatarOverlay>
                  </Suspense>
                }
              />
              <Route
                path="/games/tavullbattleroyal/lobby"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Backgammon Lobby…
                      </div>
                    }
                  >
                    <TavullBattleRoyalLobby />
                  </Suspense>
                }
              />
              <Route
                path="/games/tavullbattleroyal"
                element={
                  <Suspense
                    fallback={
                      <div className="p-4 text-center">
                        Loading Backgammon Royal…
                      </div>
                    }
                  >
                    <GameLiveAvatarOverlay gameSlug="tavullbattleroyal">
                      <TavullBattleRoyal />
                    </GameLiveAvatarOverlay>
                  </Suspense>
                }
              />
              <Route
                path="/games/ludobattleroyal/lobby"
                element={<LudoBattleRoyalLobby />}
              />
              <Route
                path="/games/ludobattleroyal"
                element={
                  <GameLiveAvatarOverlay gameSlug="ludobattleroyal">
                    <LudoBattleRoyal />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/texasholdem/lobby"
                element={<TexasHoldemLobby />}
              />
              <Route
                path="/games/texasholdem"
                element={
                  <GameLiveAvatarOverlay gameSlug="texasholdem">
                    <TexasHoldem />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/domino-royal/lobby"
                element={<DominoRoyalLobby />}
              />
              <Route
                path="/games/domino-royal"
                element={
                  <GameLiveAvatarOverlay gameSlug="domino-royal">
                    <DominoRoyal />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/murlanroyale/lobby"
                element={<MurlanRoyaleLobby />}
              />
              <Route
                path="/games/murlanroyale"
                element={
                  <GameLiveAvatarOverlay gameSlug="murlanroyale">
                    <MurlanRoyale />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/poolroyale/lobby"
                element={<PoolRoyaleLobby />}
              />
              <Route
                path="/games/poolroyale/career"
                element={<PoolRoyaleCareer />}
              />
              <Route
                path="/games/poolroyale"
                element={
                  <GameLiveAvatarOverlay gameSlug="poolroyale">
                    <PoolRoyale />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route path="/games/tennis/lobby" element={<TennisLobby />} />
              <Route
                path="/games/tennis"
                element={
                  <GameLiveAvatarOverlay gameSlug="tennis">
                    <Tennis />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/table-tennis"
                element={
                  <GameLiveAvatarOverlay gameSlug="table-tennis">
                    <TableTennis />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/bowling"
                element={
                  <GameLiveAvatarOverlay gameSlug="bowling">
                    <BowlingRealistic />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/shootingrange/lobby"
                element={<Navigate to="/games/shootingrange" replace />}
              />
              <Route
                path="/games/shootingrange"
                element={
                  <GameLiveAvatarOverlay gameSlug="shootingrange">
                    <ShootingRange />
                  </GameLiveAvatarOverlay>
                }
              />
              <Route
                path="/games/snookerroyale/lobby"
                element={<SnookerRoyalLobby />}
              />{' '}
              <Route
                path="/games/snookerroyale"
                element={
                  <GameLiveAvatarOverlay gameSlug="snookerroyale">
                    <SnookerRoyal />
                  </GameLiveAvatarOverlay>
                }
              />
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
              <Route
                path="/store"
                element={<Navigate to="/store/all" replace />}
              />
              <Route path="/store/:gameSlug" element={<Store />} />
              <Route path="/referral" element={<Referral />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route
                path="/trending"
                element={<Navigate to="/messages" replace />}
              />
              <Route path="/account" element={<MyAccount />} />
              <Route path="/nfts" element={<Nfts />} />
              <Route
                path="/platform-stats"
                element={<PlatformStatsDetails />}
              />
              <Route path="/exchange" element={<Exchange />} />
              {/* Internal tools (used for automated store thumbnail generation) */}
              <Route
                path="/tools/store-thumb/poolroyale/table-finish/:finishId"
                element={<StoreThumbnailStudioPoolRoyale />}
              />
            </Routes>
          </Suspense>
        </Layout>
      </TonConnectUIProvider>
    </BrowserRouter>
  );
}
