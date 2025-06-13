import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';

export default function SnakeLadders() {
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Snakes &amp; Ladders</h2>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={() => setShowRoom(false)}
      />
      <ConnectWallet />
      <iframe
        src="https://snakes-and-ladders-game.netlify.app/"
        title="Snakes and Ladders Game"
        className="w-full h-[80vh] border rounded"
      />
    </div>
  );
}
