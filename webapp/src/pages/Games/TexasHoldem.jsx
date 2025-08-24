import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function TexasHoldem() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/texas-holdem.html${search}`}
      title="Texas Hold'em"
      info="Use two hole cards and five community cards to make the best hand. Bet through pre-flop, flop, turn and river rounds."
    />
  );
}
