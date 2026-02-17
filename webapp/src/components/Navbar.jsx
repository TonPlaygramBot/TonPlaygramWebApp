import {
  AiOutlineHome,
  AiOutlinePlayCircle,
  AiOutlineCheckSquare,
  AiOutlineUser,
  AiOutlineShop,
  AiOutlineAppstore
} from 'react-icons/ai';
import { GiMining } from 'react-icons/gi';
import NavItem from './NavItem.jsx';

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-surface text-text shadow border-t border-accent">
      <div className="container mx-auto px-3 py-3 grid grid-cols-7 gap-1 text-[11px]">
        <NavItem to="/" icon={AiOutlineHome} label="Home" />
        <NavItem to="/mining" icon={GiMining} label="Mining" />
        <NavItem to="/games" icon={AiOutlinePlayCircle} label="Games" />
        <NavItem to="/tasks" icon={AiOutlineCheckSquare} label="Tasks" />
        <NavItem to="/store" icon={AiOutlineShop} label="Store" />
        <NavItem to="/hub" icon={AiOutlineAppstore} label="TPC Hub" />
        <NavItem to="/account" icon={AiOutlineUser} label="Profile" />
      </div>
    </nav>
  );
}
