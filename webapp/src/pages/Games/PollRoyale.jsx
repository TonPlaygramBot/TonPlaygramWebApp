import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/poll-royale.html${search}`}
        title="8 Ball Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
