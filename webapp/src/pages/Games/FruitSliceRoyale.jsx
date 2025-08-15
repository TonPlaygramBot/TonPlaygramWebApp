import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import GameFrame from '../../components/GameFrame.jsx';

export default function FruitSliceRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <GameFrame
      src={`/fruit-slice-royale.html${search}`}
      title="Fruit Slice Royale"
      info="Slice the flying fruit and avoid the bombs to climb the rankings."
    />
  );
}
