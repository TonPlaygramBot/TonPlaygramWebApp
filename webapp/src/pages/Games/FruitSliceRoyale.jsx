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
      info="Swipe to slice flying fruit while avoiding bombs. Chain slices for extra points."
    />
  );
}
