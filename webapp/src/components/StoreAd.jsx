import { AiOutlineShop } from 'react-icons/ai';


export default function StoreAd() {
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
        <span className="text-lg font-bold">Buy TPC</span>
      </div>
      <div className="text-center text-sm">Swap TON for TPC on Ston.fi</div>
      <a
        href="https://app.ston.fi/swap?chartVisible=false&chartInterval=1w&ft=TON&tt=EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-auto block px-3 py-1 bg-primary rounded hover:bg-primary-hover text-white-shadow"
      >
        Buy TPC
      </a>
    </div>
  );
}
