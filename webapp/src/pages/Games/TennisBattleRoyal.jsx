import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import TennisBattleRoyal3D from '../../components/TennisBattleRoyal3D.jsx';

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

  return <TennisBattleRoyal3D playerName={playerName} stakeLabel={stakeLabel} trainingMode={trainingMode} />;
}
