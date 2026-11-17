import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { GIFT_BY_ID } from '../../utils/nftGifts.js';
import GiftExperience from './GiftExperience.jsx';
const mock = vi.hoisted(() => ({ send: vi.fn(), sound: vi.fn() }));
vi.mock('../../utils/api.js', () => ({ sendGift: mock.send }));
vi.mock('../../utils/giftAudio.js', () => ({ prepareGiftAudio: vi.fn(), playGiftChime: mock.sound }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, container, close, complete;
const players = [{id:'bob',name:'Bob',index:1},{id:'carol',name:'Carol',index:2}];
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent.includes(text));
const render = async (list = players) => act(async () => root.render(<GiftExperience accountId="alice" players={list} onClose={close} onCompleted={complete}/>));
const select = async () => act(async () => document.querySelector('.gift-tile').click());
beforeEach(() => { sessionStorage.clear(); mock.send.mockReset();mock.sound.mockReset();mock.send.mockImplementation(async (_from,to,id,requestId)=>({requestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:id,toAccount:to,amount:-GIFT_BY_ID[id].price}}));close=vi.fn();complete=vi.fn();container=document.createElement('div');document.body.append(container);root=createRoot(container);HTMLElement.prototype.scrollTo=vi.fn(); });
afterEach(async () => {await act(async()=>root.unmount());container.remove();});
it('goes directly to explicit confirmation, sends chosen recipient once and returns to game', async () => {
  await render();await select();expect(mock.send).not.toHaveBeenCalled();
  expect(document.querySelector('.gift-order-summary').textContent).toContain('Bob');
  await act(async()=>{const select=document.querySelector('[aria-label="Gift recipient"]');select.value='carol';select.dispatchEvent(new Event('change',{bubbles:true}));});
  await act(async()=>button('Confirm ·').click());
  expect(mock.send).toHaveBeenCalledTimes(1);expect(mock.send.mock.calls[0].slice(0,2)).toEqual(['alice','carol']);
  expect(close).toHaveBeenCalledOnce();expect(complete.mock.calls[0][0]).toMatchObject({recipient:'carol',playerIndex:2});expect(mock.sound).toHaveBeenCalledOnce();
});
it('guards rapid double clicks until confirmed, without closing early', async () => {
  let resolve;mock.send.mockImplementation(()=>new Promise(r=>resolve=r));await render();await select();
  await act(async()=>{const confirm=button('Confirm ·');confirm.click();confirm.click();});
  expect(mock.send).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
  await act(async()=>resolve({requestId:mock.send.mock.calls[0][3],balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:mock.send.mock.calls[0][2],toAccount:'bob',amount:-GIFT_BY_ID[mock.send.mock.calls[0][2]].price}}));expect(complete).toHaveBeenCalledOnce();
});
it('keeps failure visible, never celebrating or auto-retrying', async () => {
  mock.send.mockRejectedValue(new Error('Offline'));await render();await select();await act(async()=>button('Confirm ·').click());
  expect(document.querySelector('[role="alert"]').textContent).toBe('Offline');expect(close).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();expect(mock.sound).not.toHaveBeenCalled();expect(button('Retry same gift request').disabled).toBe(false);
});
it('does not send with no players or a recipient who left', async () => {
  await render([]);await select();expect(button('Confirm ·').disabled).toBe(true);
  await act(async()=>button('Choose another gift').click());await render();await select();await render([players[1]]);expect(button('Confirm ·').disabled).toBe(true);expect(mock.send).not.toHaveBeenCalled();
});

it('does not celebrate an empty HTTP success body',async()=>{mock.send.mockResolvedValue({});await render();await select();await act(async()=>button('Confirm ·').click());expect(document.querySelector('[role="alert"]').textContent).toContain('could not be confirmed');expect(close).not.toHaveBeenCalled();expect(mock.sound).not.toHaveBeenCalled();});

