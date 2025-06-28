import React from 'react';

import { useLocation } from 'react-router-dom';

import Navbar from './Navbar.jsx';

import Footer from './Footer.jsx';

import Branding from "./Branding.jsx";

import CosmicBackground from './CosmicBackground.jsx';

export default function Layout({ children }) {

  const location = useLocation();

  const isHome = location.pathname === '/';
  const isFriends = location.pathname === '/friends';

  const showBranding = !location.pathname.startsWith('/games');

  const showNavbar = !(

    location.pathname.startsWith('/games/') &&

    !location.pathname.includes('/lobby')

  );

  const showFooter = !location.pathname.startsWith('/games/');

  return (

    <div className="flex flex-col min-h-screen text-text relative overflow-hidden">

      {isHome && <CosmicBackground />}

      <main className={`flex-grow container mx-auto p-4 ${showNavbar ? 'pb-24' : ''}`.trim()}>

        {showBranding && <Branding small={isFriends} />}

        {children}

      </main>

      {/* Fixed Bottom Navbar */}

      {showNavbar && (

        <div className="fixed bottom-0 inset-x-0 z-50">

          <Navbar />

        </div>

      )}

      {showFooter && <Footer />}

    </div>

  );

}