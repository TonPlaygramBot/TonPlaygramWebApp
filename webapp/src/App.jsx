import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const Home = lazy(() => import('./pages/Home.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const DominoPlay = lazy(() => import('./pages/Games/DominoPlay.jsx'));
const Wallet = lazy(() => import('./pages/Wallet.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Referral = lazy(() => import('./pages/Referral.jsx'));
const MyAccount = lazy(() => import('./pages/MyAccount.jsx'));
const Store = lazy(() => import('./pages/Store.jsx'));
const Messages = lazy(() => import('./pages/Messages.jsx'));
const Trending = lazy(() => import('./pages/Trending.jsx'));
const Notifications = lazy(() => import('./pages/Notifications.jsx'));

const HorseRacing = lazy(() => import('./pages/Games/HorseRacing.jsx'));
const SnakeAndLadder = lazy(() => import('./pages/Games/SnakeAndLadder.jsx'));
const SnakeMultiplayer = lazy(() => import('./pages/Games/SnakeMultiplayer.jsx'));
const SnakeResults = lazy(() => import('./pages/Games/SnakeResults.jsx'));
const Ludo = lazy(() => import('./pages/Games/Ludo.jsx'));
const Lobby = lazy(() => import('./pages/Games/Lobby.jsx'));
const Games = lazy(() => import('./pages/Games.jsx'));
const SpinPage = lazy(() => import('./pages/spin.tsx'));

import Layout from './components/Layout.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';

export default function App() {
  useTelegramAuth();

  const manifestUrl = `${window.location.origin}/tonconnect-manifest.json`;

  return (
    <BrowserRouter>
      <TonConnectUIProvider manifestUrl={manifestUrl}>
        <Layout>
          <Suspense fallback={null}>
          <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:game/lobby" element={<Lobby />} />
            <Route path="/games/horse" element={<HorseRacing />} />
          <Route path="/games/domino" element={<DominoPlay />} />
          <Route path="/games/ludo" element={<Ludo />} />
          <Route path="/games/snake" element={<SnakeAndLadder />} />
          <Route path="/games/snake/mp" element={<SnakeMultiplayer />} />
          <Route path="/games/snake/results" element={<SnakeResults />} />
          <Route path="/spin" element={<SpinPage />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/store" element={<Store />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/trending" element={<Trending />} />
          <Route path="/account" element={<MyAccount />} />
        </Routes>
          </Suspense>
        </Layout>
      </TonConnectUIProvider>
    </BrowserRouter>
  );
}
