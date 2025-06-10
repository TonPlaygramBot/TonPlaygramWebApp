import { Link } from 'react-router-dom';
import ConnectWallet from './ConnectWallet.jsx';

export default function Navbar() {
  return (
    <nav className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <div className="flex-1 space-x-4">
          <Link className="hover:underline" to="/">Home</Link>
          <Link className="hover:underline" to="/mining">Mining</Link>
          <Link className="hover:underline" to="/games/dice">Games</Link>
          <Link className="hover:underline" to="/watch">Watch</Link>
          <Link className="hover:underline" to="/tasks">Tasks</Link>
          <Link className="hover:underline" to="/referral">Referral</Link>
          <Link className="hover:underline" to="/wallet">Wallet</Link>
        </div>
        <ConnectWallet />
      </div>
    </nav>
  );
}
