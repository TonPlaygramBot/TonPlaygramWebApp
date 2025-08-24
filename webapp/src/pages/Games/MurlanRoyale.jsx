import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function MurlanRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/murlan-royale.html${search}`}
      title="Murlan Royale"
      info="Play higher card combinations to beat opponents and shed all your cards first to win." 
    />
  );
}
