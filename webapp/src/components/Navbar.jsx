import {
  AiOutlineHome,
  AiOutlinePlayCircle,
  AiOutlineCheckSquare,
  AiOutlineUser,
  AiOutlineShop,
  AiOutlineUsergroupAdd
} from 'react-icons/ai';
import NavItem from './NavItem.jsx';

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-surface text-text shadow border-t border-accent">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between text-base">
        <NavItem to="/" icon={AiOutlineHome} label="Home" />
        <NavItem to="/friends" icon={AiOutlineUsergroupAdd} label="Friends" />
        <NavItem to="/games" icon={AiOutlinePlayCircle} label="Games" />
        <NavItem to="/tasks" icon={AiOutlineCheckSquare} label="Tasks" />
        <NavItem to="/store" icon={AiOutlineShop} label="Store" />
        <NavItem to="/account" icon={AiOutlineUser} label="Profile" />
      </div>
    </nav>
  );
}
