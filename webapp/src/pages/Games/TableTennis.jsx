import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import TableTennis3D from '../../components/TableTennis3D.jsx';

export default function TableTennis() {
  useTelegramBackButton();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const avatar = params.get('avatar') || '/assets/icons/profile.svg';
  const name = params.get('name') || 'You';
  const aiAvatar = '/assets/icons/air_hockey.svg';
  const aiName = 'CPU';

  const [score, setScore] = useState({ player: 0, ai: 0 });
  const [turn, setTurn] = useState('player');

  const handlePoint = (winner) => {
    setScore((s) => ({ ...s, [winner]: s[winner] + 1 }));
    setTurn(winner === 'player' ? 'ai' : 'player');
  };

  return (
    <div className="relative w-full h-[100dvh]">
      <div className="absolute top-0 left-0 right-0 flex justify-center z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/60 text-white px-3 py-1 rounded-b">
          <div className={`flex items-center gap-1 ${turn === 'player' ? 'opacity-100' : 'opacity-50'}`}>
            <img src={avatar} alt="" className="w-6 h-6 rounded-full" />
            <span>{name}</span>
            <span className="font-bold">{score.player}</span>
          </div>
          <span>—</span>
          <div className={`flex items-center gap-1 ${turn === 'ai' ? 'opacity-100' : 'opacity-50'}`}>
            <span className="font-bold">{score.ai}</span>
            <img src={aiAvatar} alt="" className="w-6 h-6 rounded-full" />
            <span>{aiName}</span>
          </div>
        </div>
      </div>
      <TableTennis3D turn={turn} onPoint={handlePoint} />
    </div>
  );
}

