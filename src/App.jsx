import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Mining from './pages/Mining.jsx';
import Games from './pages/Games.jsx';
import Watch from './pages/Watch.jsx';
import Tasks from './pages/Tasks.jsx';
import Wallet from './pages/Wallet.jsx';
import Referral from './pages/Referral.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <header className="flex items-center justify-between p-4 bg-gray-800 text-white">
        <h1 className="text-lg font-bold">TonPlaygram</h1>
        <a
          href="https://t.me/TonPlaygramBot"
          className="bg-primary px-4 py-2 rounded"
        >
          Launch Bot
        </a>
      </header>
      <nav className="p-4 bg-gray-100 flex gap-2 text-sm">
        <Link to="/mining">Mining</Link>
        <Link to="/games">Games</Link>
        <Link to="/watch">Watch</Link>
        <Link to="/tasks">Tasks</Link>
        <Link to="/wallet">Wallet</Link>
        <Link to="/referral">Referral</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Mining />} />
        <Route path="/mining" element={<Mining />} />
        <Route path="/games" element={<Games />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/referral" element={<Referral />} />
      </Routes>
      <footer className="p-4 text-center text-xs text-gray-500">
        © 2025 TonPlaygram. All rights reserved.
      </footer>
    </BrowserRouter>
  );
}
