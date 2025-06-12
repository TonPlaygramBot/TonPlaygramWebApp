import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      <main className="flex-grow container mx-auto p-4 pb-20">{children}</main>
      <Navbar />
      <Footer />
    </div>
  );
}
