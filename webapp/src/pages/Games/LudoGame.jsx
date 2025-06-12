import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';

export default function LudoGame() {
  const [selection, setSelection] = useState({ token: 'TPC', amount: 100 });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Ludo Game</h2>
      <RoomSelector selected={selection} onSelect={setSelection} />
      <ConnectWallet />
      <p>Ludo game coming soon.</p>
    </div>
  );
}
