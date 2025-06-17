import React from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import Branding from "./Branding.jsx";

export default function Layout({ children }) {
  const location = useLocation();
  const showBranding = !location.pathname.startsWith('/games');
  const showNavbar = !(
    location.pathname.startsWith('/games/') &&
    !location.pathname.includes('/lobby')
  );

  return (
    <div className="flex flex-col min-h-screen bg-background text-text relative">
      <main className={`flex-grow container mx-auto p-4 ${showNavbar ? 'pb-24' : ''}`.trim()}>
        {showBranding && <Branding />}
        {children}
      </main>

      {/* Fixed Bottom Navbar */}
      {showNavbar && (
        <div className="fixed bottom-0 inset-x-0 z-50">
          <Navbar />
        </div>
      )}

      <Footer />
    </div>
  );
}
