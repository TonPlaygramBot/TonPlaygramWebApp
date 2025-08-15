import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function FruitSliceRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <iframe
      src={`/fruit-slice-royale.html${search}`}
      title="Fruit Slice Royale"
      className="w-full h-[100dvh] border-0"
    />
  );
}
