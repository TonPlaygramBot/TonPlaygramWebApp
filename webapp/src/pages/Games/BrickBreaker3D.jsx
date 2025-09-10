import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import BrickBreaker3D from '../../components/BrickBreaker3D.jsx';

export default function BrickBreaker3DPage() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const player = {
    name: params.get('name') || 'You',
    avatar: params.get('avatar') || '/assets/icons/profile.svg'
  };
  return <BrickBreaker3D player={player} />;
}

