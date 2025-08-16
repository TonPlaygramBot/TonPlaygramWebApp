import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
export default function FruitSliceRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-screen">
      <iframe
        src={`/fruit-slice-royale.html${search}`}
        title="Fruit Slice Royale"
        className="w-full h-full border-0"
      />
    </div>
  );
}
