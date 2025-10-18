import { useLocation } from 'react-router-dom';

import DominoRoyalArena from './DominoRoyalArena.jsx';

export default function DominoRoyal() {
  const { search } = useLocation();
  return <DominoRoyalArena search={search} />;
}
