import {canonicalRawAddress,formatNanoTon,requireTestnet} from '../../shared/ton/network.mjs';
/** Read-only transport, fixed testnet destination. Never accepts an RPC URL or key from a request. */
export function createTestnetReader({fetchImpl=globalThis.fetch,timeoutMs=8000}={}){
 return async function readBalance({chain,address}){
  const network=requireTestnet(chain);const canonical=canonicalRawAddress(address);
  const response=await fetchImpl(network.rpc,{method:'POST',headers:{'content-type':'application/json'},redirect:'error',signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify({jsonrpc:'2.0',id:'testnet-balance',method:'getAddressBalance',params:{address:canonical}})});
  if(!response.ok)throw Error('Testnet provider unavailable');
  const data=await response.json();if(data.error||data.ok===false||typeof data.result!=='string')throw Error('Invalid testnet provider response');
  const formatted=formatNanoTon(data.result);
  return {network:'testnet',chain:network.chain,address:canonical,balanceNano:data.result,balanceTon:formatted,source:'testnet.toncenter.com',paymentVerified:false,observedAt:new Date().toISOString()};
 };
}
