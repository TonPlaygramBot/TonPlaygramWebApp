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

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import BalanceSummary from '../components/BalanceSummary.jsx';
import AirdropPopup from '../components/AirdropPopup.jsx';

import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { getProfile, airdropStatus, claimWelcomeAirdrop, recalcWalletBalance } from '../utils/api.js';

export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const [airdropOpen, setAirdropOpen] = useState(false);

  useEffect(() => {
    ping()
      .then(() => setStatus('online'))
      .catch(() => setStatus('offline'));

    const id = getTelegramId();
    const saved = loadAvatar();
    if (saved) {
      setPhotoUrl(saved);
    } else {
      getProfile(id)
        .then((p) => {
          const src = p?.photo || getTelegramPhotoUrl();
          setPhotoUrl(src);
          if (p?.photo) saveAvatar(p.photo);
        })
        .catch(() => {
          setPhotoUrl(getTelegramPhotoUrl());
        });
    }

    const handleUpdate = () => {
      const id = getTelegramId();
      const saved = loadAvatar();
      if (saved) {
        setPhotoUrl(saved);
      } else {
        getProfile(id)
          .then((p) => {
            setPhotoUrl(p?.photo || getTelegramPhotoUrl());
            if (p?.photo) saveAvatar(p.photo);
          })
          .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
      }
    };
    window.addEventListener('profilePhotoUpdated', handleUpdate);
    airdropStatus(id)
      .then((res) => {
        if (!res.claimed) setAirdropOpen(true);
      })
      .catch(() => {});

    return () => window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);

  const handleClaimAirdrop = async () => {
    const id = getTelegramId();
    try {
      await claimWelcomeAirdrop(id);
      await recalcWalletBalance(id);
    } catch (err) {
      console.error('Airdrop claim failed', err);
    } finally {
      setAirdropOpen(false);
    }
  };


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


        <div className="w-full max-w-xs mt-2">
          <div className="relative flex items-center justify-between bg-surface border border-border rounded-xl p-2 overflow-hidden">
            <img
              src="/assets/SnakeLaddersbackground.png"
              className="background-behind-board object-cover"
              alt=""
            />
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
      <AirdropPopup open={airdropOpen} onClaim={handleClaimAirdrop} />
    );
  }
