import { AiOutlineShop } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { STORE_CATEGORIES, STORE_BUNDLES } from '../utils/storeData.js';

const CATEGORY_ICONS = {
  Presale: '🌱',
  'Spin & Win': '🎰',
  'Virtual Friends': '🤖',
  'Bonus Bundles': '🎁',
};

export default function StoreAd() {
  const [category, setCategory] = useState(STORE_CATEGORIES[0]);
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden">
      <div className="background-behind-board galaxy-bg" />
      <div className="flex items-center justify-center space-x-1">
        <AiOutlineShop className="text-accent" />
        <span className="text-lg font-bold">Store</span>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-1">
        {STORE_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`lobby-tile px-3 py-1 flex-shrink-0 ${category === c ? 'lobby-selected' : ''}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {STORE_BUNDLES.filter(b => b.category === category).map((b) => (
          <div key={b.id} className="store-card flex-shrink-0 w-72">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{b.icon}</span>
              <h3 className="font-semibold">{b.name}</h3>
            </div>
            <div className="text-sm flex items-center space-x-1">
              <span>{b.tpc.toLocaleString()}</span>
              <img src="/assets/icons/TPCcoin.png" alt="TPC" className="w-5 h-5" />
            </div>
            <div className="text-sm flex items-center space-x-1 text-primary">
              <span>{b.ton}</span>
              <img src="/icons/TON.png" alt="TON" className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>
      <Link
        to="/store"
        className="inline-block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Open Store
      </Link>
    </div>
  );
}
