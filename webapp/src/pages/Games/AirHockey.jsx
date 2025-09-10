import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import AirHockey3D from '../../components/AirHockey3D.jsx';

const AI_FLAGS = [
  { name: 'France', avatar: '/assets/icons/FranceLeader.webp' },
  { name: 'Germany', avatar: '/assets/icons/GermanyLeader.webp' },
  { name: 'Italy', avatar: '/assets/icons/ItalyLeader.webp' },
  { name: 'Canada', avatar: '/assets/icons/CanadaLeader.webp' }
];

export default function AirHockey() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const player = {
    name: params.get('name') || 'You',
    avatar: params.get('avatar') || '/assets/icons/profile.svg'
  };
  const ai = AI_FLAGS[Math.floor(Math.random() * AI_FLAGS.length)];
  return <AirHockey3D player={player} ai={ai} />;
}
