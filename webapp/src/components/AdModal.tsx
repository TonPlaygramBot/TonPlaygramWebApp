import { useEffect, useRef } from 'react';

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !containerRef.current) return;

    const iframe = document.createElement('iframe');
    iframe.src =
      'https://www.profitableratecpm.com/ee29ns0ue?key=548d7cc2fa500f230382d44b52e931c0';
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');

    const container = containerRef.current;
    container.appendChild(iframe);

    const timer = setTimeout(() => {
      onComplete();
    }, 30000);

    return () => {
      clearTimeout(timer);
      iframe.remove();
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="bg-surface border border-border p-6 rounded text-center space-y-4 text-text w-80 relative">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute -top-3 -right-3 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            &times;
          </button>
        )}
        <h3 className="text-lg font-bold">Watch Ad</h3>
        <div
          id="adsgram-player"
          ref={containerRef}
          className="w-full h-40 bg-black"
        />
        <p className="text-sm text-subtext">Watch the ad completely to unlock the spin.</p>
      </div>
    </div>
  );
}
