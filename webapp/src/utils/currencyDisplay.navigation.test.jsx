import { walletCurrencyLabel } from '../../../frontend/src/wallets/balance/currencyDisplay.ts';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { currencyLabel, nativeMarketDisplay, GRAM_ICON } from './currencyDisplay.js';
import RoomSelector from '../components/RoomSelector.jsx';

describe('native currency rebrand display only', () => {
  it('maps legacy native display while retaining other tokens', () => {
    expect(currencyLabel('TON')).toBe('GRAM');
    expect(currencyLabel('ton')).toBe('GRAM');
    expect(currencyLabel('TPG')).toBe('TPG');
    expect(currencyLabel('USDT')).toBe('USDT');
  });
  it('uses the official badge for native rooms', () => {
    const html = renderToStaticMarkup(<RoomSelector selected={{token:'TON', amount:0.1}} onSelect={()=>{}} tokens={['TON']} />);
    expect(html).toContain(GRAM_ICON);
    expect(html).toContain('alt="GRAM"');
    expect(html).not.toContain('TON.webp');
  });
  it('keeps the legacy TON key and amount in selections', () => {
    const select=vi.fn();
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const host=document.createElement('div');
    const root=createRoot(host);
    act(()=>root.render(<RoomSelector selected={{token:'TON',amount:0.1}} onSelect={select} tokens={['TON']} />));
    act(()=>host.querySelector('button').click());
    expect(select).toHaveBeenCalledWith({token:'TON',amount:0.1});
    act(()=>root.unmount());
  });
  it('does not mutate quotes or mistake a separate GRAM jetton for native currency', () => {
    const native={id:'the-open-network', symbol:'TON', name:'Toncoin', currentPriceUsd:1.03};
    expect(nativeMarketDisplay(native)).toEqual({...native,symbol:'GRAM',name:'Gram',image:GRAM_ICON});
    expect(native.symbol).toBe('TON');
    const jetton={id:'gram-2',symbol:'GRAM',name:'Gram jetton'};
    expect(nativeMarketDisplay(jetton)).toBe(jetton);
  });
});

it('keeps multichain native wallet currency identity separate from TON network', () => {
 expect(walletCurrencyLabel('ton','TON')).toBe('GRAM');
 expect(walletCurrencyLabel('solana','SOL')).toBe('SOL');
 expect(walletCurrencyLabel('evm','TON')).toBe('TON');
});
