import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const title =
    params.get('variant') === 'american' ? 'American Billiards' : '8 Pool UK';
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/poll-royale.html${search}`}
        title={title}
        className="w-full h-full border-0"
      />
    </div>
  );
}
