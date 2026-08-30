import { NavLink } from 'react-router-dom';

export default function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      className={({ isActive }) =>
        `flex min-w-0 flex-col items-center px-0.5 text-[11px] -translate-y-2 sm:text-sm ${
          isActive
            ? 'text-accent drop-shadow-[0_0_6px_rgba(250,204,21,0.8)]'
            : 'text-text hover:text-accent'
        }`
      }
    >
      <Icon className="mb-1 h-7 w-7 shrink-0 text-accent sm:h-8 sm:w-8" />
      <span className="max-w-full truncate">{label}</span>
    </NavLink>
  );
}
