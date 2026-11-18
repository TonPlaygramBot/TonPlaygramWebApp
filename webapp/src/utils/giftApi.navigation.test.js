import { afterEach, expect, it, vi } from 'vitest';
import { sendGift, get, put } from './api.js';
vi.mock('./nativeBridge', () => ({ getNativeBridgeHeaders: () => ({}) }));
vi.mock('./google.js', () => ({ loadGoogleCredential: () => '' }));
afterEach(()=>vi.unstubAllGlobals());
it.each(['network',502,429])('gift POST never auto-retries %s',async failure=>{
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  if(failure==='network')fetch.mockRejectedValue(new Error('offline'));
  else fetch.mockResolvedValue({ok:false,status:failure,headers:{get:()=> '0'},text:async()=>JSON.stringify({error:'unknown'})});
  const result=await sendGift('alice','bob','fireworks');expect(fetch).toHaveBeenCalledTimes(1);expect(result.error).toContain('Retry the same gift request');
});

it('sends request ID and preserves structured gift error fields',async()=>{const requestId='11111111-1111-4111-8111-111111111111';const fetch=vi.fn().mockResolvedValue({ok:false,status:409,text:async()=>JSON.stringify({error:'conflict',code:'REQUEST_CONFLICT',requestId,rejected:false})});vi.stubGlobal('fetch',fetch);const result=await sendGift('a','b','fireworks',requestId);expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({requestId});expect(result).toMatchObject({code:'REQUEST_CONFLICT',requestId,rejected:false});});

it.each([['GET',()=>get('/api/example')],['PUT',()=>put('/api/example',{value:1})]])('%s HTTP400 returns normal API error without gift-only option leakage',async(_method,request)=>{
 const fetch=vi.fn().mockResolvedValue({ok:false,status:400,statusText:'Bad Request',text:async()=>JSON.stringify({error:'invalid input',code:'UNRELATED'})});vi.stubGlobal('fetch',fetch);
 await expect(request()).resolves.toEqual({error:'invalid input'});expect(fetch).toHaveBeenCalledTimes(1);
});
it('uses only versioned purchase URL so mixed fleets cannot hit unsafe legacy handler',async()=>{const fetch=vi.fn().mockResolvedValue({ok:false,status:404,text:async()=>JSON.stringify({error:'not found'})});vi.stubGlobal('fetch',fetch);await sendGift('alice','bob','fireworks','11111111-1111-4111-8111-111111111111');expect(fetch).toHaveBeenCalledTimes(1);expect(fetch.mock.calls[0][0]).toMatch(/\/api\/account\/gift\/v2$/);});
