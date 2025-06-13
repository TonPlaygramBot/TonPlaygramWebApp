import { NavLink } from 'react-router-dom';

export default function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center text-sm ${isActive ? 'text-accent' : 'text-text hover:text-accent'}`
      }
    >
      <Icon className="w-8 h-8 mb-1" />
      <span>{label}</span>
    </NavLink>
  );
}
