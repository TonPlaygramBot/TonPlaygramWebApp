import { AiOutlineShop } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getPresaleStatus } from '../utils/api.js';

export default function StoreAd() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    getPresaleStatus().then(setStatus);
  }, []);
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden wide-card">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
      <div className="flex items-center justify-center space-x-1">
        <AiOutlineShop className="text-accent" />
        <span className="text-lg font-bold">Store</span>
      </div>
      <div className="text-center text-sm">
        Current Price: {status ? status.currentPrice : '...'} TON / 1 TPC
      </div>
      <Link
        to="/store"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Open Store
      </Link>
    </div>
  );
}
