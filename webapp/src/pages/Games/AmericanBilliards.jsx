import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PoolRoyaleGame, resolveTableSize } from './PoolRoyale.jsx';

export default function AmericanBilliards() {
  const location = useLocation();
  const tableSizeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tableSize');
    return resolveTableSize(requested).id;
  }, [location.search]);

  return <PoolRoyaleGame variantKey="american" tableSizeKey={tableSizeKey} />;
}
