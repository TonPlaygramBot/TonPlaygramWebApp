import { useEffect, useState } from 'react';
import { FaWallet } from 'react-icons/fa';
import { Link } from 'react-router-dom';
import { useTonWallet } from '@tonconnect/ui-react';
import { getWalletBalance, getTonBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';
import OpenInTelegram from './OpenInTelegram.jsx';

export default function BalanceSummary() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

  const [balances, setBalances] = useState({ ton: null, tpc: null, usdt: 0 });
  const wallet = useTonWallet();

  const loadBalances = async () => {
