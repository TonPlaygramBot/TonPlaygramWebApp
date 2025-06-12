import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-surface text-text shadow border-t border-accent">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between text-sm">
        <Link className="hover:text-accent" to="/">Home</Link>
        <Link className="hover:text-accent" to="/mining">Mining</Link>
        <Link className="hover:text-accent" to="/games">Games</Link>
        <Link className="hover:text-accent" to="/tasks">Tasks</Link>
        <Link className="hover:text-accent" to="/referral">Referral</Link>
        <Link className="hover:text-accent" to="/account">Profile</Link>
      </div>
    </nav>
  );
}
