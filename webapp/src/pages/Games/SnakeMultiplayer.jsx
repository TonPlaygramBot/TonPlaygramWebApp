import { Navigate, useLocation } from 'react-router-dom';

export default function SnakeMultiplayer() {
  const location = useLocation();
  return <Navigate to={`/games/snake${location.search}`} replace />;
}
