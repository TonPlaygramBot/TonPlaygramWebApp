import { useEffect } from 'react';

const buildDominoRoyalUrl = (search = '') => `/domino-royal.html${search || ''}`;

export default function DominoRoyalArena({ search }) {
  useEffect(() => {
    const nextUrl = buildDominoRoyalUrl(search);
    if (window.location.pathname === '/domino-royal.html' && window.location.search === (search || '')) {
      return;
    }

    window.location.assign(nextUrl);
  }, [search]);

  return (
    <div className="flex h-full w-full items-center justify-center bg-black px-6 text-center text-white/80">
      <p className="text-sm">Opening Domino Royal…</p>
    </div>
  );
}
