import { useEffect, useState } from 'react';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { getWalletAddress, setWalletAddress, getWalletBalance } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function ConnectWallet() {
  const wallet = useTonWallet();
  const telegramId = getTelegramId();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    const saveAndFetch = async () => {
      const res = await getWalletAddress(telegramId);
      const saved = res.address;
      const current = wallet?.account?.address;
      if (current && current !== saved) {
        await setWalletAddress(telegramId, current);
      }
      if (current) {
        const bal = await getWalletBalance(telegramId);
        if (bal.balance !== undefined) setBalance(bal.balance);
      }
    };
    saveAndFetch();
  }, [wallet]);

  return (
    <div className="flex items-center space-x-2">
      <TonConnectButton />
      {wallet?.account?.address && balance !== null && (
        <span className="text-xs">{balance} TON</span>
      )}
    </div>
import { ethers } from 'ethers';
import { getWalletAddress, setWalletAddress } from '../utils/api.js';
import { getTelegramId } from '../utils/telegram.js';

export default function ConnectWallet() {
  const [address, setAddress] = useState('');
  const telegramId = getTelegramId();

  useEffect(() => {
    const fetchAddress = async () => {
      const res = await getWalletAddress(telegramId);
      if (res.address) setAddress(res.address);
    };
    fetchAddress();
  }, []);

  const handleConnect = async () => {
    if (!window.ethereum) {
      alert('MetaMask not found');
      return;
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const accounts = await provider.send('eth_requestAccounts', []);
    const addr = accounts[0];
    setAddress(addr);
    await setWalletAddress(telegramId, addr);
  };

  if (!address) {
    return (
      <button onClick={handleConnect} className="px-2 py-1 bg-gray-700 rounded">
        Connect Wallet
      </button>
    );
  }

  return (
    <button className="px-2 py-1 bg-gray-700 rounded" disabled>
      Wallet: {address.slice(0, 4)}...{address.slice(-4)}
    </button>

  );
}

