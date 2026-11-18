/** Chain identity is explicit. There is deliberately no default network. */
const NETWORKS = Object.freeze({
  testnet: Object.freeze({name:'testnet',chain:'-3',rpc:'https://testnet.toncenter.com/api/v2/jsonRPC',explorer:'https://testnet.tonscan.org'}),
  mainnet: Object.freeze({name:'mainnet',chain:'-239',rpc:'https://toncenter.com/api/v2/jsonRPC',explorer:'https://tonscan.org'})
});
export function tonNetwork(name){if(!Object.hasOwn(NETWORKS,name))throw new Error('Explicit TON network required');return NETWORKS[name];}
export function requireTestnet(chain){if(chain!==NETWORKS.testnet.chain)throw new Error('TESTNET account required');return NETWORKS.testnet;}
export function canonicalRawAddress(value){
  if(typeof value!=='string'||!/^0:[0-9a-fA-F]{64}$/.test(value))throw new Error('A basechain raw TON address is required');
  return value.toLowerCase();
}
export function formatNanoTon(value){
  if(typeof value!=='string'||!(/^(0|[1-9][0-9]*)$/).test(value))throw new Error('Invalid nanotons');
  const nano=BigInt(value),fraction=(nano%1000000000n).toString().padStart(9,'0').replace(/0+$/,'');
  return `${nano/1000000000n}${fraction?'.'+fraction:''}`;
}
export function scopedTonStorage(storage,network){
  const prefix=`tpg:ton:${tonNetwork(network).chain}:`;
  return {getItem:async key=>storage.getItem(prefix+key),setItem:async(key,value)=>{storage.setItem(prefix+key,value);},removeItem:async key=>{storage.removeItem(prefix+key);}};
}
