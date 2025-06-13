import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';

export default function HorseRacing() {
  const [selection, setSelection] = useState(null);
  const [showRoom, setShowRoom] = useState(true);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Horse Racing</h2>
      <RoomPopup
        open={showRoom}
        selection={selection}
        setSelection={setSelection}
        onConfirm={() => setShowRoom(false)}
      />
      <ConnectWallet />
      <p>Horse racing game coming soon.</p>
    </div>
  );
}
