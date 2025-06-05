import { useEffect, useState } from 'react';

export default function ConnectWallet() {
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('walletAddress');
    if (stored) setAddress(stored);
  }, []);

  const handleSave = () => {
    if (address.trim()) {
      localStorage.setItem('walletAddress', address.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center space-x-2">
        <input
          className="border p-1 rounded text-black"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Wallet address"
        />
        <button
          onClick={handleSave}
          className="px-2 py-1 bg-green-600 text-white rounded"
        >
          Save
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="px-2 py-1 bg-gray-700 rounded"
    >
      {address ? `Wallet: ${address.slice(0, 4)}...${address.slice(-4)}` : 'Connect Wallet'}
    </button>
  );
}

