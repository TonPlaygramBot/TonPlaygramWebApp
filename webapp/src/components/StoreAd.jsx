import { AiOutlineShop } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import { STORE_BUNDLES } from '../utils/storeData.js';

export default function StoreAd() {
  return (
    <div className="relative bg-surface border border-border rounded-xl p-4 space-y-2 overflow-hidden">
      <img
        src="/assets/SnakeLaddersbackground.png"
        className="background-behind-board object-cover"
        alt=""
      />
      <div className="flex items-center justify-center space-x-1">
        <AiOutlineShop className="text-accent" />
        <span className="text-lg font-bold">Store</span>
      </div>
      <div className="flex space-x-4 overflow-x-auto pb-2">
        {STORE_BUNDLES.map((b) => (
          <div key={b.id} className="store-card flex-shrink-0 w-60">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{b.icon}</span>
              <h3 className="font-semibold">{b.name}</h3>
            </div>
            <div className="text-lg font-bold flex items-center space-x-1">
              <span>{b.tpc.toLocaleString()}</span>
              <img src="/assets/icons/TPCcoin.png" alt="TPC" className="w-6 h-6" />
            </div>
            <div className="text-primary text-lg flex items-center space-x-1">
              <span>{b.ton}</span>
              <img src="/icons/TON.png" alt="TON" className="w-6 h-6" />
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
