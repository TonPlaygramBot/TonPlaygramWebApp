import { FaUser } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function ProfileCard() {
  return (
    <div className="bg-surface p-4 rounded-xl shadow-lg space-y-2 text-center">
      <h3 className="text-lg font-bold text-text flex items-center justify-center space-x-1">
        <FaUser className="text-accent" />
        <span>Profile</span>
      </h3>
      <Link
        to="/account"
        className="inline-block mt-1 px-3 py-1 bg-primary text-text rounded hover:bg-primary-hover"
      >
        Open
      </Link>
    </div>
  );
}
