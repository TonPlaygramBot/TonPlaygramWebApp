import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
 x0lcjc-codex/integrate-telegram-auth-and-tonkeeper-wallet
    // DOM cleanup is handled in index.html before React loads
    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
            <Navbar />
            <main className="flex-grow container mx-auto p-4">
                {children}
            </main>
            <Footer />
        </div>
    );
  // Optional cleanup (in case index.html didn’t already handle it)
  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;

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
 main
}
