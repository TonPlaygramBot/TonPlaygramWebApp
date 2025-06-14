import { useEffect, useState } from 'react';

import GameCard from '../components/GameCard.jsx';

import MiningCard from '../components/MiningCard.tsx';

import SpinGame from '../components/SpinGame.jsx';

import TasksCard from '../components/TasksCard.jsx';

import { FaUser, FaArrowCircleUp, FaArrowCircleDown } from 'react-icons/fa';

import { Link } from 'react-router-dom';

import { ping } from '../utils/api.js';

import ConnectWallet from "../components/ConnectWallet.jsx";

import BalanceSummary from '../components/BalanceSummary.jsx';

import { getTelegramPhotoUrl } from '../utils/telegram.js';

export default function Home() {

  const [status, setStatus] = useState('checking');

  const [photoUrl, setPhotoUrl] = useState('');

  useEffect(() => {

    ping()

      .then(() => setStatus('online'))

      .catch(() => setStatus('offline'));

    setPhotoUrl(getTelegramPhotoUrl());

  }, []);

  return (

    <div className="space-y-4">

      <div className="flex flex-col items-center">

        <ConnectWallet />

        {photoUrl && (

          <img

            src={photoUrl}

            alt="profile"

            className="w-36 h-36 hexagon border-4 border-brand-gold mt-2 object-cover"

          />

        )}

        <div className="flex items-center justify-between w-full max-w-xs mt-2">

          <Link to="/wallet?mode=send" className="flex items-center space-x-1">

            <FaArrowCircleUp className="text-accent w-8 h-8" />

            <span className="text-xs text-accent">Send</span>

          </Link>

          <Link to="/wallet">

            <BalanceSummary />

          </Link>

          <Link to="/wallet?mode=receive" className="flex items-center space-x-1">

            <FaArrowCircleDown className="text-accent w-8 h-8" />

            <span className="text-xs text-accent">Receive</span>

          </Link>

        </div>

      </div>

      <SpinGame />

      <div className="grid grid-cols-1 gap-4">

        <MiningCard />

        <TasksCard />

        <GameCard

          title="Profile"

          icon={<FaUser className="text-accent" />}

          link="/account"

        />

      </div>

      <p className="text-center text-xs text-subtext">Status: {status}</p>

    </div>

  );

}