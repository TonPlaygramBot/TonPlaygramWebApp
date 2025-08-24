import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function BlackJack() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/blackjack.html${search}`}
      title="Black Jack Multiplayer"
      info="Draw cards to reach 21 without busting. Beat the dealer's hand to win." 
    />
  );
}
