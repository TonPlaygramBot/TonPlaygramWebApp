import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function FreeKick() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/free-kick.html${search}`}
        title="Free Kick"
        className="w-full h-full border-0"
      />
    </div>
  );
}
