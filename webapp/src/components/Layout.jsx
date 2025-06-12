import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text relative">
      <main className="flex-grow container mx-auto p-4 pb-24">
        {children}
      </main>

      {/* Fixed Bottom Navbar */}
      <div className="fixed bottom-0 inset-x-0 z-50">
        <Navbar />
      </div>

      <Footer />
    </div>
  );
}
