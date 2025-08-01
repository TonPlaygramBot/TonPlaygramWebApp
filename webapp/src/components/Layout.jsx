import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket.js';
import { pingOnline } from '../utils/api.js';
import { getPlayerId } from '../utils/telegram.js';
import { isGameMuted, getGameVolume } from '../utils/sound.js';
import { chatBeep } from '../assets/soundData.js';
import InvitePopup from './InvitePopup.jsx';
import InfoPopup from './InfoPopup.jsx';

import Navbar from './Navbar.jsx';

import Footer from './Footer.jsx';

import Branding from './Branding.jsx';

import DynamicBackground from './DynamicBackground.jsx';
import SkyBackground from './SkyBackground.jsx';
import CosmicBackground from './CosmicBackground.jsx';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [showDevNotice, setShowDevNotice] = useState(true);
  const beepRef = useRef(null);

  useEffect(() => {
    beepRef.current = new Audio(chatBeep);
    beepRef.current.volume = getGameVolume();
    beepRef.current.muted = isGameMuted();
    beepRef.current.load();
    const volumeHandler = () => {
      if (beepRef.current) beepRef.current.volume = getGameVolume();
    };
    const muteHandler = () => {
      if (beepRef.current) beepRef.current.muted = isGameMuted();
    };
    window.addEventListener('gameVolumeChanged', volumeHandler);
    window.addEventListener('gameMuteChanged', muteHandler);
    return () => {
      window.removeEventListener('gameVolumeChanged', volumeHandler);
      window.removeEventListener('gameMuteChanged', muteHandler);
      beepRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const onInvite = ({
      fromId,
      fromName,
      roomId,
      token,
      amount,
      group,
      opponentNames,
      game
    }) => {
      setInvite({
        fromId,
        fromName,
        roomId,
        token,
        amount,
        group,
        opponentNames,
        game
      });
      if (beepRef.current && !isGameMuted()) {
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => {});
      }
    };
    socket.on('gameInvite', onInvite);
    return () => socket.off('gameInvite', onInvite);
  }, []);

  useEffect(() => {
    let id;
    try {
      const playerId = getPlayerId();
      function ping() {
        pingOnline(playerId).catch(() => {});
      }
      ping();
      id = setInterval(ping, 30000);
    } catch {}
    return () => clearInterval(id);
  }, []);

  const isHome = location.pathname === '/';
  const isMining = location.pathname === '/mining';
  const isTasks = location.pathname === '/tasks';
  const isStore = location.pathname === '/store';
  const isAccount = location.pathname === '/account';
  const isWallet = location.pathname === '/wallet';
  const isGamesRoot = location.pathname === '/games';

  const showBranding = isGamesRoot || !location.pathname.startsWith('/games');

  const showNavbar = !(
    location.pathname.startsWith('/games/') &&
    !location.pathname.includes('/lobby')
  );

  const showFooter = !location.pathname.startsWith('/games/');

  return (
    <div className="flex flex-col min-h-screen text-text relative overflow-hidden">
      <CosmicBackground />
      <main
        className={`flex-grow ${
          showNavbar ? 'container mx-auto p-4 pb-24' : 'w-full p-0'
        }`}
      >
        {showBranding && (
          <Branding
            scale={
              isMining ||
              isTasks ||
              isStore ||
              isAccount ||
              isGamesRoot ||
              isWallet
                ? 1.2
                : 1
            }
            offsetY={isMining ? '0.5rem' : 0}
          />
        )}

        {children}
      </main>

      {/* Fixed Bottom Navbar */}

      {showNavbar && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <Navbar />
        </div>
      )}

      {showFooter && <Footer />}

      <InvitePopup
        open={!!invite}
        name={invite?.fromName || invite?.fromId}
        opponents={invite?.opponentNames || []}
        stake={{ token: invite?.token, amount: invite?.amount }}
        incoming
        group={Array.isArray(invite?.group)}
        onAccept={() => {
          if (invite)
            navigate(
              `/games/${invite.game || 'snake'}?table=${invite.roomId}&token=${invite.token}&amount=${invite.amount}`
            );
          setInvite(null);
        }}
        onReject={() => setInvite(null)}
      />

      <InfoPopup
        open={showDevNotice}
        onClose={() => setShowDevNotice(false)}
        title="\u2699\ufe0f Ongoing Development Notice"
      >
        <div className="space-y-2 text-sm text-subtext">
          <p>
            This platform is currently in its prototype stage, built to give you
            a clear idea of how the full ecosystem will function. We’re actively
            working on improvements and new features around the clock.
          </p>
          <p>
            🧠 TonPlaygram was fully designed and developed by a single founder,
            with the help of AI tools and zero external funding. Despite limited
            resources, the goal has always been to deliver a powerful, engaging
            experience from day one.
          </p>
          <p>
            Once sufficient funding is secured, the platform will be rebuilt
            professionally with a dedicated team to ensure performance,
            scalability, and long-term growth.
          </p>
          <p>
            Thank you for your support and patience as we continue building the
            future of crypto gaming. 🚀
          </p>
        </div>
      </InfoPopup>
    </div>
  );
}
