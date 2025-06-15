import { useState } from 'react';
import ConnectWallet from '../../components/ConnectWallet.jsx';
import RoomPopup from '../../components/RoomPopup.jsx';
import OpenInTelegram from '../../components/OpenInTelegram.jsx';
import { BOT_USERNAME } from '../../utils/constants.js';
import { getTelegramId } from '../../utils/telegram.js';

export default function LudoGame() {
  let telegramId;
  try {
    telegramId = getTelegramId();
  } catch (err) {
    return <OpenInTelegram />;
  }

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
      <p>
        This game is played in Telegram. Open{' '}
        <a
          href={`https://t.me/${BOT_USERNAME}`}
          className="text-primary underline"
        >
          @{BOT_USERNAME}
        </a>{' '}
        and use <code>/startludo</code> to create a session. Other players can
        <code> /join</code>, then <code>/begin</code> to start and <code>/roll</code>
        to take turns.
      </p>
    </div>
  );
}
