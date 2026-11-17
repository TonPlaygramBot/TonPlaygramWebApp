import { afterEach, expect, it, vi } from 'vitest';
import { sendGift } from './api.js';
vi.mock('./nativeBridge', () => ({ getNativeBridgeHeaders: () => ({}) }));
vi.mock('./google.js', () => ({ loadGoogleCredential: () => '' }));
afterEach(()=>vi.unstubAllGlobals());
it.each(['network',502,429])('gift POST never auto-retries %s',async failure=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  if(failure==='network')fetch.mockRejectedValue(new Error('offline'));
  else fetch.mockResolvedValue({ok:false,status:failure,headers:{get:()=> '0'},text:async()=>JSON.stringify({error:'unknown'})});
  const result=await sendGift('alice','bob','fireworks');expect(fetch).toHaveBeenCalledTimes(1);expect(result.error).toContain('Check your inventory and balance');
});
