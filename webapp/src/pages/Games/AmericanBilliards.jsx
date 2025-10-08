import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { PoolRoyaleGame, resolveTableSize } from './PoolRoyale.jsx';
import { useIsMobile } from '../../hooks/useIsMobile.js';

export default function AmericanBilliards() {
  const isMobileOrTablet = useIsMobile(1366);
  const location = useLocation();

  const tableSizeKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const requested = params.get('tableSize');
    return resolveTableSize(requested).id;
  }, [location.search]);

  if (!isMobileOrTablet) {
    return (
      <div className="flex items-center justify-center w-full h-full p-4 text-center">
        <p>This game is available on mobile phones and tablets only.</p>
      </div>
    );
  }

  return <PoolRoyaleGame variantKey="american" tableSizeKey={tableSizeKey} />;
}
