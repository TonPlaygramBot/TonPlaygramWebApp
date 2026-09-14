import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import MurlanRoyaleArena from '../pages/Games/MurlanRoyaleArena.jsx';
import '../index.css';

// Exercise the production arena directly without requiring Telegram sign-in.
// All card meshes, character animations, rules, sounds, and UI remain shared.
const search = window.location.search || '?players=4&username=You&flags=0,1,2';
const exposeSceneForReview = (scene: unknown) => {
  (window as Window & { __murlanPreview?: unknown }).__murlanPreview = scene;
  // Optional software-rendering profile for screenshots in headless CI.
  // Changes only drawing-buffer resolution; camera and world transforms stay exact.
  if (new URLSearchParams(window.location.search).get('qaLowRes') === '1') {
    const store = scene as { renderer: { setPixelRatio: (ratio: number) => void; setSize: (width: number, height: number, updateStyle: boolean) => void } };
    store.renderer.setPixelRatio(0.7);
    store.renderer.setSize(window.innerWidth, window.innerHeight, false);
    window.setTimeout(() => { window.requestAnimationFrame = () => 0; }, 3500);
  }
};
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <MurlanRoyaleArena search={search} onSceneReady={exposeSceneForReview} />
  </BrowserRouter>
);
