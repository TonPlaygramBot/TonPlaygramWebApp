import { useEffect, useRef } from 'react';

// URL for the rewarded video ad
const AD_VIDEO_URL =
  'https://samplelib.com/lib/preview/mp4/sample-5s.mp4';

interface AdModalProps {
  open: boolean;
  onComplete: () => void;
  onClose?: () => void;
}

export default function AdModal({ open, onComplete, onClose }: AdModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    const video = videoRef.current;

    const handleEnded = () => {
      onComplete();
    };

    video.addEventListener('ended', handleEnded);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.pause();
    };
  }, [open, onComplete]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 z-50">
      <div className="relative w-[640px] h-[360px]">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 bg-black bg-opacity-70 text-white rounded-full w-6 h-6 flex items-center justify-center"
          >
            &times;
          </button>
        )}
        <video
          ref={videoRef}
          src={AD_VIDEO_URL}
          className="w-[640px] h-[360px]"
          controls
        />
      </div>
    </div>
  );
}
