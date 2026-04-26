import { useEffect } from 'react';

import {
  DOMINO_ROYAL_INLINE_STYLE,
  DOMINO_ROYAL_MARKUP
} from './dominoRoyalTemplate.js';

const INLINE_STYLE_ID = 'domino-royal-inline-style';
const GAME_SCRIPT_SELECTOR = 'script[data-domino-royal-script="true"]';
const DOMINO_ROYAL_SCRIPT_VERSION = '2026-04-21-domino-rollback-v1';

export default function DominoRoyalArena() {
  useEffect(() => {
    const mountNode = document.getElementById('dominoRoyalMount');
    if (!mountNode) return undefined;

    mountNode.innerHTML = DOMINO_ROYAL_MARKUP;

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
    styleTag.id = INLINE_STYLE_ID;
    styleTag.textContent = DOMINO_ROYAL_INLINE_STYLE;
    if (!existingStyle) {
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
    script.src = `${normalizedBasePath}domino-royal-game.js?v=${DOMINO_ROYAL_SCRIPT_VERSION}`;
    script.dataset.dominoRoyalScript = 'true';
    script.onload = () => {
      const readyNode = document.getElementById('status');
      if (readyNode) {
        readyNode.textContent = 'Ready';
      }
    };
    script.onerror = () => {
      const readyNode = document.getElementById('status');
      if (readyNode) {
        readyNode.textContent = 'Game failed to load. Please refresh and try again.';
      }
    };
    document.body.appendChild(script);

    return () => {
      if (typeof window.__dominoRoyalCleanup === 'function') {
        window.__dominoRoyalCleanup('react-unmount');
      }
      script.remove();
      mountNode.replaceChildren();
    };
  }, []);

  return <div id="dominoRoyalMount" className="relative h-full w-full bg-black" />;
}
