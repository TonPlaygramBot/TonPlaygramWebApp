import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import SnakeAndLadder from '../pages/Games/SnakeAndLadder.jsx';
import '../index.css';

// Exercise the actual game, human assets, camera and turn flow in a portrait frame.
const params = new URLSearchParams(window.location.search);
if (!params.has('table')) {
  params.set('ai', params.get('ai') || '1');
  window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
}
createRoot(document.getElementById('root')!).render(<BrowserRouter><SnakeAndLadder /></BrowserRouter>);
