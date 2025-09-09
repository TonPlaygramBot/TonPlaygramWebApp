import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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

import SnakeAndLadder from './pages/Games/SnakeAndLadder.jsx';
import SnakeMultiplayer from './pages/Games/SnakeMultiplayer.jsx';
import SnakeResults from './pages/Games/SnakeResults.jsx';
import CrazyDiceDuel from './pages/Games/CrazyDiceDuel.jsx';
import CrazyDiceLobby from './pages/Games/CrazyDiceLobby.jsx';
import Lobby from './pages/Games/Lobby.jsx';
import Games from './pages/Games.jsx';
import GameTransactions from './pages/GameTransactions.jsx';
import MiningTransactions from './pages/MiningTransactions.jsx';
import SpinPage from './pages/spin.tsx';
import FallingBall from './pages/Games/FallingBall.jsx';
import FallingBallLobby from './pages/Games/FallingBallLobby.jsx';
import GoalRush from './pages/Games/GoalRush.jsx';
import GoalRushLobby from './pages/Games/GoalRushLobby.jsx';
import FreeKick from './pages/Games/FreeKick.jsx';
import FreeKickLobby from './pages/Games/FreeKickLobby.jsx';
import BrickBreaker from './pages/Games/BrickBreaker.jsx';
import BrickBreakerLobby from './pages/Games/BrickBreakerLobby.jsx';
import TetrisRoyale from './pages/Games/TetrisRoyale.jsx';
import TetrisRoyaleLobby from './pages/Games/TetrisRoyaleLobby.jsx';
import FruitSliceRoyale from './pages/Games/FruitSliceRoyale.jsx';
import FruitSliceRoyaleLobby from './pages/Games/FruitSliceRoyaleLobby.jsx';
import BubblePopRoyale from './pages/Games/BubblePopRoyale.jsx';
import BubblePopRoyaleLobby from './pages/Games/BubblePopRoyaleLobby.jsx';
import BubbleSmashRoyale from './pages/Games/BubbleSmashRoyale.jsx';
import BubbleSmashRoyaleLobby from './pages/Games/BubbleSmashRoyaleLobby.jsx';
import MurlanRoyale from './pages/Games/MurlanRoyale.jsx';
import MurlanRoyaleLobby from './pages/Games/MurlanRoyaleLobby.jsx';
import TennisBattleRoyal from './pages/Games/TennisBattleRoyal.jsx';
import TennisBattleRoyalLobby from './pages/Games/TennisBattleRoyalLobby.jsx';
import ChessBattleRoyal from './pages/Games/ChessBattleRoyal.jsx';
import ChessBattleRoyalLobby from './pages/Games/ChessBattleRoyalLobby.jsx';
import TexasHoldem from './pages/Games/TexasHoldem.jsx';
import TexasHoldemLobby from './pages/Games/TexasHoldemLobby.jsx';
import BlackJack from './pages/Games/BlackJack.jsx';
import BlackJackLobby from './pages/Games/BlackJackLobby.jsx';
import PoolRoyale from './pages/Games/PoolRoyale.jsx';
import PoolRoyaleLobby from './pages/Games/PoolRoyaleLobby.jsx';
import Snooker from './pages/Games/Snooker.jsx';
import Roulette from './pages/Games/Roulette.jsx';

import Layout from './components/Layout.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';
import useReferralClaim from './hooks/useReferralClaim.js';

export default function App() {
  useTelegramAuth();
  useReferralClaim();

  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

  return (
    <BrowserRouter>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
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
            <Route path="/games/crazydice" element={<CrazyDiceDuel />} />
            <Route path="/games/crazydice/lobby" element={<CrazyDiceLobby />} />
            <Route path="/games/:game/lobby" element={<Lobby />} />
            <Route path="/games/snake" element={<SnakeAndLadder />} />
            <Route path="/games/snake/mp" element={<SnakeMultiplayer />} />
            <Route path="/games/snake/results" element={<SnakeResults />} />
            <Route
              path="/games/fallingball/lobby"
              element={<FallingBallLobby />}
            />
            <Route path="/games/fallingball" element={<FallingBall />} />
            <Route path="/games/goalrush/lobby" element={<GoalRushLobby />} />
            <Route path="/games/goalrush" element={<GoalRush />} />
            <Route path="/games/freekick/lobby" element={<FreeKickLobby />} />
            <Route path="/games/freekick" element={<FreeKick />} />
            <Route
              path="/games/brickbreaker/lobby"
              element={<BrickBreakerLobby />}
            />
            <Route path="/games/brickbreaker" element={<BrickBreaker />} />
            <Route
              path="/games/tetrisroyale/lobby"
              element={<TetrisRoyaleLobby />}
            />
            <Route path="/games/tetrisroyale" element={<TetrisRoyale />} />
            <Route
              path="/games/fruitsliceroyale/lobby"
              element={<FruitSliceRoyaleLobby />}
            />
            <Route
              path="/games/fruitsliceroyale"
              element={<FruitSliceRoyale />}
            />
            <Route
              path="/games/bubblepoproyale/lobby"
              element={<BubblePopRoyaleLobby />}
            />
            <Route
              path="/games/bubblepoproyale"
              element={<BubblePopRoyale />}
            />
            <Route
              path="/games/bubblesmashroyale/lobby"
              element={<BubbleSmashRoyaleLobby />}
            />
            <Route
              path="/games/bubblesmashroyale"
              element={<BubbleSmashRoyale />}
            />
            <Route
              path="/games/tennisbattleroyal/lobby"
              element={<TennisBattleRoyalLobby />}
            />
            <Route
              path="/games/tennisbattleroyal"
              element={<TennisBattleRoyal />}
            />
            <Route
              path="/games/chessbattleroyal/lobby"
              element={<ChessBattleRoyalLobby />}
            />
            <Route
              path="/games/chessbattleroyal"
              element={<ChessBattleRoyal />}
            />
            <Route
              path="/games/texasholdem/lobby"
              element={<TexasHoldemLobby />}
            />
            <Route path="/games/texasholdem" element={<TexasHoldem />} />
            <Route path="/games/blackjack/lobby" element={<BlackJackLobby />} />
            <Route path="/games/blackjack" element={<BlackJack />} />
            <Route
              path="/games/murlanroyale/lobby"
              element={<MurlanRoyaleLobby />}
            />
            <Route path="/games/murlanroyale" element={<MurlanRoyale />} />
            <Route
              path="/games/pollroyale/lobby"
              element={<PoolRoyaleLobby />}
            />
            <Route path="/games/pollroyale" element={<PoolRoyale />} />
            <Route path="/games/snooker" element={<Snooker />} />
            <Route path="/games/roulette" element={<Roulette />} />
            <Route path="/spin" element={<SpinPage />} />
            <Route path="/admin/influencer" element={<InfluencerAdmin />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/store" element={<Store />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/account" element={<MyAccount />} />
          </Routes>
        </Layout>
      </TonConnectUIProvider>
    </BrowserRouter>
  );
}
