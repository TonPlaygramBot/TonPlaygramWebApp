import { useEffect, useState } from 'react';

import GameCard from '../components/GameCard.jsx';
import ProfileCard from '../components/ProfileCard.jsx';

import MiningCard from '../components/MiningCard.tsx';

import SpinGame from '../components/SpinGame.jsx';
import DailyCheckIn from '../components/DailyCheckIn.jsx';

import TasksCard from '../components/TasksCard.jsx';

import {
  FaUser,
  FaArrowCircleUp,
  FaArrowCircleDown,
  FaWallet,
  FaCopy,
  FaSignOutAlt
} from 'react-icons/fa';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

import { Link } from 'react-router-dom';

import { ping } from '../utils/api.js';

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import TonConnectButton from '../components/TonConnectButton.jsx';
import useTokenBalances from '../hooks/useTokenBalances.js';

import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { getProfile } from '../utils/api.js';

export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const { tpcBalance, tonBalance, usdtBalance } = useTokenBalances();
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : '';

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
    return () => window.removeEventListener('profilePhotoUpdated', handleUpdate);
  }, []);


  return (

    <div className="space-y-4">

      <div className="flex flex-col items-center">

        {photoUrl && (
          <div className="relative">
            <img
              src={getAvatarUrl(photoUrl)}
              alt="profile"
              className="w-36 h-36 hexagon border-4 border-brand-gold -mt-[20%] mb-3 object-cover"
            />
            {walletAddress && (
              <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-surface/80 text-xs px-2 py-1 rounded flex items-center space-x-1">
                <span>{shortAddress}</span>
                <button onClick={() => navigator.clipboard.writeText(walletAddress)}>
                  <FaCopy />
                </button>
                <button onClick={() => tonConnectUI.disconnect()}>
                  <FaSignOutAlt />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="w-full mt-2 space-y-4">
          <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden">
            <img
              src="/assets/SnakeLaddersbackground.png"
              className="background-behind-board object-cover"
              alt=""
            />

            <p className="flex justify-center mb-1">
              <Link to="/wallet" className="flex items-center space-x-1 font-bold">
                <FaWallet className="text-primary" />
                <span>Wallet</span>
              </Link>
            </p>
            <p className="text-center text-xs text-subtext">Only to send and receive TPC coins</p>

            <div className="flex items-start justify-between">
              <Link to="/wallet?mode=send" className="flex items-center space-x-1 -ml-1 pt-1">
                <FaArrowCircleUp className="text-accent w-8 h-8" />
                <span className="text-xs text-accent">Send</span>
              </Link>
              <div className="flex flex-col items-center space-y-1">
                <img src="/icons/TPCcoin.png" alt="TPC" className="w-8 h-8" />
                <span className="text-xs">{formatValue(tpcBalance ?? '...', 2)}</span>
              </div>
              <Link to="/wallet?mode=receive" className="flex items-center space-x-1 -mr-1 pt-1">
                <FaArrowCircleDown className="text-accent w-8 h-8" />
                <span className="text-xs text-accent">Receive</span>
              </Link>
            </div>
          </div>

          <div className="relative bg-surface border border-border rounded-xl p-4 flex items-center justify-between overflow-hidden">
            <img
              src="/assets/SnakeLaddersbackground.png"
              className="background-behind-board object-cover"
              alt=""
            />
            <div className="flex items-center space-x-1">
              <img src="/icons/TON.png" alt="TON" className="w-6 h-6" />
              <span className="text-sm">{formatValue(tonBalance ?? '...')}</span>
            </div>
            {!walletAddress && <TonConnectButton small className="mt-0" />}
            <div className="flex items-center space-x-1">
              <img src="/icons/Usdt.png" alt="USDT" className="w-6 h-6" />
              <span className="text-sm">{formatValue(usdtBalance ?? '...')}</span>
            </div>
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

  );

}

function formatValue(value, decimals = 4) {
  if (typeof value !== 'number') {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return parsed.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
