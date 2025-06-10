import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link, icon }) {
  return (
    <div className="bg-gray-800/60 p-4 rounded-xl shadow-lg space-y-2 text-white">
      {icon && <div className="text-3xl">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {description && <p className="text-blue-200 text-sm">{description}</p>}
      {link && (
        <Link to={link} className="inline-block mt-1 px-3 py-1 bg-blue-600 rounded hover:bg-blue-500">
          Open
        </Link>
      )}
    </div>
  );
}
