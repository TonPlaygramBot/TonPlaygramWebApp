import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white shadow border-b border-yellow-500">
      <div className="container mx-auto px-4 py-3 flex items-center">
        <div className="flex-1 space-x-4 text-sm">
          <Link className="hover:text-yellow-400" to="/">Home</Link>
          <Link className="hover:text-yellow-400" to="/mining">Mining</Link>
          <Link className="hover:text-yellow-400" to="/games">Games</Link>
          <Link className="hover:text-yellow-400" to="/tasks">Tasks</Link>
          <Link className="hover:text-yellow-400" to="/referral">Referral</Link>
          <Link className="hover:text-yellow-400" to="/account">Profile</Link>
        </div>
      </div>
    </nav>
  );
}
