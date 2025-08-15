import { useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import { chatBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';
import { parsePlayersFromSearch } from '../../utils/playerParams.js';

export default function TetrisRoyale() {
  useTelegramBackButton();
  const { search } = useLocation();
  const players = useMemo(() => parsePlayersFromSearch(search), [search]);
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  return (
    <>
      <iframe
        src={`/tetris-royale.html${search}`}
        title="Tetris Royale"
        className="w-full h-screen border-0"
      />
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          <img src={b.photoUrl} className="w-5 h-5 rounded-full" />
        </div>
      ))}
      <BottomLeftIcons
        onInfo={() => {}}
        onChat={() => setShowChat(true)}
        onGift={() => setShowGift(true)}
        className="fixed right-1 top-1/2 -translate-y-1/2 flex flex-col items-center space-y-2 z-20"
      />
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [...b, { id, text, photoUrl: players[0]?.photoUrl }]);
          if (!isGameMuted()) {
            const a = new Audio(chatBeep);
            a.volume = getGameVolume();
            a.play().catch(() => {});
          }
          setTimeout(() => setChatBubbles((b) => b.filter((bb) => bb.id !== id)), 3000);
        }}
      />
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={players}
        senderIndex={0}
      />
    </>
  );
}
