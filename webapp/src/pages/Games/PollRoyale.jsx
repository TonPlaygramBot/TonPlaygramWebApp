import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const variant = params.get('variant') || 'uk';
  params.set('variant', variant);
  const type = params.get('type') || 'regular';
  params.set('type', type);
  const src = `/poll-royale.html?${params.toString()}`;
  const title =
    variant === '9ball'
      ? '9-Ball'
      : variant === 'american'
        ? 'American Billiards'
        : '8 Pool UK';
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe src={src} title={title} className="w-full h-full border-0" />
    </div>
  );
}
