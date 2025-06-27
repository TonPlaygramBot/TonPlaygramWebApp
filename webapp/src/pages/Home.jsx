import { useEffect, useState } from 'react';

import GameCard from '../components/GameCard.jsx';
import ProfileCard from '../components/ProfileCard.jsx';

import MiningCard from '../components/MiningCard.tsx';

import SpinGame from '../components/SpinGame.jsx';
import DailyCheckIn from '../components/DailyCheckIn.jsx';

import TasksCard from '../components/TasksCard.jsx';

import { FaUser, FaArrowCircleUp, FaArrowCircleDown } from 'react-icons/fa';

import { Link } from 'react-router-dom';

import { ping } from '../utils/api.js';

import ConnectWallet from "../components/ConnectWallet.jsx";
import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import BalanceSummary from '../components/BalanceSummary.jsx';

import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { getProfile } from '../utils/api.js';

export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');

  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));

    const id = getTelegramId();
    getProfile(id)
      .then((p) => {
        const src = p?.photo || getTelegramPhotoUrl();
        setPhotoUrl(src);
        if (p?.photo) saveAvatar(p.photo);
      })
      .catch(() => {
        setPhotoUrl(getTelegramPhotoUrl());
      });

    const handleUpdate = () => {
      const id = getTelegramId();
      getProfile(id)
        .then((p) => {
          setPhotoUrl(p?.photo || getTelegramPhotoUrl());
          if (p?.photo) saveAvatar(p.photo);
        })
        .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
    };
    window.addEventListener('profilePhotoUpdated', handleUpdate);
    return () => window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);


  return (

    <div className="space-y-4">

      <div className="flex flex-col items-center">

        {photoUrl && (
          <div>
            <img
              src={getAvatarUrl(photoUrl)}
              alt="profile"
              className="w-36 h-36 hexagon border-4 border-brand-gold -mt-[20%] mb-3 object-cover"
            />
          </div>
        )}

        <div className="mb-2">

          <ConnectWallet />

        </div>

        <div className="flex items-center justify-between w-full max-w-xs mt-2">

          <Link to="/wallet?mode=send" className="flex items-center space-x-1">

            <FaArrowCircleUp className="text-accent w-8 h-8" />

            <span className="text-xs text-accent">Send</span>

          </Link>

          <BalanceSummary />

          <Link to="/wallet?mode=receive" className="flex items-center space-x-1">

            <FaArrowCircleDown className="text-accent w-8 h-8" />

            <span className="text-xs text-accent">Receive</span>

          </Link>

        </div>

      </div>

      <DailyCheckIn />
      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <TasksCard />
        <ProfileCard />
      </div>

      <p className="text-center text-xs text-subtext">Status: {status}</p>

    </div>

  );

}