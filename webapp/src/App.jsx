import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Home from './pages/Home.jsx';
import Friends from './pages/Friends.jsx';
import Wallet from './pages/Wallet.jsx';
import Tasks from './pages/Tasks.jsx';
import Referral from './pages/Referral.jsx';
import MyAccount from './pages/MyAccount.jsx';
import Store from './pages/Store.jsx';
import Messages from './pages/Messages.jsx';
import Trending from './pages/Trending.jsx';
import Notifications from './pages/Notifications.jsx';

import HorseRacing from './pages/Games/HorseRacing.jsx';
const SnakeAndLadder = lazy(() => import('./pages/Games/SnakeAndLadder.jsx'));
import Lobby from './pages/Games/Lobby.jsx';
import Games from './pages/Games.jsx';
import SpinPage from './pages/spin.tsx';

import Layout from './components/Layout.jsx';
import useTelegramAuth from './hooks/useTelegramAuth.js';

export default function App() {
  useTelegramAuth();

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/games" element={<Games />} />
          <Route path="/games/:game/lobby" element={<Lobby />} />
            <Route path="/games/horse" element={<HorseRacing />} />
          <Route
            path="/games/snake"
            element={
              <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                <SnakeAndLadder />
              </Suspense>
            }
          />
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
      </Layout>
    </BrowserRouter>
  );
}
