import { Link } from 'react-router-dom';

export default function GameCard({ title, description, link }) {
  return (
    <div className="border p-4 rounded shadow">
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-2">{description}</p>
      {link && (
        <Link to={link} className="text-blue-500 underline">
          Play
        </Link>
      )}
    </div>
  );
}
