import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="p-4 bg-blue-500 text-white">
      <Link to="/" className="mr-4">Home</Link>
      <Link to="/mining" className="mr-4">Mining</Link>
      <Link to="/wallet">Wallet</Link>
    </nav>
  );
}
