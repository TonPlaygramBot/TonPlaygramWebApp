import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';

export default function LudoGame() {

  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);

  return (
    <div className="p-4 space-y-4 text-text">
      <h2 className="text-xl font-bold">Ludo Game</h2>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={() => setShowRoom(false)}
      />
      <ConnectWallet />
      <iframe
        src="https://eze4acme.github.io/Ludo-Built-With-React/"
        title="Ludo Game"
        className="w-full h-[80vh] border rounded"
      />
    </div>
  );
}
