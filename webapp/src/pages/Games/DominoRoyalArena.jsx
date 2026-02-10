import { useEffect, useRef } from 'react';

import { DOMINO_ROYAL_INLINE_STYLE, DOMINO_ROYAL_MARKUP } from './dominoRoyalTemplate.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';

export default function DominoRoyalArena() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const existingStyle = document.getElementById(INLINE_STYLE_ID);
    const styleTag = existingStyle ?? document.createElement('style');
    if (!existingStyle) {
      styleTag.id = INLINE_STYLE_ID;
      styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;
      document.head.appendChild(styleTag);
    }

    containerRef.current.innerHTML = DOMINO_ROYAL_MARKUP;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/domino-royal-game.js';
    script.dataset.dominoRoyalScript = 'true';
    document.body.appendChild(script);

    return () => {
      script.remove();
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return <div ref={containerRef} className="relative h-full w-full bg-black" />;
}
