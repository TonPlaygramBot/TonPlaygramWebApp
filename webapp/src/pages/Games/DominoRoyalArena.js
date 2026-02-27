import { createElement, useEffect } from 'react';

import {
  DOMINO_ROYAL_INLINE_STYLE,
  DOMINO_ROYAL_MARKUP
} from './dominoRoyalTemplate.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';
const GAME_SCRIPT_SELECTOR = 'script[data-domino-royal-script="true"]';
const ROOT_ID = 'domino-royal-arena-root';

export default function DominoRoyalArena() {
  useEffect(() => {
    const root = document.getElementById(ROOT_ID);
    if (root) {
      root.innerHTML = DOMINO_ROYAL_MARKUP;
    }

    const statusNode = document.getElementById('status');
    const appRoot = document.getElementById('app');
    if (statusNode) {
      statusNode.textContent = 'Loading Domino Royal…';
    }
    if (appRoot) {
      appRoot.replaceChildren();
    }

    const existingStyle = document.getElementById(INLINE_STYLE_ID);
    const styleTag = existingStyle ?? document.createElement('style');
    if (!existingStyle) {
      styleTag.id = INLINE_STYLE_ID;
      styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;
      document.head.appendChild(styleTag);
    }

    const existingScript = document.querySelector(GAME_SCRIPT_SELECTOR);
    if (existingScript) {
      existingScript.remove();
    }

    const basePath = import.meta.env.BASE_URL || '/';
    const normalizedBasePath = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = `${normalizedBasePath}domino-royal-game.js`;
    script.dataset.dominoRoyalScript = 'true';
    script.onload = () => {
      if (statusNode) {
        statusNode.textContent = 'Ready';
      }
    };
    script.onerror = () => {
      if (statusNode) {
        statusNode.textContent = 'Game failed to load. Please refresh and try again.';
      }
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
      if (root) {
        root.replaceChildren();
      }
      if (appRoot) {
        appRoot.replaceChildren();
      }
    };
  }, []);

  return createElement('div', {
    id: ROOT_ID,
    className: 'relative h-full w-full bg-black'
  });
}
