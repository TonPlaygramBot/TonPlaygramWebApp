import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomSelector from '../../components/RoomSelector.jsx';

export default function SnakeLadders() {
  const [selection, setSelection] = useState({ token: 'TPC', amount: 100 });

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Snakes &amp; Ladders</h2>
      <RoomSelector selected={selection} onSelect={setSelection} />
      <ConnectWallet />
      <iframe
        src="https://snakes-and-ladders-game.netlify.app/"
        title="Snakes and Ladders Game"
        className="w-full h-[80vh] border rounded"
      />
    </div>
  );
}
