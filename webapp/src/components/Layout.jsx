import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket.js';
import { pingOnline } from '../utils/api.js';
import { ensureAccountId } from '../utils/telegram.js';
import InvitePopup from './InvitePopup.jsx';
import { chatBeep } from '../assets/soundData.js';
import { isGameMuted, getGameVolume } from '../utils/sound.js';

import Navbar from './Navbar.jsx';

import Footer from './Footer.jsx';

import Branding from './Branding.jsx';

import CosmicBackground from './CosmicBackground.jsx';

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const beepRef = useRef(null);

  useEffect(() => {
    beepRef.current = new Audio(chatBeep);
    beepRef.current.volume = getGameVolume();
    beepRef.current.muted = isGameMuted();
    const onInvite = ({ fromId, fromName, roomId, token, amount, game }) => {
      setInvite({ fromId, fromName, roomId, token, amount, game });
      if (beepRef.current && !isGameMuted()) {
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => {});
      }
    };
    socket.on('gameInvite', onInvite);
    return () => {
      socket.off('gameInvite', onInvite);
      beepRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    const muteHandler = () => {
      if (beepRef.current) beepRef.current.muted = isGameMuted();
    };
    const volumeHandler = () => {
      if (beepRef.current) beepRef.current.volume = getGameVolume();
    };
    window.addEventListener('gameMuteChanged', muteHandler);
    window.addEventListener('gameVolumeChanged', volumeHandler);
    return () => {
      window.removeEventListener('gameMuteChanged', muteHandler);
      window.removeEventListener('gameVolumeChanged', volumeHandler);
    };
  }, []);

  useEffect(() => {
    const onConnect = () => {
      console.log('Connected to lobby server');
    };
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, []);

  useEffect(() => {
    let id;
    let cancelled = false;
    ensureAccountId()
      .then((accountId) => {
        if (cancelled || !accountId) return;
        function ping() {
          pingOnline(accountId).catch(() => {});
        }
        ping();
        id = setInterval(ping, 30000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (id) clearInterval(id);
    };
  }, []);

  const isHome = location.pathname === '/';
  const isFriends = location.pathname === '/friends';
  const isTasks = location.pathname === '/tasks';
  const isStore = location.pathname === '/store';
  const isAccount = location.pathname === '/account';
  const isGamesRoot = location.pathname === '/games';

  const showBranding = isGamesRoot || !location.pathname.startsWith('/games');

  const showNavbar = !(

    location.pathname.startsWith('/games/') &&

    !location.pathname.includes('/lobby')

  );

  const showFooter = !location.pathname.startsWith('/games/');

  return (

    <div className="flex flex-col min-h-screen text-text relative overflow-hidden">

      {isHome && <CosmicBackground />}

      <main className={`flex-grow container mx-auto p-4 ${showNavbar ? 'pb-24' : ''}`.trim()}>

        {showBranding && (
          <Branding
            scale={isFriends || isTasks || isStore || isAccount || isGamesRoot ? 1.2 : 1}
            offsetY={isFriends ? '0.5rem' : 0}
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
        stake={{ token: invite?.token, amount: invite?.amount }}
        incoming
        onAccept={() => {
          if (invite)
            navigate(
              `/games/${invite.game || 'snake'}?table=${invite.roomId}&token=${invite.token}&amount=${invite.amount}`,
            );
          setInvite(null);
        }}
        onReject={() => setInvite(null)}
      />

    </div>

  );

}