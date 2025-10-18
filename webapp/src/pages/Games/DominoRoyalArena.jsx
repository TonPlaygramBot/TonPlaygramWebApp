import { useEffect, useState } from 'react';

export default function DominoRoyalArena({ search }) {
  const [src, setSrc] = useState(() => `/domino-royal.html${search || ''}`);

  useEffect(() => {
    setSrc(`/domino-royal.html${search || ''}`);
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black">
      <iframe
        key={src}
        src={src}
        title="Domino Royal 3D"
        className="w-full h-full border-0"
        allow="fullscreen; autoplay; clipboard-read; clipboard-write"
        allowFullScreen
      />
    </div>
  );
}
