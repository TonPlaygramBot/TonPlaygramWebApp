import { useState } from 'react';
import RoomPopup from '../../components/RoomPopup.jsx';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';

export default function HorseRacing() {
  useTelegramBackButton();
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
        onClose={() => setShowRoom(false)}
      />
      <p>Horse racing game coming soon.</p>
    </div>
  );
}
