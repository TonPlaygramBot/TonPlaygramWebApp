import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Mining from './pages/Mining.jsx';
import Wallet from './pages/Wallet.jsx';
import WatchToEarn from './pages/WatchToEarn.jsx';
import Tasks from './pages/Tasks.jsx';
import Referral from './pages/Referral.jsx';
import DiceGame from './pages/Games/DiceGame.jsx';
import LudoGame from './pages/Games/LudoGame.jsx';
import HorseRacing from './pages/Games/HorseRacing.jsx';
import SnakeLadders from './pages/Games/SnakeLadders.jsx';
import Layout from './components/Layout.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/mining" element={<Mining />} />
          <Route path="/games/dice" element={<DiceGame />} />
          <Route path="/games/ludo" element={<LudoGame />} />
          <Route path="/games/horse" element={<HorseRacing />} />
          <Route path="/games/snake" element={<SnakeLadders />} />
          <Route path="/watch" element={<WatchToEarn />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/referral" element={<Referral />} />
          <Route path="/wallet" element={<Wallet />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
