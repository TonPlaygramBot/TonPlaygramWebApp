import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function BubblePopRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/bubble-pop-royale.html${search}`}
      title="Bubble Pop Royale"
      info="Pop bubbles against the clock and rack up the highest score."
    />
  );
}
