import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import TableTennis3D from '../../components/TableTennis3D.jsx';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';

export default function TableTennis() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const player = {
    name: params.get('name') || 'You',
    avatar: params.get('avatar') || '/assets/icons/profile.svg'
  };
  const flag = FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)];
  const ai = {
    name: avatarToName(flag) || 'AI',
    avatar: flag,
    difficulty: params.get('difficulty') || 'pro',
  };
  return <TableTennis3D player={player} ai={ai} />;
}

