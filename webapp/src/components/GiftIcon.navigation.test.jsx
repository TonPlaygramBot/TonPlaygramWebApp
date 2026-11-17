import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect} from 'vitest';
import GiftIcon from './GiftIcon.jsx';
import {NFT_GIFTS} from '../utils/nftGifts.js';
import {giftFallbackUrl} from './gifts/giftArtwork.js';
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
it('canonical and emoji images preserve layout/accessibility/lazy props and fall back safely',async()=>{
 const c=document.createElement('div');document.body.append(c);const root=createRoot(c),g=NFT_GIFTS[0];
 await act(async()=>root.render(<><GiftIcon gift={g} alt="Preview" className="size-12"/><GiftIcon icon={g.icon}/><GiftIcon icon="/custom.png"/><GiftIcon icon="?" alt="Unknown"/></>));
 const [i,j,k]=c.querySelectorAll('img');
 expect(i.getAttribute('src')).toBe('/assets/gifts/tpg/'+g.id+'.webp');expect(i.alt).toBe('Preview');expect(i.getAttribute('loading')).toBe('lazy');expect(i.getAttribute('decoding')).toBe('async');expect(i.className).toContain('size-12');
 expect(j.getAttribute('src')).toBe(i.getAttribute('src'));expect(k.getAttribute('src')).toBe('/custom.png');expect(c.querySelector('span').textContent).toBe('?');
 await act(async()=>i.dispatchEvent(new Event('error')));expect(i.getAttribute('src')).toBe(giftFallbackUrl(g));await act(async()=>i.dispatchEvent(new Event('error')));expect(i.getAttribute('src')).toBe(giftFallbackUrl(g));
 await act(async()=>root.unmount());c.remove();
});
