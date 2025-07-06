import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const Home = React.lazy(() => import('./pages/Home.jsx'));
const Friends = React.lazy(() => import('./pages/Friends.jsx'));
const DominoPlay = React.lazy(() => import('./pages/Games/DominoPlay.jsx'));
const Wallet = React.lazy(() => import('./pages/Wallet.jsx'));
const Tasks = React.lazy(() => import('./pages/Tasks.jsx'));
const Referral = React.lazy(() => import('./pages/Referral.jsx'));
const MyAccount = React.lazy(() => import('./pages/MyAccount.jsx'));
const Store = React.lazy(() => import('./pages/Store.jsx'));
const Messages = React.lazy(() => import('./pages/Messages.jsx'));
const Trending = React.lazy(() => import('./pages/Trending.jsx'));
const Notifications = React.lazy(() => import('./pages/Notifications.jsx'));

const HorseRacing = React.lazy(() => import('./pages/Games/HorseRacing.jsx'));
const SnakeAndLadder = React.lazy(() => import('./pages/Games/SnakeAndLadder.jsx'));
const SnakeMultiplayer = React.lazy(() => import('./pages/Games/SnakeMultiplayer.jsx'));
const SnakeResults = React.lazy(() => import('./pages/Games/SnakeResults.jsx'));
const Ludo = React.lazy(() => import('./pages/Games/Ludo.jsx'));
const Lobby = React.lazy(() => import('./pages/Games/Lobby.jsx'));
const Games = React.lazy(() => import('./pages/Games.jsx'));
const SpinPage = React.lazy(() => import('./pages/spin.tsx'));

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
