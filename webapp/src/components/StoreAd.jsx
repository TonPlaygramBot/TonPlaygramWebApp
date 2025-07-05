import { AiOutlineShop } from 'react-icons/ai';
import { Link } from 'react-router-dom';
import { STORE_CATEGORIES } from '../utils/storeData.js';

const CATEGORY_ICONS = {
  Presale: '🌱',
  'Spin & Win': '🎰',
  'Virtual Friends': '🤖',
  'Bonus Bundles': '🎁',
};

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
        {STORE_CATEGORIES.map((c) => (
          <div key={c} className="store-card flex-shrink-0 w-72">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{CATEGORY_ICONS[c]}</span>
              <h3 className="font-semibold">{c}</h3>
            </div>
            <p className="text-sm text-subtext">Browse bundles</p>
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
