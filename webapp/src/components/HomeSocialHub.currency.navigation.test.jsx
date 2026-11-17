import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import HomeSocialHub from './HomeSocialHub.jsx';
vi.mock('../utils/socket.js',()=>({socket:{on:vi.fn(),off:vi.fn(),emit:vi.fn()}}));
vi.mock('../utils/telegram.js',()=>({getTelegramId:()=>1}));
vi.mock('./LoginOptions.jsx',()=>({default:()=>null}));
it('renders legacy TON invite as GRAM while preserving stored token and accept link',()=>{
  const invite={fromId:2,fromName:'Friend',roomId:'room-test',game:'snake',amount:0.5,token:'TON'};
  const stored=JSON.stringify([invite]);localStorage.setItem('tonplaygram-game-invites',stored);
  try {
    const html=renderToStaticMarkup(<MemoryRouter><HomeSocialHub/></MemoryRouter>);
    expect(html).toContain('GRAM');
    expect(html).toContain('token=TON');
    expect(localStorage.getItem('tonplaygram-game-invites')).toBe(stored);
  } finally {localStorage.removeItem('tonplaygram-game-invites');}
});
