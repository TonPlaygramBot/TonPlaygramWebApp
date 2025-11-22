import { useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import FreeKick3DGame from '../../components/FreeKick3DGame.jsx';

function buildConfig(search) {
  const params = new URLSearchParams(search);
  const duration = params.get('duration');
  const playerName =
    params.get('name') || params.get('username') || params.get('player') || '';
  return {
    duration: duration ? Number(duration) : undefined,
    playerName: playerName || undefined
  };
}

export default function FreeKick() {
  useTelegramBackButton();
  const { search } = useLocation();
  const config = useMemo(() => buildConfig(search), [search]);

  return (
    <div className="relative h-[100dvh] w-full bg-[#07130f]">
      <FreeKick3DGame config={config} />
    </div>
  );
}
