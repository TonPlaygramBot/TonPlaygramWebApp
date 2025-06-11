import { useEffect, useState } from 'react';
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