it('retries ambiguous result with original key and no recipient edits',async()=>{
 const deliver=mock.send.getMockImplementation();mock.send.mockRejectedValueOnce(new Error('lost response')).mockImplementation(deliver);
 await render();await select();await act(async()=>button('Confirm ·').click());
 const first=mock.send.mock.calls[0];expect(document.querySelector('[aria-label="Gift recipient"]').disabled).toBe(true);expect(button('Choose another gift').disabled).toBe(true);
 await act(async()=>button('Retry same gift request').click());expect(mock.send.mock.calls[1]).toEqual(first);expect(complete).toHaveBeenCalledOnce();
});
it('restores unresolved confirmation after unmount without automatically sending',async()=>{
 mock.send.mockRejectedValue(new Error('offline'));await render();await select();await act(async()=>button('Confirm ·').click());const key=mock.send.mock.calls[0][3];
 await act(async()=>root.unmount());root=createRoot(container);await render();expect(button('Retry same gift request')).toBeDefined();expect(mock.send).toHaveBeenCalledTimes(1);
 await act(async()=>button('Retry same gift request').click());expect(mock.send.mock.calls[1][3]).toBe(key);
});

it('terminal persisted rejection unlocks recipient changes after safe recovery',async()=>{mock.send.mockRejectedValueOnce(new Error('lost response')).mockImplementation(async(_from,_to,_gift,requestId)=>({error:'insufficient balance',requestId,requestStatus:'rejected'}));await render();await select();await act(async()=>button('Confirm ·').click());await act(async()=>button('Retry same gift request').click());expect(button('Choose another gift').disabled).toBe(false);expect(document.querySelector('[aria-label="Gift recipient"]').disabled).toBe(false);expect(sessionStorage.length).toBe(0);});

