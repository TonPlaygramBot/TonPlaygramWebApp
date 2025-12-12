import React, { useState, useEffect, useRef } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';
import { socket } from '../utils/socket.js';
import { pingOnline } from '../utils/api.js';
import { getPlayerId } from '../utils/telegram.js';
import { isGameMuted, getGameVolume } from '../utils/sound.js';
import { chatBeep as inviteBeep } from '../assets/soundData.js';
import InvitePopup from './InvitePopup.jsx';
import InstallPrompt from './InstallPrompt.jsx';

import Navbar from './Navbar.jsx';

import Footer from './Footer.jsx';


export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const inviteSoundRef = useRef(null);

  useEffect(() => {
    inviteSoundRef.current = new Audio(inviteBeep);
    inviteSoundRef.current.volume = getGameVolume();
    inviteSoundRef.current.muted = isGameMuted();
    inviteSoundRef.current.load();
    const volumeHandler = () => {
      if (inviteSoundRef.current) inviteSoundRef.current.volume = getGameVolume();
    };
    const muteHandler = () => {
      if (inviteSoundRef.current) inviteSoundRef.current.muted = isGameMuted();
    };
    window.addEventListener('gameVolumeChanged', volumeHandler);
    window.addEventListener('gameMuteChanged', muteHandler);
    return () => {
      window.removeEventListener('gameVolumeChanged', volumeHandler);
      window.removeEventListener('gameMuteChanged', muteHandler);
      inviteSoundRef.current?.pause();
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
      if (inviteSoundRef.current && !isGameMuted()) {
        inviteSoundRef.current.currentTime = 0;
        inviteSoundRef.current.play().catch(() => {});
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
        const status = localStorage.getItem('onlineStatus') || 'online';
        pingOnline(playerId, status).catch(() => {});
      }
      ping();
      id = setInterval(ping, 30000);
    } catch {}
    return () => clearInterval(id);
  }, []);

  const showNavbar = !(
    location.pathname.startsWith('/games/') &&
    !location.pathname.includes('/lobby')
  );

  const isLobby = location.pathname.includes('/lobby');

  const showFooter = !location.pathname.startsWith('/games/');
  const showHeader =
    !location.pathname.startsWith('/games/') ||
    isLobby;

  useEffect(() => {
    if (location.pathname === '/mining') {
      document.body.classList.add('mining-page');
    } else {
      document.body.classList.remove('mining-page');
    }
  }, [location.pathname]);

  useEffect(() => {
    const isGamePage =
      location.pathname.startsWith('/games/') &&
      !location.pathname.includes('/lobby');
    if (isGamePage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [location.pathname]);

  return (
    <div className="flex flex-col min-h-screen text-text relative overflow-hidden">
      {showHeader && (
        <header className="w-full bg-surface border-b-2 border-accent flex justify-center py-0.5">
          <img
            src="/assets/icons/file_00000000bc2862439eecffff3730bbe4.webp"
            alt="TonPlaygram logo"
            className="h-[190px]"
          />
        </header>
      )}
      <main
        className={`flex-grow ${
          showNavbar
            ? isLobby
              ? 'w-full p-4 pb-24'
              : 'container mx-auto p-4 pb-24'
            : 'w-full p-0'
        }`}
      >
        {children}
      </main>

      {/* Fixed Bottom Navbar */}

      {showNavbar && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <Navbar />
        </div>
      )}

      <InstallPrompt />

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

    </div>
  );
}
