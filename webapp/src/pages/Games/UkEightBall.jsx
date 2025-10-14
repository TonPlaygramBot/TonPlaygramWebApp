import { useLocation, useMemo } from 'react';
import { PoolRoyaleGame, resolveTableSize } from './PoolRoyale.jsx';

export default function UkEightBall() {
  const location = useLocation();
  const tableSizeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tableSize');
    return resolveTableSize(requested).id;
  }, [location.search]);

  return <PoolRoyaleGame variantKey="uk" tableSizeKey={tableSizeKey} />;
}
