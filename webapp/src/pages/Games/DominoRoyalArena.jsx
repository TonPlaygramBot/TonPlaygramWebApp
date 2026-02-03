import { useEffect, useState } from 'react';

export default function DominoRoyalArena({ search }) {
  const [src, setSrc] = useState(() => `/domino-royal.html${search || ''}`);

  useEffect(() => {
    setSrc(`/domino-royal.html${search || ''}`);
  }, [search]);

  return (
    <div className="relative w-full h-full bg-black">
      <iframe
        key={src}
        src={src}
        title="Domino Royal 3D"
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen; autoplay; clipboard-read; clipboard-write; accelerometer; gyroscope"
        allowFullScreen
      />
    </div>
  );
}
