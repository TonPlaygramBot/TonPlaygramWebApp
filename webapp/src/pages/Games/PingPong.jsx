import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PingPong() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/ping-pong.html${search}`}
        title="Ping Pong"
        className="w-full h-full border-0"
      />
    </div>
  );
}
