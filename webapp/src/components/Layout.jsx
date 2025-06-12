import React, { useEffect } from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

    // Remove any stray elements that appear before the React root.
    let prev = root.previousSibling;
    while (prev) {
      const node = prev;
      prev = prev.previousSibling;
      node.parentNode?.removeChild(node);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      <Navbar />
      <main className="flex-grow container mx-auto p-4">
        {children}
      </main>
      <Footer />
    </div>
  );
}
