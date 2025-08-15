import { useState } from 'react';
import BottomLeftIcons from './BottomLeftIcons.jsx';
import QuickMessagePopup from './QuickMessagePopup.jsx';
import GiftPopup from './GiftPopup.jsx';
import InfoPopup from './InfoPopup.jsx';
import { getTelegramPhotoUrl, getTelegramFirstName } from '../utils/telegram.js';

export default function GameFrame({ src, title, info, layout = 'default', players = [] }) {
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);

  const defaultPlayers = players.length
    ? players
    : [
        {
          index: 0,
          name: getTelegramFirstName() || 'You',
          photoUrl: getTelegramPhotoUrl(),
        },
      ];

  return (
    <div className="relative w-full h-screen">
      <iframe src={src} title={title} className="w-full h-full border-0" />
      {layout === 'split' ? null : (
        <BottomLeftIcons
          onInfo={() => setShowInfo(true)}
          onChat={() => setShowChat(true)}
          onGift={() => setShowGift(true)}
        />
      )}
      {chatBubbles.map((b) => (
        <div key={b.id} className="chat-bubble">
          <span>{b.text}</span>
          {b.photoUrl && <img src={b.photoUrl} className="w-5 h-5 rounded-full" />}
        </div>
      ))}
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          const photo = defaultPlayers[0]?.photoUrl;
          setChatBubbles((b) => [...b, { id, text, photoUrl: photo }]);
          setTimeout(() => setChatBubbles((b) => b.filter((bb) => bb.id !== id)), 3000);
        }}
      />
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={defaultPlayers}
        senderIndex={0}
        onGiftSent={() => {}}
      />
      <InfoPopup
        open={showInfo}
        onClose={() => setShowInfo(false)}
        title={title}
        info={info}
      />
    </div>
  );
}

