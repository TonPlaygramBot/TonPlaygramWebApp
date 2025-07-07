import { useEffect, useState } from 'react';

import GameCard from '../components/GameCard.jsx';

import MiningCard from '../components/MiningCard.tsx';

import SpinGame from '../components/SpinGame.jsx';
import DailyCheckIn from '../components/DailyCheckIn.jsx';

import TasksCard from '../components/TasksCard.jsx';
import StoreAd from '../components/StoreAd.jsx';

import {
  FaUser,
  FaArrowCircleUp,
  FaArrowCircleDown,
  FaWallet
} from 'react-icons/fa';
import { useTonAddress, useTonConnectUI } from '@tonconnect/ui-react';

import { Link } from 'react-router-dom';

import { ping } from '../utils/api.js';

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import TonConnectButton from '../components/TonConnectButton.jsx';
import useTokenBalances from '../hooks/useTokenBalances.js';
import useWalletUsdValue from '../hooks/useWalletUsdValue.js';

import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';
import { getProfile } from '../utils/api.js';


export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');
  const { tpcBalance, tonBalance, usdtBalance } = useTokenBalances();
  const usdValue = useWalletUsdValue(tonBalance, usdtBalance);
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
            {/* Removed inline wallet address overlay */}
          </div>
        )}

        <TonConnectButton />
        {walletAddress && (
          <div className="roll-result text-white text-4xl">
            {'$' + formatValue(usdValue ?? '...', 2)}
          </div>
        )}

        <div className="w-full mt-2 space-y-4">
          <div className="relative bg-surface border border-border rounded-xl p-4 flex items-center justify-around overflow-hidden wide-card">
            <img
              
              src="/assets/SnakeLaddersbackground.png"
              className="background-behind-board object-cover"
              alt=""
            />
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/icons/TON.png" alt="TON" className="w-8 h-8" />
              <span className="text-base">{formatValue(tonBalance ?? '...')}</span>
            </div>
            <div className="flex-1 flex items-center justify-center space-x-1">
              <img src="/icons/Usdt.png" alt="USDT" className="w-8 h-8" />
              <span className="text-base">{formatValue(usdtBalance ?? '...', 2)}</span>
            </div>
          </div>

          <div className="relative">
            <div className="relative bg-surface border border-border rounded-xl p-4 pt-6 space-y-2 overflow-hidden wide-card">
              <div className="flex items-center justify-center space-x-1 mb-1">
                <FaWallet className="text-primary" />
                <span className="text-lg font-bold">Wallet</span>
              </div>
              <img
                
                src="/assets/SnakeLaddersbackground.png"
                className="background-behind-board object-cover"
                alt=""
              />

              <p className="text-center text-xs text-subtext">Only to send and receive TPC coins</p>

              <div className="flex items-start justify-between">
                <Link to="/wallet?mode=send" className="flex items-center space-x-1 -ml-1 pt-1">
                  <FaArrowCircleUp className="text-accent w-8 h-8" />
                  <span className="text-xs text-accent">Send</span>
                </Link>
                <div className="flex flex-col items-center space-y-1">
                  <img src="/assets/icons/TPCcoin.png" alt="TPC" className="w-10 h-10" />
                  <span className="text-sm">{formatValue(tpcBalance ?? '...', 2)}</span>
                </div>
                <Link to="/wallet?mode=receive" className="flex items-center space-x-1 -mr-1 pt-1">
                  <FaArrowCircleDown className="text-accent w-8 h-8" />
                  <span className="text-xs text-accent">Receive</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

      </div>

      <DailyCheckIn />
      <SpinGame />

      <div className="grid grid-cols-1 gap-4">
        <MiningCard />
        <TasksCard />
        <StoreAd />
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
