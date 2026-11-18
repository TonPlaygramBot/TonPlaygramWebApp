import React,{useEffect,useState} from 'react';
import {TESTNET_CAPABILITIES} from '../../../shared/ton/capabilities.mjs';
import {TonConnectButton,useTonWallet} from '@tonconnect/ui-react';
import {canonicalRawAddress,requireTestnet,formatNanoTon} from '../../../shared/ton/network.mjs';
export async function fetchTestnetBalance(account,signal,fetchImpl=fetch){
 requireTestnet(account?.chain);const address=canonicalRawAddress(account.address);
 const response=await fetchImpl(`/api/testnet/balance?chain=-3&address=${encodeURIComponent(address)}`,{signal,cache:'no-store'});
 if(!response.ok)throw Error('Testnet balance unavailable. Nothing has been credited.');
 const value=await response.json();
 if(value.chain!=='-3'||value.address!==address||value.paymentVerified!==false||typeof value.balanceNano!=='string')throw Error('Mismatched testnet response');
 return {...value,balanceTon:formatNanoTon(value.balanceNano)};
}
export default function TestnetLab(){
 const wallet=useTonWallet();const account=wallet?.account;
 const [result,setResult]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setResult(null);setError('');setLoading(false);
  if(!account)return()=>controller.abort();
  if(account.chain!=='-3'){setError('Wrong network. Switch your wallet to TON TESTNET.');return()=>controller.abort();}
  setLoading(true);fetchTestnetBalance(account,controller.signal).then(value=>{if(!controller.signal.aborted)setResult(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return()=>controller.abort();
 },[account?.address,account?.chain,refresh]);
 return <main><p className="badge">TESTNET ONLY · READ-ONLY</p><h1>TON testnet lab</h1><p>This is separate from your game balance and mainnet. No tokens are sold or credited here.</p><TonConnectButton/><section><h2>Connected wallet</h2><p className="address">{account?.address||'Not connected'}</p><p>Network: {account?.chain||'none'}</p>{loading&&<p role="status">Reading testnet…</p>}{error&&<p role="alert">{error}</p>}{result&&<><strong>{result.balanceTon} test TON</strong><p>Observed at {result.observedAt}. A balance is not proof of a presale payment.</p></>}<button disabled={!account||account.chain!=='-3'||loading} onClick={()=>setRefresh(n=>n+1)}>Refresh read-only balance</button></section><section><h2>Presale disabled</h2><p>No verified testnet sale/master deployment. Refund and delivery reconciliation remain unfinished. Price and allocation have not been selected.</p><button disabled>Purchase unavailable</button><p>Never enter a seed phrase or private key here. Connecting a wallet is not a payment.</p></section><section><h2>Settlement migration is not finished</h2><p>The requested game winner payments, user transfers and purchases are not enabled by this read-only lab.</p><ul>{Object.entries(TESTNET_CAPABILITIES).filter(([key])=>key!=='nativeBalance').map(([key,value])=><li key={key}><strong style={{fontSize:'1rem'}}>{key}: disabled</strong><p>{value.reason}</p></li>)}</ul></section></main>;
}
