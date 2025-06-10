import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-gray-600">{description}</p>
      {link && (
        <Link to={link} className="text-blue-600 hover:underline">
          Play
        </Link>
      )}
    </div>
  );
}
