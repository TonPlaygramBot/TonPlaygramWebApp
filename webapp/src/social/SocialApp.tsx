import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ArrowUpRight, Download, MessageCircle, Radio, UserRound } from 'lucide-react';
import BackNavigationProvider from '../components/BackNavigationProvider.jsx';
import useTelegramAuth from '../hooks/useTelegramAuth.js';
import { SOCIAL_APP_BASE } from '../../../shared/socialApp.js';
import SocialInstallPage from './SocialInstallPage';
import './social-app.css';

const Messages = lazy(() => import('../pages/Social.jsx'));
const CreatorStudio = lazy(() => import('../features/creator/CreatorStudio'));
const LegalPage = lazy(() => import('../pages/LegalPage.jsx'));

export function SocialShell() {
  const location = useLocation();
  const studioActive = location.pathname === '/creator-studio';
  const [studioVisited, setStudioVisited] = useState(studioActive);
  const [broadcastState, setBroadcastState] = useState<'idle' | 'preparing' | 'active'>('idle');
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => { if (studioActive) setStudioVisited(true); }, [studioActive]);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener('online', refresh); window.addEventListener('offline', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
  }, []);
  return <div className="social-app-shell">
    <header className="social-app-header">
      <Link to="/hub" className="social-brand" aria-label="TonPlayGram Social hub"><img src="/social-app/icon.svg" alt="" /><span><small>TONPLAYGRAM</small><strong>Social</strong></span></Link>
      <div><Link to="/install" aria-label="Install TonPlayGram Social"><Download size={19} /><span>Get app</span></Link><a href="/" aria-label="Open main TonPlayGram app"><ArrowUpRight size={21} /></a></div>
    </header>
    {!online && <p className="social-offline" role="status">You’re offline. Reconnect to load your chats and friends.</p>}
    {!studioActive && broadcastState !== 'idle' && <div className="social-broadcast" role="status"><span>{broadcastState === 'active' ? 'Your live broadcast is still running.' : 'Your broadcast is being prepared.'}</span><Link to="/creator-studio">Return to Studio</Link></div>}
    <div className="social-app-content">
      <Suspense fallback={<p className="social-loading" role="status">Opening Social…</p>}>
        {/* Studio stays mounted after its first visit so switching to chats or
            friends doesn't discard its composer, upload, or live session. */}
        {(studioActive || studioVisited) && <div hidden={!studioActive}><CreatorStudio active={studioActive} onBroadcastStateChange={setBroadcastState} /></div>}
        <Routes>
          <Route path="/" element={<Navigate replace to="/hub" />} />
          <Route path="/wall/*" element={<Navigate replace to="/hub" />} />
          <Route path="/flamingo/*" element={<Navigate replace to="/hub" />} />
          <Route path="/hub" element={<div className="social-hub"><Link to="/creator-studio" className="social-studio-card"><span><small>CREATE. CONNECT. GO LIVE.</small><strong>Creator Studio</strong><span>One post. All your audiences.</span></span><ArrowUpRight /></Link><Messages /></div>} />
          <Route path="/social" element={<Navigate replace to="/hub" />} />
          <Route path="/messages" element={<Navigate replace to="/hub" />} />
          <Route path="/creator-studio" element={null} />
          <Route path="/me" element={<main className="social-account"><h1>Your TonPlayGram account</h1><p>Manage your profile and sign-in from the main app.</p><a className="social-primary" href="/account">Account settings <ArrowUpRight size={18} /></a></main>} />
          <Route path="/install" element={<SocialInstallPage />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="*" element={<main className="social-account"><h1>Continue in TonPlayGram</h1><p>Games, wallet, and account settings are in the main app.</p><a className="social-primary" href={`${window.location.origin}${location.pathname}${location.search}${location.hash}`}>Open main app <ArrowUpRight size={18} /></a><Link className="social-text-link" to="/hub">Back to the social hub</Link></main>} />
        </Routes>
      </Suspense>
    </div>
    <nav className="social-bottom-nav" aria-label="Social app">
      <NavLink to="/hub"><MessageCircle /><span>Social hub</span></NavLink>
      <NavLink to="/creator-studio"><Radio /><span>Studio</span></NavLink>
      <NavLink to="/me"><UserRound /><span>Profile</span></NavLink>
    </nav>
  </div>;
}

export default function SocialApp() {
  useTelegramAuth();
  return <BrowserRouter basename={SOCIAL_APP_BASE}><BackNavigationProvider>
    <TonConnectUIProvider manifestUrl={`${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tonconnect-manifest.json`}>
      <SocialShell />
    </TonConnectUIProvider>
  </BackNavigationProvider></BrowserRouter>;
}
