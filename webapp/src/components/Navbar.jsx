import { AiOutlineHome, AiOutlinePlayCircle, AiOutlineUser, AiOutlineShop } from 'react-icons/ai';
import { GiReceiveMoney } from 'react-icons/gi';
import { HiOutlineUserGroup } from 'react-icons/hi';
import NavItem from './NavItem.jsx';
export default function Navbar() {
  return <nav aria-label="Main navigation" className="app-bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface text-text shadow-lg">
    <div className="mx-auto grid w-full max-w-4xl grid-cols-6 items-center gap-1 px-2 pt-2 pb-[max(0.25rem,env(safe-area-inset-bottom))] sm:px-4">
      <NavItem to="/" icon={AiOutlineHome} label="Home"/><NavItem to="/earn" icon={GiReceiveMoney} label="Earn"/><NavItem to="/games" icon={AiOutlinePlayCircle} label="Games"/><NavItem to="/social" icon={HiOutlineUserGroup} label="Social"/><NavItem to="/store" icon={AiOutlineShop} label="Store"/><NavItem to="/profile" icon={AiOutlineUser} label="Profile"/>
    </div>
  </nav>;
}
