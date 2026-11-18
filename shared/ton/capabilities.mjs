/** Honest release boundary. No mutation is enabled by an environment flag. */
export const TESTNET_CAPABILITIES = Object.freeze({
 nativeBalance: Object.freeze({enabled:true,mode:'read-only'}),
 presale: Object.freeze({enabled:false,reason:'No verified sale deployment or complete refund protocol'}),
 peerTransfer: Object.freeze({enabled:false,reason:'No signing flow or canonical delivery verifier integrated'}),
 winnerPayout: Object.freeze({enabled:false,reason:'Game-authoritative outcomes, funded escrow and settlement verifier are not integrated'}),
 storePurchase: Object.freeze({enabled:false,reason:'Merchant invoice, payment proof and entitlement fulfillment are not integrated'})
});
export function requireEnabledTestnetCapability(kind){
 const capability=TESTNET_CAPABILITIES[kind];
 if(!capability?.enabled)throw new Error(`Testnet ${kind} unavailable: ${capability?.reason||'unknown capability'}`);
 return capability;
}
