import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import AirHockey3D from '../../components/AirHockey3D.jsx';
import { FLAG_EMOJIS } from '../../utils/flagEmojis.js';
import { avatarToName } from '../../utils/avatarUtils.js';

export default function AirHockey() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const target = Number(params.get('target')) || 3;
  const playType = params.get('type') || 'regular';
  const playerFlagParam = params.get('flag');
  const aiFlagParam = params.get('aiFlag');
  const aiFlag = aiFlagParam && FLAG_EMOJIS.includes(aiFlagParam) ? aiFlagParam : '';
  const player = {
    name: params.get('name') || 'You',
    avatar: params.get('avatar') ||
      (playerFlagParam && FLAG_EMOJIS.includes(playerFlagParam) ? playerFlagParam : '') ||
      '/assets/icons/profile.svg'
  };
  const randomAiFlag = FLAG_EMOJIS[Math.floor(Math.random() * FLAG_EMOJIS.length)];
  const chosenAiFlag = aiFlag || randomAiFlag;
  const ai = { name: avatarToName(chosenAiFlag) || 'AI', avatar: chosenAiFlag };
  return <AirHockey3D player={player} ai={ai} target={target} playType={playType} />;
}
