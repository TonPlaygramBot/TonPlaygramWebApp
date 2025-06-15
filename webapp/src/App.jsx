import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const Home = lazy(() => import('./pages/Home.jsx'));
const Friends = lazy(() => import('./pages/Friends.jsx'));
const Wallet = lazy(() => import('./pages/Wallet.jsx'));
const Tasks = lazy(() => import('./pages/Tasks.jsx'));
const Referral = lazy(() => import('./pages/Referral.jsx'));
const MyAccount = lazy(() => import('./pages/MyAccount.jsx'));
const Store = lazy(() => import('./pages/Store.jsx'));

const DiceGame = lazy(() => import('./pages/Games/DiceGame.jsx'));
const LudoGame = lazy(() => import('./pages/Games/LudoGame.jsx'));
const HorseRacing = lazy(() => import('./pages/Games/HorseRacing.jsx'));
const SnakeLadders = lazy(() => import('./pages/Games/SnakeLadders.jsx'));
const ChessGame = lazy(() => import('./pages/Games/Chess.jsx'));
const ConnectFour = lazy(() => import('./pages/Games/ConnectFour.jsx'));
const Games = lazy(() => import('./pages/Games.jsx'));
const SpinPage = lazy(() => import('./pages/spin.tsx'));

import Layout from './components/Layout.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';

export default function App() {
  useTelegramAuth();

  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/dice" element={<DiceGame />} />
          <Route path="/games/ludo" element={<LudoGame />} />
          <Route path="/games/horse" element={<HorseRacing />} />
          <Route path="/games/snake" element={<SnakeLadders />} />
          <Route path="/games/connectfour" element={<ConnectFour />} />
          <Route path="/games/chess" element={<ChessGame />} />
          <Route path="/spin" element={<SpinPage />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/store" element={<Store />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/account" element={<MyAccount />} />
        </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}
