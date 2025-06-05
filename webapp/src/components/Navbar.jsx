import { Link } from 'react-router-dom';
import ConnectWallet from './ConnectWallet.jsx';

export default function Navbar() {
  return (
    <nav className="p-4 bg-blue-500 text-white flex items-center">
      <div className="flex-1 space-x-4">
        <Link to="/">Home</Link>
        <Link to="/mining">Mining</Link>
        <Link to="/games/dice">Games</Link>
        <Link to="/watch">Watch</Link>
        <Link to="/tasks">Tasks</Link>
        <Link to="/referral">Referral</Link>
        <Link to="/wallet">Wallet</Link>
      </div>
      <ConnectWallet />
    </nav>
  );
}
