import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-black text-yellow-400 shadow border-b border-yellow-600">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <div className="flex-1 space-x-4 text-sm">
          <Link className="hover:text-white" to="/">Home</Link>
          <Link className="hover:text-white" to="/mining">Mining</Link>
          <Link className="hover:text-white" to="/games/chess">Chess</Link>
          <Link className="hover:text-white" to="/tasks">Tasks</Link>
          <Link className="hover:text-white" to="/referral">Referral</Link>
          <Link className="hover:text-white" to="/wallet">Wallet</Link>
          <Link className="hover:text-white" to="/account">My Account</Link>
        </div>
      </div>
    </nav>
  );
}
