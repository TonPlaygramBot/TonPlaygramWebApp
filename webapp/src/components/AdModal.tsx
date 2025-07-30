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

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src =
      '//pl27300376.profitableratecpm.com/5c/aa/47/5caa47c392c4c58e997787300589a63c.js';

    const container = containerRef.current;
    container.appendChild(script);

    const handleMessage = (e: MessageEvent) => {
      if (
        e.origin.includes('profitableratecpm.com') &&
        (e.data === 'complete' || e.data === 'adComplete')
      ) {
        onComplete();
      }
    };
    window.addEventListener('message', handleMessage);

    const timer = setTimeout(() => {
      onComplete();
    }, 40000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timer);
      script.remove();
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="relative w-full h-full">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            &times;
          </button>
        )}
        <div
          id="adsgram-player"
          ref={containerRef}
          className="w-full h-full bg-black"
        />
      </div>
    </div>
  );
}
