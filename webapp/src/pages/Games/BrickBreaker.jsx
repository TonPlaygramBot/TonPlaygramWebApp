import { useLocation } from 'react-router-dom';

export default function BrickBreaker() {
  const { search } = useLocation();
  return (
    <iframe
      src={`/brick-breaker.html${search}`}
      title="Brick Breaker Royale"
      className="w-screen h-screen border-0"
    />
  );
}
