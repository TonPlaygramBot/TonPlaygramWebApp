import { useEffect, useRef } from 'react';

// URL for the rewarded video ad iframe
const AD_VIDEO_URL =
  'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';

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
    // load rewarded video ad
    iframe.src = AD_VIDEO_URL;
    iframe.width = '100%';
    iframe.height = '100%';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allowfullscreen', '');

    const container = containerRef.current;
    container.appendChild(iframe);

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
      iframe.remove();
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
