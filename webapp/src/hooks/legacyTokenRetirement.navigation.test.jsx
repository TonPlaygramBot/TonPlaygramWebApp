import React,{act} from 'react';
import{createRoot}from'react-dom/client';
import{it,expect,vi}from'vitest';
import useTokenBalances from './useTokenBalances.js';
import useWalletUsdValue from './useWalletUsdValue.js';
vi.mock('@tonconnect/ui-react',()=>({useTonAddress:()=> 'fixture-wallet'}));
vi.mock('../utils/telegram.js',()=>({getTelegramId:()=>123}));
vi.mock('../utils/google.js',()=>({loadGoogleProfile:()=>null}));
vi.mock('../utils/api.js',()=>({createAccount:vi.fn(async()=>({accountId:'fixture'})),getAccountBalance:vi.fn(async()=>({balance:777})),getTonBalance:vi.fn(async()=>({balance:2}))}));
it('preserves DB balance, queries TON only and leaves retired external token unavailable',async()=>{
 globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 const fetcher=vi.fn(async url=>({ok:true,json:async()=>url.includes('/rates?')?{rates:{TON:{prices:{USD:3}}}}:{balance:2e9}}));vi.stubGlobal('fetch',fetcher);
 let value;function Probe(){const balance=useTokenBalances();const usd=useWalletUsdValue(balance.tonBalance,999999);value={...balance,usd};return null;}
 const host=document.createElement('div'),root=createRoot(host);
 try{await act(async()=>{root.render(<Probe/>);});await act(async()=>{await new Promise(r=>setTimeout(r,0));});
 expect(value.tpcBalance).toBe(777);expect(value.tonBalance).toBe(2);expect(value.tpcWalletBalance).toBeNull();expect(value.externalTpgStatus).toBe('unavailable');expect(value.usd).toBe(6);
 expect(fetcher.mock.calls.every(([url])=>!url.includes('jettons')&&!url.includes('dedust')&&!url.includes('EQDY3'))).toBe(true);
 }finally{await act(async()=>root.unmount());vi.unstubAllGlobals();}
});
