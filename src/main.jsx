import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Mining from './pages/Mining.jsx';
import Games from './pages/Games.jsx';
import Watch from './pages/Watch.jsx';
import Tasks from './pages/Tasks.jsx';
import Wallet from './pages/Wallet.jsx';
import Referral from './pages/Referral.jsx';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <nav className="flex gap-4 p-4 bg-primary text-white">
        <Link to="/" className="hover:underline">Mining</Link>
        <Link to="/games" className="hover:underline">Games</Link>
        <Link to="/watch" className="hover:underline">Watch</Link>
        <Link to="/tasks" className="hover:underline">Tasks</Link>
        <Link to="/wallet" className="hover:underline">Wallet</Link>
        <Link to="/referral" className="hover:underline">Referral</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Mining />} />
        <Route path="/games" element={<Games />} />
        <Route path="/watch" element={<Watch />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/referral" element={<Referral />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
