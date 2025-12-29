import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Magazine3D from '../components/Magazine3D.jsx';
import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import { DEV_INFO } from '../utils/constants.js';

export default function MagazineWarehouse() {
  const navigate = useNavigate();
  const [isDev, setIsDev] = useState(() => {
    try {
      return localStorage.getItem('accountId') === DEV_INFO.account;
    } catch {
      return false;
    }
  });

  useTelegramBackButton(() => navigate('/account'));

  useEffect(() => {
    try {
      const storedAccountId = localStorage.getItem('accountId');
      setIsDev(storedAccountId === DEV_INFO.account);
    } catch {
      setIsDev(false);
    }
  }, []);

  if (!isDev) {
    return (
      <div className="p-4 space-y-3 wide-card mx-auto text-center">
        <h1 className="text-xl font-semibold">Magazine Warehouse</h1>
        <p className="text-sm text-subtext">
          This area is restricted to the developer account.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            to="/account"
            className="inline-flex items-center justify-center px-3 py-2 bg-primary hover:bg-primary-hover rounded text-background text-sm font-semibold"
          >
            Back to Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 wide-card mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Magazine Warehouse</h1>
        <span className="text-xs text-subtext">Dev only</span>
      </div>
      <p className="text-sm text-subtext">
        Full-screen view of the curated Poly Haven 3D objects arranged in order.
      </p>
      <Magazine3D />
    </div>
  );
}
