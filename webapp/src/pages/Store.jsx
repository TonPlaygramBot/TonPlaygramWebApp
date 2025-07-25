import useTelegramBackButton from '../hooks/useTelegramBackButton.js';
import PresaleDashboardMultiRound from '../components/PresaleDashboardMultiRound.jsx';

export default function Store() {
  useTelegramBackButton();
  return (
    <div className="relative p-4 space-y-4 text-text flex flex-col items-center min-h-screen bg-surface">
      <img src="/assets/icons/TonPlayGramLogo.webp" alt="TonPlaygram" className="w-16" />
      <p className="text-brand-gold text-xs tracking-widest">PLAY. EARN. DOMINATE.</p>
      <h2 className="text-2xl font-bold">Buy TPC</h2>
      <PresaleDashboardMultiRound />
    </div>
  );
}
