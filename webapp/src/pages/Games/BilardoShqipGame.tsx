import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PoolRoyale from './PoolRoyale.jsx';

const REQUIRED_PARAMS = {
  variant: 'americanbilliards',
  ballSet: 'american',
  tableSize: 'pro10'
};

export default function BilardoShqipGame() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;
    Object.entries(REQUIRED_PARAMS).forEach(([key, value]) => {
      if (params.get(key) !== value) {
        params.set(key, value);
        changed = true;
      }
    });

    if (changed) {
      navigate({
        pathname: location.pathname,
        search: `?${params.toString()}`
      }, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return <PoolRoyale />;
}
