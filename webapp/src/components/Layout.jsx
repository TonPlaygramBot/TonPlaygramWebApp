import React from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
    // DOM cleanup is handled in index.html before React loads
    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
            <Navbar />
            <main className="flex-grow container mx-auto p-4 pb-20">
                {children}
            </main>
            <Footer />
        </div>
    );
}
