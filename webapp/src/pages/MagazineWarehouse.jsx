import { Link, useNavigate } from 'react-router-dom';
import Magazine3D from '../components/Magazine3D.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';

export default function MagazineWarehouse() {
  const navigate = useNavigate();

  useTelegramBackButton(() => navigate('/account'));

  return (
    <div className="p-4 space-y-3 wide-card mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Magazine 3D</h1>
        <Link
          to="/account"
          className="text-xs text-primary hover:text-primary-hover font-semibold"
        >
          Back to Profile
        </Link>
      </div>
      <p className="text-sm text-subtext">
        Dedicated showroom for the curated Poly Haven 3D magazine, organized by category with high-fidelity textures.
      </p>
      <Magazine3D />
    </div>
  );
}
