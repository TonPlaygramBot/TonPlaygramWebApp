import { Link } from 'react-router-dom';

export default function Navbar() {

  return (

    <nav className="bg-[#11172a] text-white shadow border-b border-[#1e293b]">

      <div className="container mx-auto px-4 py-3 flex items-center">

        <div className="flex-1 space-x-4 text-sm">

          <Link className="hover:text-[#fde047]" to="/">Home</Link>

          <Link className="hover:text-[#fde047]" to="/mining">Mining</Link>

          <Link className="hover:text-[#fde047]" to="/games/chess">Chess</Link>

          <Link className="hover:text-[#fde047]" to="/tasks">Tasks</Link>

          <Link className="hover:text-[#fde047]" to="/referral">Referral</Link>

          <Link className="hover:text-[#fde047]" to="/wallet">Wallet</Link>

          <Link className="hover:text-[#fde047]" to="/account">My Account</Link>

        </div>

      </div>

    </nav>

  );

}