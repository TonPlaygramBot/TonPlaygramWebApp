import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Mining from './pages/Mining.jsx';
import Wallet from './pages/Wallet.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="p-4 bg-blue-500 text-white">
        <Link to="/" className="mr-4">Home</Link>
        <Link to="/mining" className="mr-4">Mining</Link>
        <Link to="/wallet">Wallet</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mining" element={<Mining />} />
        <Route path="/wallet" element={<Wallet />} />
      </Routes>
    </BrowserRouter>
  );
}
