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
