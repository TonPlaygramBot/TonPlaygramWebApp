import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
import GiftPopup from './GiftPopup.jsx';
import {GIFT_BY_ID} from '../utils/nftGifts.js';
const mock=vi.hoisted(()=>({session:vi.fn(),send:vi.fn()}));
vi.mock('../utils/api.js',()=>({getGiftSession:mock.session,sendGift:mock.send}));
vi.mock('../utils/giftAudio.js',()=>({prepareGiftAudio:vi.fn(),playGiftChime:vi.fn()}));
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
let root,c,close,sent;
beforeEach(()=>{sessionStorage.clear();mock.session.mockReset().mockResolvedValue({accountId:'alice',purchasingEnabled:true,giftProtocol:2});mock.send.mockReset().mockImplementation(async(from,to,id,requestId)=>({requestId,balance:1000,transaction:{type:'gift',token:'TPG',status:'delivered',toAccount:to,detail:id,amount:-GIFT_BY_ID[id].price}}));c=document.createElement('div');document.body.append(c);root=createRoot(c);close=vi.fn();sent=vi.fn();});
afterEach(async()=>{await act(async()=>root.unmount());c.remove();});
const render=()=>act(async()=>root.render(<GiftPopup open players={[{id:'bob',name:'Bob',index:2}]} onClose={close} onGiftSent={sent}/>));
it('real game launcher resolves signed account and allows one quick send',async()=>{await render();expect(mock.session).toHaveBeenCalledOnce();const buy=document.querySelector('.gift-quick-send');expect(buy.disabled).toBe(false);await act(async()=>buy.click());expect(mock.send.mock.calls[0].slice(0,2)).toEqual(['alice','bob']);expect(sent).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();});
it('unverified or provider-blocked session stays disabled with visible reason',async()=>{mock.session.mockResolvedValue({error:'Sign in again',purchasingEnabled:false});await render();expect(document.querySelector('.gift-quick-send').disabled).toBe(true);expect(document.body.textContent).toContain('Sign in again');expect(mock.send).not.toHaveBeenCalled();});
it('auth changes invalidate launcher account before re-verification',async()=>{await render();let resolve;mock.session.mockImplementation(()=>new Promise(r=>resolve=r));await act(async()=>window.dispatchEvent(new Event('social-auth-changed')));expect(document.querySelector('.gift-quick-send').disabled).toBe(true);await act(async()=>resolve({accountId:'carol',purchasingEnabled:true,giftProtocol:2}));await act(async()=>document.querySelector('.gift-quick-send').click());expect(mock.send.mock.calls[0][0]).toBe('carol');});
it('all same-tab identity events invalidate the verified account',async()=>{
 await render();let resolve;
 for(const event of ['telegramAuthUpdated','accountUpdated','googleProfileUpdated']){
 mock.session.mockImplementation(()=>new Promise(r=>resolve=r));
 await act(async()=>window.dispatchEvent(new Event(event)));expect(document.querySelector('.gift-quick-send').disabled).toBe(true);
 await act(async()=>resolve({accountId:'alice',purchasingEnabled:true,giftProtocol:2}));expect(document.querySelector('.gift-quick-send').disabled).toBe(false);
 }
});
it('overlapping session checks cannot restore a stale account',async()=>{
 const resolves=[];mock.session.mockImplementation(()=>new Promise(r=>resolves.push(r)));await render();
 await act(async()=>window.dispatchEvent(new Event('accountUpdated')));
 await act(async()=>resolves[1]({accountId:'carol',purchasingEnabled:true,giftProtocol:2}));
 await act(async()=>resolves[0]({accountId:'alice',purchasingEnabled:true,giftProtocol:2}));
 await act(async()=>document.querySelector('.gift-quick-send').click());expect(mock.send.mock.calls[0][0]).toBe('carol');
});
it('old or unknown gift protocol cannot enable the launcher',async()=>{mock.session.mockResolvedValue({accountId:'alice',purchasingEnabled:true});await render();expect(document.querySelector('.gift-quick-send').disabled).toBe(true);expect(mock.send).not.toHaveBeenCalled();});
