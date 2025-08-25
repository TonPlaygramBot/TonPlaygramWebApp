import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function PenaltyKick() {
  useTelegramBackButton();
  const { search } = useLocation();
  return (
    <div className="relative w-full h-[100dvh]">
      <iframe
        src={`/penalty-kick.html${search}`}
        title="Penalty Kick"
        className="w-full h-full border-0"
      />
    </div>
  );
}
