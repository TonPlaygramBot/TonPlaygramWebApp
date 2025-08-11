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

import HorseRacing from './pages/Games/HorseRacing.jsx';
import SnakeAndLadder from './pages/Games/SnakeAndLadder.jsx';
import SnakeMultiplayer from './pages/Games/SnakeMultiplayer.jsx';
import SnakeResults from './pages/Games/SnakeResults.jsx';
import CrazyDiceDuel from './pages/Games/CrazyDiceDuel.jsx';
import CrazyDiceLobby from './pages/Games/CrazyDiceLobby.jsx';
import Lobby from './pages/Games/Lobby.jsx';
import Games from './pages/Games.jsx';
import SpinPage from './pages/spin.tsx';
import FallingBall from './pages/Games/FallingBall.jsx';
import FallingBallLobby from './pages/Games/FallingBallLobby.jsx';
import AirHockey from './pages/Games/AirHockey.jsx';
import AirHockeyLobby from './pages/Games/AirHockeyLobby.jsx';
import BrickBreaker from './pages/Games/BrickBreaker.jsx';
import BubblePopRoyale from './pages/Games/BubblePopRoyale.jsx';
import BubblePopRoyaleLobby from './pages/Games/BubblePopRoyaleLobby.jsx';
import TetrisRoyale from './pages/Games/TetrisRoyale.jsx';
import TetrisRoyaleLobby from './pages/Games/TetrisRoyaleLobby.jsx';

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
            <Route path="/games" element={<Games />} />
            <Route path="/games/crazydice" element={<CrazyDiceDuel />} />
            <Route path="/games/crazydice/lobby" element={<CrazyDiceLobby />} />
            <Route path="/games/:game/lobby" element={<Lobby />} />
              <Route path="/games/horse" element={<HorseRacing />} />
            <Route path="/games/snake" element={<SnakeAndLadder />} />
            <Route path="/games/snake/mp" element={<SnakeMultiplayer />} />
            <Route path="/games/snake/results" element={<SnakeResults />} />
            <Route path="/games/fallingball/lobby" element={<FallingBallLobby />} />
            <Route path="/games/fallingball" element={<FallingBall />} />
            <Route path="/games/airhockey/lobby" element={<AirHockeyLobby />} />
            <Route path="/games/airhockey" element={<AirHockey />} />
            <Route path="/games/brickbreaker/lobby" element={<BrickBreakerLobby />} />
            <Route path="/games/bubblepoproyale/lobby" element={<BubblePopRoyaleLobby />} />
            <Route path="/games/bubblepoproyale" element={<BubblePopRoyale />} />
            <Route path="/games/tetrisroyale/lobby" element={<TetrisRoyaleLobby />} />
            <Route path="/games/tetrisroyale" element={<TetrisRoyale />} />
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
