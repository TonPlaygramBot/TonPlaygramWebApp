import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import useTelegramBackButton from '../../hooks/useTelegramBackButton.js';
import BottomLeftIcons from '../../components/BottomLeftIcons.jsx';
import QuickMessagePopup from '../../components/QuickMessagePopup.jsx';
import GiftPopup from '../../components/GiftPopup.jsx';
import { loadAvatar } from '../../utils/avatarUtils.js';
import { chatBeep } from '../../assets/soundData.js';
import { getGameVolume, isGameMuted } from '../../utils/sound.js';

export default function GoalRush() {
  useTelegramBackButton();
  const { search } = useLocation();
  const [showChat, setShowChat] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [chatBubbles, setChatBubbles] = useState([]);
  const [muted, setMuted] = useState(isGameMuted());
  const photoUrl = loadAvatar() || '/assets/icons/profile.svg';

  useEffect(() => {
    const handler = () => setMuted(isGameMuted());
    window.addEventListener('gameMuteChanged', handler);
    return () => window.removeEventListener('gameMuteChanged', handler);
  }, []);

  return (
    <>
      <iframe
        src={`/goal-rush.html${search}`}
        title="Goal Rush"
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
        className="fixed left-1 top-1 flex flex-col items-center space-y-2 z-20"
      />
      <BottomLeftIcons
        onChat={() => setShowChat(true)}
        onGift={() => setShowGift(true)}
        className="fixed right-1 top-1 flex flex-col items-center space-y-2 z-20"
        showInfo={false}
        showMute={false}
      />
      <QuickMessagePopup
        open={showChat}
        onClose={() => setShowChat(false)}
        onSend={(text) => {
          const id = Date.now();
          setChatBubbles((b) => [...b, { id, text, photoUrl }]);
          if (!muted) {
            const a = new Audio(chatBeep);
            a.volume = getGameVolume();
            a.play().catch(() => {});
          }
          setTimeout(
            () => setChatBubbles((b) => b.filter((bb) => bb.id !== id)),
            3000,
          );
        }}
      />
      <GiftPopup
        open={showGift}
        onClose={() => setShowGift(false)}
        players={[]}
        senderIndex={0}
      />
    </>
  );
}

