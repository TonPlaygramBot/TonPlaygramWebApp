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
        <Token icon="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" label="TPC (App)" value={tpcBalance ?? 0} decimals={2} />
        <Token icon="/assets/icons/eab316f3-7625-42b2-9468-d421f81c4d7c.webp" label="TPC" value={tpcWalletBalance ?? '...'} decimals={2} />
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

function Token({ icon, value, label, decimals }) {
  return (
    <div className="flex items-center justify-start space-x-1 w-full">
      <img  src={icon} alt={label} className="w-8 h-8" />
      <span>{formatValue(value, decimals)}</span>
    </div>
  );
}
