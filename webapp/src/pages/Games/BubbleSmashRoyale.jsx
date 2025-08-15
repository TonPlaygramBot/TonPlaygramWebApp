import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function BubbleSmashRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/bubble-smash-royale.html${search}`}
      title="Bubble Smash Royale"
      info="Match bubbles quickly and climb to the top of the scoreboard."
    />
  );
}
