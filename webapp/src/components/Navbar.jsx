import {
  AiOutlineHome,
  AiOutlinePlayCircle,
  AiOutlineCheckSquare,
  AiOutlineUser,
  AiOutlineShop
} from 'react-icons/ai';
import { GiMining } from 'react-icons/gi';
import NavItem from './NavItem.jsx';

export default function Navbar() {
  return (
    <nav className="app-bottom-nav fixed inset-x-0 bottom-2 z-50 bg-surface text-text shadow border-t border-accent">
      <div className="container mx-auto px-4 pt-3 pb-1 flex items-center justify-between text-base">
        <NavItem to="/" icon={AiOutlineHome} label="Home" />
        <NavItem to="/mining" icon={GiMining} label="Mining" />
        <NavItem to="/games" icon={AiOutlinePlayCircle} label="Games" />
        <NavItem to="/tasks" icon={AiOutlineCheckSquare} label="Tasks" />
        <NavItem to="/store" icon={AiOutlineShop} label="Store" />
        <NavItem to="/account" icon={AiOutlineUser} label="Profile" />
      </div>
    </nav>
  );
}
