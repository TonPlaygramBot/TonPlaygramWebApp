import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import Exchange from './Exchange.jsx';
import { getExchangeConversionQuote, getExchangeCoinDetails } from '../utils/api.js';
vi.mock('../utils/api.js', () => ({
  getExchangeMarkets: vi.fn(async()=>({markets:[{id:'gram-2',symbol:'GRAM',name:'Separate Gram jetton'}]})),
  getExchangeConversionQuote: vi.fn(async()=>({fromSymbol:'TON',amount:'2.5',usdValue:3,estimatedTpc:30})),
  getExchangeCoinDetails: vi.fn(async()=>({coin:{id:'gram-2',symbol:'GRAM',name:'Separate Gram jetton'}}))
}));
it('displays native GRAM, quotes legacy TON without changing amount, keeps jetton market ID', async()=>{
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  const host=document.createElement('div'); document.body.append(host);
  const root=createRoot(host);
  try {
    await act(async()=>root.render(<Exchange/>));
    const [symbol,amount]=host.querySelectorAll('input');
    expect(symbol.value).toBe('GRAM');
    const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    await act(async()=>{set.call(symbol,'BTC');symbol.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>{set.call(symbol,'GRAM');symbol.dispatchEvent(new Event('input',{bubbles:true}));set.call(amount,'2.5');amount.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Quote').click());
    expect(getExchangeConversionQuote).toHaveBeenCalledWith('TON','2.5');
    expect(host.textContent).toContain('Pair: GRAM');
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent.includes('Separate Gram jetton')).click());
    expect(getExchangeCoinDetails).toHaveBeenCalledWith('gram-2');
    expect(host.textContent).toContain('Separate Gram jetton (GRAM)');
  } finally {act(()=>root.unmount());host.remove();}
});