it('one explicit quick-buy click sends without a separate confirmation screen',async()=>{
 await render();const buy=document.querySelector('.gift-quick-send'),preview=document.querySelector('.gift-tile');
 expect(buy.textContent).toContain('To: Bob');expect(buy.textContent).toContain('TPG');expect(buy.getAttribute('aria-label')).toContain('Buy ');expect(preview.getAttribute('aria-label')).toContain('View ');
 expect(mock.send).not.toHaveBeenCalled();await act(async()=>buy.click());
 expect(mock.send).toHaveBeenCalledTimes(1);expect(mock.send.mock.calls[0].slice(0,2)).toEqual(['alice','bob']);expect(complete).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
});
it('quick-buy shows and snapshots the selected recipient and blocks rapid duplicate taps',async()=>{
 let resolve;mock.send.mockImplementation(()=>new Promise(r=>resolve=r));await render();
 await act(async()=>{const s=document.querySelector('[aria-label="Quick gift recipient"]');s.value='carol';s.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(document.querySelector('.gift-quick-send').textContent).toContain('To: Carol');
 await act(async()=>{const b=document.querySelector('.gift-quick-send');b.click();b.click();});
 expect(mock.send).toHaveBeenCalledTimes(1);expect(document.querySelector('[aria-label="Quick gift recipient"]').disabled).toBe(true);expect(document.querySelector('.gift-tile').disabled).toBe(true);
 const [from,to,id,requestId]=mock.send.mock.calls[0];expect(to).toBe('carol');
 await act(async()=>resolve({requestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:id,toAccount:to,amount:-GIFT_BY_ID[id].price}}));expect(complete).toHaveBeenCalledOnce();
});
it('quick-buy ambiguous response locks into same-intent recovery, not another card purchase',async()=>{
 const deliver=mock.send.getMockImplementation();mock.send.mockRejectedValueOnce(new Error('response lost')).mockImplementation(deliver);await render();await act(async()=>document.querySelector('.gift-quick-send').click());const original=mock.send.mock.calls[0];
 expect(document.querySelector('.gift-quick-send')).toBeNull();expect(button('Choose another gift').disabled).toBe(true);expect(mock.sound).not.toHaveBeenCalled();
 await act(async()=>button('Retry same gift request').click());expect(mock.send.mock.calls[1]).toEqual(original);expect(complete).toHaveBeenCalledOnce();
});
it('shop quick-buy defaults visibly to own collection and sends exactly once',async()=>{
 await act(async()=>root.render(<GiftExperience accountId="alice" onClose={close} onCompleted={complete}/>));const buy=document.querySelector('.gift-quick-send');
 expect(buy.textContent).toContain('Buy for me');expect(buy.textContent).toContain('To: Your collection');await act(async()=>buy.click());
 expect(mock.send.mock.calls[0].slice(0,2)).toEqual(['alice','alice']);expect(document.querySelector('.gift-success').textContent).toContain('Your collection');expect(mock.send).toHaveBeenCalledTimes(1);
});
it('quick-buy is disabled for signed-out or unavailable recipients',async()=>{
 await act(async()=>root.render(<GiftExperience players={players} onClose={close}/>));expect(document.querySelector('.gift-quick-send').disabled).toBe(true);
 await render([]);expect(document.querySelector('.gift-quick-send').disabled).toBe(true);expect(mock.send).not.toHaveBeenCalled();
});
it('quick terminal rejection is visibly reported without success or another automatic send',async()=>{
 mock.send.mockImplementation(async(_from,_to,_gift,requestId)=>({error:'insufficient balance',requestId,requestStatus:'rejected'}));await render();await act(async()=>document.querySelector('.gift-quick-send').click());
 expect(document.querySelector('[role="alert"]').textContent).toBe('insufficient balance');expect(mock.send).toHaveBeenCalledTimes(1);expect(mock.sound).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(sessionStorage.length).toBe(0);
});
it('quick-buy storage failure is visible and never transmits',async()=>{
 await render();const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked');});
 try{await act(async()=>document.querySelector('.gift-quick-send').click());expect(document.querySelector('[role="alert"]').textContent).toContain('No gift was sent');expect(mock.send).not.toHaveBeenCalled();}finally{spy.mockRestore();}
});
it('account switch during quick-send does not celebrate or close the new account UI',async()=>{
 let resolve;mock.send.mockImplementation(()=>new Promise(r=>resolve=r));await render();await act(async()=>document.querySelector('.gift-quick-send').click());const [,to,id,requestId]=mock.send.mock.calls[0];
 await act(async()=>root.render(<GiftExperience accountId="different" players={players} onClose={close} onCompleted={complete}/>));
 await act(async()=>resolve({requestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:id,toAccount:to,amount:-GIFT_BY_ID[id].price}}));
 expect(mock.sound).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();
});
it('account-scoped unresolved request clears for B and restores for original A',async()=>{
 mock.send.mockRejectedValue(new Error('offline'));await render();await act(async()=>document.querySelector('.gift-quick-send').click());const key=mock.send.mock.calls[0][3];expect(button('Retry same gift request')).toBeDefined();
 await act(async()=>root.render(<GiftExperience accountId="other" players={players} onClose={close} onCompleted={complete}/>));expect(button('Retry same gift request')).toBeUndefined();expect(document.querySelector('.gift-quick-send').disabled).toBe(false);
 await render();expect(button('Retry same gift request')).toBeDefined();expect(mock.send).toHaveBeenCalledTimes(1);await act(async()=>button('Retry same gift request').click());expect(mock.send.mock.calls[1][3]).toBe(key);
});
it('confirmed send does not animate a recipient who left during the request',async()=>{
 let resolve;mock.send.mockImplementation(()=>new Promise(r=>resolve=r));await render();await act(async()=>document.querySelector('.gift-quick-send').click());const [,to,id,requestId]=mock.send.mock.calls[0];await render([players[1]]);
 await act(async()=>resolve({requestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:id,toAccount:to,amount:-GIFT_BY_ID[id].price}}));expect(close).toHaveBeenCalledOnce();expect(complete).not.toHaveBeenCalled();
});
