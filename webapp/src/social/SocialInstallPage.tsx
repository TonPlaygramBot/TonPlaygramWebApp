import { useState, useSyncExternalStore } from 'react';
import { ArrowUpRight, Check, Download, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getSocialInstall, installSocial, openSocialInBrowser, subscribeSocialInstall } from './install';

export default function SocialInstallPage() {
  const state = useSyncExternalStore(subscribeSocialInstall, getSocialInstall, getSocialInstall);
  const [notice, setNotice] = useState('');
  return <main className="social-install-page">
    <div className="social-install-hero">
      <img src="/social-app/icon.svg" alt="" width="88" height="88" />
      <span className="social-eyebrow">YOUR COMMUNITY, IN YOUR POCKET</span>
      <h1>TonPlayGram<br /><em>Social.</em></h1>
      <p>Your friends and your chats.<br />One app, with its own home screen icon.</p>
      <button className="social-primary" disabled={state.pending || state.installed} onClick={async () => {
        const outcome = await installSocial();
        setNotice(outcome === 'accepted' ? 'Finish the installation on your device, then open the Social icon.' : outcome === 'dismissed' ? 'No problem. You can install whenever you’re ready.' : 'Follow the steps below to add Social to your home screen.');
      }}>{state.installed ? <Check /> : <Download />}{state.installed ? 'Social is installed' : state.pending ? 'Opening install…' : 'Install Social'}</button>
      {(notice || state.error) && <p className="social-install-notice" role="status">{state.error || notice}</p>}
      <Link className="social-text-link" to="/hub">Continue to the social hub <ArrowUpRight size={16} /></Link>
    </div>
    <div className="social-install-features"><span>Your community</span><span>Chats</span><span>Friends</span></div>
    <section className="social-install-steps" aria-label="Installation instructions">
      <h2><Smartphone size={20} /> Add to your home screen</h2>
      <div><strong>iPhone or iPad</strong><p>Open this page in Safari. Tap Share → Add to Home Screen → Add.</p></div>
      <div><strong>Android or desktop</strong><p>Open this page in Chrome or Edge. Choose Install app or Add to Home Screen from the browser menu, then confirm.</p></div>
      <button className="social-secondary" onClick={openSocialInBrowser}>Open in browser <ArrowUpRight size={17} /></button>
      <p className="social-muted">Already have the main TonPlayGram app? Your browser may show the menu option instead of an install popup. Choose the icon named “TPG Social”.</p>
    </section>
    <section className="social-install-steps"><h2>Still your TonPlayGram</h2><p>Your profile and conversations use the same platform. In a different browser, sign in with your existing account.</p><a className="social-text-link" href="/account">Account settings <ArrowUpRight size={16} /></a></section>
  </main>;
}
