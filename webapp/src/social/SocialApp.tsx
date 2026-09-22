import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { ArrowUpRight, Download, Grid3X3, MessageCircle, Plus, UserRound } from 'lucide-react';
import BackNavigationProvider from '../components/BackNavigationProvider.jsx';
import useTelegramAuth from '../hooks/useTelegramAuth.js';
import { WallTransfersProvider } from '../features/flamingo/WallTransfers';
import { useWallFollowing } from '../features/flamingo/wallFollowing';
import { SOCIAL_APP_BASE } from '../../../shared/socialApp.js';
import SocialInstallPage from './SocialInstallPage';
import './social-app.css';

const CommunityWallApp = lazy(() => import('../features/flamingo/CommunityWallApp'));
const SocialProfilePage = lazy(() => import('../features/flamingo/SocialProfilePage'));
const Messages = lazy(() => import('../pages/Social.jsx'));
const LoginOptions = lazy(() => import('../components/LoginOptions.jsx'));
const LegalPage = lazy(() => import('../pages/LegalPage.jsx'));

function MyProfile() {
  const { accountId } = useWallFollowing();
  return accountId ? <Navigate replace to={`/wall/profile/${encodeURIComponent(accountId)}`} /> : <main className="social-account"><h1>Your Social profile</h1><p>Use the account you already use with TonPlayGram.</p><LoginOptions /></main>;
}

export function SocialShell() {
  const location = useLocation();
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const refresh = () => setOnline(navigator.onLine);
    window.addEventListener('online', refresh); window.addEventListener('offline', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); };
  }, []);
  return <div className="social-app-shell">
    <header className="social-app-header">
      <Link to="/wall" className="social-brand" aria-label="TonPlayGram Social wall"><img src="/social-app/icon.svg" alt="" /><span><small>TONPLAYGRAM</small><strong>Social</strong></span></Link>
      <div><Link to="/install" aria-label="Install TonPlayGram Social"><Download size={19} /><span>Get app</span></Link><a href="/" aria-label="Open main TonPlayGram app"><ArrowUpRight size={21} /></a></div>
    </header>
    {!online && <p className="social-offline" role="status">You’re offline. Saved wall uploads will resume when you reconnect.</p>}
    <div className="social-app-content">
      <Suspense fallback={<p className="social-loading" role="status">Opening Social…</p>}>
        <Routes>
          <Route path="/" element={<Navigate replace to="/wall" />} />
          <Route path="/wall" element={<CommunityWallApp />} />
          <Route path="/wall/profile/:accountId" element={<SocialProfilePage />} />
          <Route path="/hub" element={<div className="social-hub"><Messages /></div>} />
          <Route path="/social" element={<Navigate replace to="/hub" />} />
          <Route path="/messages" element={<Navigate replace to="/hub" />} />
          <Route path="/creator-studio" element={<Navigate replace to="/wall" />} />
          <Route path="/me" element={<MyProfile />} />
          <Route path="/install" element={<SocialInstallPage />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="*" element={<main className="social-account"><h1>Continue in TonPlayGram</h1><p>Games, wallet, and account settings are in the main app.</p><a className="social-primary" href={`${window.location.origin}${location.pathname}${location.search}${location.hash}`}>Open main app <ArrowUpRight size={18} /></a><Link className="social-text-link" to="/wall">Back to the wall</Link></main>} />
        </Routes>
      </Suspense>
    </div>
    <nav className="social-bottom-nav" aria-label="Social app">
      <NavLink to="/wall" end><Grid3X3 /><span>Wall</span></NavLink>
      <NavLink to="/hub"><MessageCircle /><span>Social hub</span></NavLink>
      <Link to="/wall#wall-composer" className="social-create" onClick={() => window.dispatchEvent(new Event('wall-compose'))}><Plus /><span>Create</span></Link>
      <NavLink to="/me" className={location.pathname.startsWith('/wall/profile/') ? 'active' : undefined}><UserRound /><span>Profile</span></NavLink>
    </nav>
  </div>;
}

export default function SocialApp() {
  useTelegramAuth();
  return <BrowserRouter basename={SOCIAL_APP_BASE}><BackNavigationProvider>
    <TonConnectUIProvider manifestUrl={`${import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin}/tonconnect-manifest.json`}>
      <WallTransfersProvider><SocialShell /></WallTransfersProvider>
    </TonConnectUIProvider>
  </BackNavigationProvider></BrowserRouter>;
}
