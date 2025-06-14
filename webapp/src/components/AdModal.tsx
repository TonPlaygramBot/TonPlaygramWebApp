interface AdModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AdModal({ open, onClose }: AdModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80">
        <img
          src="/assets/TonPlayGramLogo.jpg"
          alt="TonPlaygram Logo"
          className="w-12 h-12 mx-auto transform scale-110"
        />
        <h3 className="text-lg font-bold">Watch Ad</h3>
        <p className="text-sm text-subtext">Watch an ad every hour to get a free spin.</p>
        <button onClick={onClose} className="px-4 py-1 bg-primary hover:bg-primary-hover text-white rounded w-full">
          Close
        </button>
      </div>
    </div>
  );
}
