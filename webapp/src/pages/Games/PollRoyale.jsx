import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function PollRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const variant = params.get('variant') || 'uk';
  params.set('variant', variant);
  const src = `/poll-royale.html?${params.toString()}`;
  const title =
    variant === '9ball'
      ? '9-Ball'
      : variant === 'american'
        ? 'American Billiards'
        : '8 Pool UK';
  const info =
    variant === '9ball'
      ? 'Pot the balls in order and finish with the 9-ball to win.'
      : variant === 'american'
        ? 'Pocket all your assigned balls, then sink the 8-ball to win.'
        : 'Clearing your group of balls and then potting the black wins the frame.';
  return <GameFrame src={src} title={title} info={info} />;
}
