import { NavLink } from 'react-router-dom';
export default function NavItem({ to, icon: Icon, label }) {
  return <NavLink to={to} end={to === '/'} aria-label={label}
    className={({isActive}) => `flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:text-xs ${isActive ? 'bg-accent/10 text-accent font-semibold' : 'text-subtext hover:bg-surface hover:text-text'}`}>
    <Icon aria-hidden="true" className="h-6 w-6 shrink-0"/><span className="max-w-full truncate">{label}</span>
  </NavLink>;
}
