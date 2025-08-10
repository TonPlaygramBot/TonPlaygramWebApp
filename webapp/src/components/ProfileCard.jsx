import { FaUser } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function ProfileCard() {
  return (
    <div className="relative bg-surface border border-border p-4 rounded-xl shadow-lg space-y-2 text-center overflow-hidden wide-card">
      <img
        src="/assets/icons/snakes_and_ladders.webp"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <FaUser className="text-accent text-3xl mx-auto" />
      <h3 className="text-lg font-bold text-text">Profile</h3>
      <Link
        to="/account"
        className="inline-block mt-1 px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Open
      </Link>
    </div>
  );
}
