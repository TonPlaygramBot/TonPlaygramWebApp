import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const variant = params.get('variant') || 'american';
  params.set('variant', variant);
  const src = `/poll-royale.html?${params.toString()}`;
  const title = variant === '9ball' ? '9-Ball' : 'American Billiards';
  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title={title} className="w-full h-full border-0" />
    </div>
  );
}
