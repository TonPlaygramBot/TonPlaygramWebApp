import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link, icon }) {
  return (
    <div className="bg-surface p-4 rounded-xl shadow-lg space-y-2">
      {icon && <div className="text-3xl text-accent">{icon}</div>}
      <h3 className="text-lg font-bold text-text">{title}</h3>
      {description && <p className="text-subtext text-sm">{description}</p>}
      {link && (
        <Link to={link} className="inline-block mt-1 px-3 py-1 bg-primary text-text rounded hover:bg-primary-hover">
          Open
        </Link>
      )}
    </div>
  );
}
