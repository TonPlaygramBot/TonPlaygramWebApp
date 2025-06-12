import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-surface text-text shadow border-b-2 border-accent">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <div className="flex-1 space-x-4 text-sm">
          <Link className="hover:text-accent" to="/">Home</Link>
          <Link className="hover:text-accent" to="/mining">Mining</Link>
          <Link className="hover:text-accent" to="/games/chess">Chess</Link>
          <Link className="hover:text-accent" to="/tasks">Tasks</Link>
          <Link className="hover:text-accent" to="/referral">Referral</Link>
          <Link className="hover:text-accent" to="/account">My Account</Link>
        </div>
      </div>
    </nav>
  );
}
