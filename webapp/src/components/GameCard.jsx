import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link, icon }) {
  return (
    <div className="bg-surface p-4 rounded-xl shadow-lg space-y-2">
      {icon && <div className="text-3xl text-yellow-400">{icon}</div>}
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {description && <p className="text-gray-300 text-sm">{description}</p>}
      {link && (
        <Link to={link} className="inline-block mt-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-500">
          Open
        </Link>
      )}
    </div>
  );
}
