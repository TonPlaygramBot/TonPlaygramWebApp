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
        title="Maintenance"
      >
        <div className="space-y-2 text-sm text-subtext">
          <p>
            This platform is currently in its prototype stage, designed to give
            you a working preview of how the full TonPlaygram ecosystem will
            operate. New features, games, and improvements are being added
            continuously.
          </p>
          <p>
            🧠 TonPlaygram was created entirely by one person — Artur Alimadhi —
            using AI tools and no external funding. Despite limited resources,
            the goal has been to prove what's possible and build a real
            foundation for the future.
          </p>
          <p>
            📸 To ensure full transparency, my name and photo are shown below —
            this is a real, grassroots project built with passion and purpose.
          </p>
          <p>
            💾 All coins minted or earned in the app are securely recorded and
            backed up in our database. Your progress and balances are saved —
            nothing is lost, and everything will carry forward as we evolve the
            platform.
          </p>
          <p>
            Once sufficient funding is raised, TonPlaygram will be rebuilt
            professionally with a dedicated team to scale the experience,
            enhance the design, and unlock the full potential of our vision.
          </p>
          <p>Thank you for being part of the journey. This is just the beginning. 🚀</p>
          <img
            src="/assets/icons/Artur Alimadhi.jpg"
            alt="Artur Alimadhi"
            className="w-24 h-24 rounded-full mx-auto"
          />
          <p className="text-center">— Artur Alimadhi<br />Founder, TonPlaygram</p>
        </div>
      </InfoPopup>
    </div>
  );
}
