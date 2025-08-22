import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('variant', 'american');
  const src = `/poll-royale.html?${params.toString()}`;
  const title = 'American Billiards';
  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title={title} className="w-full h-full border-0" />
    </div>
  );
}
