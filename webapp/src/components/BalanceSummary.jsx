import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import LoginOptions from './LoginOptions.jsx';
import useTokenBalances from '../hooks/useTokenBalances.js';

export default function BalanceSummary({ className = '', showHeader = true }) {
  const { tpcBalance, tonBalance, tpcWalletBalance, telegramId } =
    useTokenBalances();
  if (!telegramId) {
    return <LoginOptions />;
  }

  return (
    <div className={`text-center ${className}`}>
      {showHeader && (
        <p className="text-lg font-bold text-gray-300 flex items-center justify-center space-x-1">
          <Link to="/wallet" className="flex items-center space-x-1">
            <FaWallet className="text-primary" />
            <span>Wallet</span>
          </Link>
        </p>
      )}
      <div className="grid grid-cols-3 text-sm mt-4">
        <Token icon="/assets/icons/TON.webp" label="TON" value={tonBalance ?? '...'} />
        <Token icon="/assets/icons/file_00000000362481f7978631c42572193f.png" label="TPG (App)" value={tpcBalance ?? 0} decimals={2} iconClass="w-16 h-16" />
        <Token icon="/assets/icons/file_00000000362481f7978631c42572193f.png" label="TPG" value={tpcWalletBalance ?? '...'} decimals={2} iconClass="w-[3.2rem] h-[3.2rem]" />
      </div>
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

function Token({ icon, value, label, decimals, iconClass = 'w-8 h-8' }) {
  return (
    <div className="flex items-center justify-start space-x-1 w-full">
      <img src={icon} alt={label} className={iconClass} />
      <span>{formatValue(value, decimals)}</span>
    </div>
  );
}
