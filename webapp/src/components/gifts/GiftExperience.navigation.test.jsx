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
beforeEach(() => { mock.send.mockReset();mock.sound.mockReset();mock.send.mockImplementation(async (_from,to,id)=>({balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:id,toAccount:to,amount:-GIFT_BY_ID[id].price}}));close=vi.fn();complete=vi.fn();container=document.createElement('div');document.body.append(container);root=createRoot(container);HTMLElement.prototype.scrollTo=vi.fn(); });
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
  await act(async()=>resolve({balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',detail:mock.send.mock.calls[0][2],toAccount:'bob',amount:-GIFT_BY_ID[mock.send.mock.calls[0][2]].price}}));expect(complete).toHaveBeenCalledOnce();
});
it('keeps failure visible, never celebrating or auto-retrying', async () => {
  mock.send.mockRejectedValue(new Error('Offline'));await render();await select();await act(async()=>button('Confirm ·').click());
  expect(document.querySelector('[role="alert"]').textContent).toBe('Offline');expect(close).not.toHaveBeenCalled();expect(complete).not.toHaveBeenCalled();expect(mock.sound).not.toHaveBeenCalled();expect(button('Confirm ·').disabled).toBe(true);
});
it('does not send with no players or a recipient who left', async () => {
  await render([]);await select();expect(button('Confirm ·').disabled).toBe(true);
  await act(async()=>button('Choose another gift').click());await render();await select();await render([players[1]]);expect(button('Confirm ·').disabled).toBe(true);expect(mock.send).not.toHaveBeenCalled();
});

it('does not celebrate an empty HTTP success body',async()=>{mock.send.mockResolvedValue({});await render();await select();await act(async()=>button('Confirm ·').click());expect(document.querySelector('[role="alert"]').textContent).toContain('could not be confirmed');expect(close).not.toHaveBeenCalled();expect(mock.sound).not.toHaveBeenCalled();});
