import { AiOutlineHome, AiOutlineTrophy, AiOutlinePlayCircle, AiOutlineCheckSquare, AiOutlineUsergroupAdd, AiOutlineUser } from 'react-icons/ai';
import NavItem from './NavItem.jsx';

export default function Navbar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-surface text-text shadow border-t border-accent">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between text-sm">
        <NavItem to="/" icon={AiOutlineHome} label="Home" />
        <NavItem to="/mining" icon={AiOutlineTrophy} label="Mining" />
        <NavItem to="/games" icon={AiOutlinePlayCircle} label="Games" />
        <NavItem to="/tasks" icon={AiOutlineCheckSquare} label="Tasks" />
        <NavItem to="/referral" icon={AiOutlineUsergroupAdd} label="Referral" />
        <NavItem to="/account" icon={AiOutlineUser} label="Profile" />
      </div>
    </nav>
  );
}
