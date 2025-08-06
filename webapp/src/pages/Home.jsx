import { useEffect, useState } from 'react';

import TasksCard from '../components/TasksCard.jsx';
import NftGiftCard from '../components/NftGiftCard.jsx';
import ProjectAchievementsCard from '../components/ProjectAchievementsCard.jsx';
import HomeGamesCard from '../components/HomeGamesCard.jsx';

import { IoLogoTiktok } from 'react-icons/io5';
import { RiTelegramFill } from 'react-icons/ri';

const xIcon = (
  <img
    src="/assets/icons/new-twitter-x-logo-twitter-icon-x-social-media-icon-free-png.webp"
    alt="X"
    className="w-6 h-6"
  />
);


import { ping, getProfile, fetchTelegramInfo } from '../utils/api.js';

import { getAvatarUrl, saveAvatar, loadAvatar } from '../utils/avatarUtils.js';

import { getTelegramId, getTelegramPhotoUrl } from '../utils/telegram.js';


export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState(loadAvatar() || '');

  const [walletUsd, setWalletUsd] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const connectPhantom = async () => {
    const provider = window.solana;
    if (!provider?.isPhantom) {
      alert('Phantom wallet not found');
      return;
    }
    try {
      setConnecting(true);
      const resp = await provider.connect();
      const pubKey = resp.publicKey.toString();

      const balResp = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [pubKey],
        }),
      });
      const balData = await balResp.json();
      const lamports = balData?.result?.value || 0;
      const sol = lamports / 1e9;

      const priceRes = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      const priceJson = await priceRes.json();
      const price = priceJson?.solana?.usd || 0;

      setWalletUsd(sol * price);
    } catch (err) {
      console.error('Phantom connect failed', err);
    } finally {
      setConnecting(false);
    }
  };

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
          if (p?.photo) {
            setPhotoUrl(p.photo);
            saveAvatar(p.photo);
          } else {
            fetchTelegramInfo(id).then((info) => {
              setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
            });
          }
        })
        .catch(() => {
          fetchTelegramInfo(id)
            .then((info) => {
              setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
            })
            .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
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
            if (p?.photo) {
              setPhotoUrl(p.photo);
              saveAvatar(p.photo);
            } else {
              fetchTelegramInfo(id).then((info) => {
                setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
              });
            }
          })
          .catch(() => {
            fetchTelegramInfo(id)
              .then((info) => {
                setPhotoUrl(info?.photoUrl || getTelegramPhotoUrl());
              })
              .catch(() => setPhotoUrl(getTelegramPhotoUrl()));
          });
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

        {walletUsd === null ? (
          <button
            onClick={connectPhantom}
            disabled={connecting}
            className="px-4 py-1 bg-brand-gold text-black rounded"
          >
            {connecting ? 'Connecting...' : 'Connect Phantom'}
          </button>
        ) : (
          <p className="text-center font-semibold">
            ${walletUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}

        <div className="w-full mt-2 space-y-4">
          <NftGiftCard />
          <HomeGamesCard />
        </div>

      </div>

      <div className="grid grid-cols-1 gap-4">
        <TasksCard />
      </div>
      <ProjectAchievementsCard />

      <div className="flex justify-center space-x-4 mt-4">
        <a
          href="https://x.com/TonPlaygram?t=SyGyXA0H8PdLz7z2kfIWQw&s=09"
          target="_blank"
          rel="noopener noreferrer"
        >
          {xIcon}
        </a>
        <a
          href="https://t.me/TonPlaygram"
          target="_blank"
          rel="noopener noreferrer"
        >
          <RiTelegramFill className="text-sky-400 w-6 h-6" />
        </a>
        <a
          href="https://www.tiktok.com/@tonplaygram?_t=ZS-8xxPL1nbD9U&_r=1"
          target="_blank"
          rel="noopener noreferrer"
        >
          <IoLogoTiktok className="text-pink-500 w-6 h-6" />
        </a>
      </div>
      <p className="text-center text-xs text-subtext">Status: {status}</p>


    </div>

  );

}
