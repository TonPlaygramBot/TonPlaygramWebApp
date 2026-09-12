import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import PoolRoyalCareerHub from './PoolRoyalCareerHub.tsx';
export default function PoolRoyaleCareer() {
  useTelegramBackButton('/games/poolroyale/lobby?type=career');
  return <PoolRoyalCareerHub />;
}
