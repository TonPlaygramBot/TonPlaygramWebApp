import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import TPCHub from './TPCHub.jsx';
const tx=vi.hoisted(()=>[{token:'TON',amount:2.5,type:'receive'},{token:'TPG',amount:100,type:'receive'}]);
vi.mock('@tonconnect/ui-react',()=>({useTonAddress:()=>''}));
vi.mock('../components/TonConnectButton.jsx',()=>({default:()=>null}));
vi.mock('../components/LinkGoogleButton.jsx',()=>({default:()=>null}));
vi.mock('../utils/telegram.js',()=>({getTelegramId:()=>1}));
vi.mock('../utils/google.js',()=>({loadGoogleProfile:()=>null}));
vi.mock('../utils/api.js',()=>({createAccount:async()=>({accountId:'test'}),getAccountTransactions:async()=>tx}));
it('renders historical native balances as GRAM without rewriting transaction data or network branding',async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div');const root=createRoot(host);
  try {
    await act(async()=>root.render(<MemoryRouter><TPCHub/></MemoryRouter>));
    expect(host.textContent).toContain('2.5 GRAM');
    expect(host.textContent).toContain('100 TPG');
    expect(host.textContent).toContain('TON Connect');
    expect(tx[0]).toEqual({token:'TON',amount:2.5,type:'receive'});
  } finally {act(()=>root.unmount());}
});
