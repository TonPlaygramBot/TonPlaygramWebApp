import React, { useEffect } from 'react';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout({ children }) {
    useEffect(() => {
        const first = document.body.firstElementChild;
        if (first && first.id !== 'root') {
            first.remove();
        }
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-gray-900 text-gray-100">
            <Navbar />
            <main className="flex-grow container mx-auto p-4">
                {children}
            </main>
            <Footer />
        </div>
    );
}
