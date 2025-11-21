import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import ArcadeRacketGame from '../../components/ArcadeRacketGame.jsx';

export default function TennisBattleRoyal() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const playerName = params.get('name') || undefined;
  const mode = params.get('mode');
  const amount = params.get('amount');
  const token = params.get('token');
  const trainingMode = mode === 'training';
  const stakeLabel = !trainingMode && amount && token ? `${amount} ${token}` : undefined;

  const title = playerName ? `${playerName} vs AI` : '3D Tennis Battle Royal';

  return <ArcadeRacketGame mode="tennis" title={title} stakeLabel={stakeLabel} trainingMode={trainingMode} />;
}
