import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import tonClaim from '../bot/utils/tonClaim.js';
import{STORE_ADDRESS}from'../webapp/src/utils/storeData.js';
import{PTONTPC_LP_TOKEN}from'../webapp/src/utils/lpToken.js';
test('retired signer always rejects without a configured replacement',async()=>{await assert.rejects(tonClaim('fixture',100),{code:'legacy_token_retired'});assert.equal(STORE_ADDRESS,null);assert.equal(PTONTPC_LP_TOKEN.address,null);assert.equal(PTONTPC_LP_TOKEN.enabled,false);});
test('functional sources no longer reference retired token or claim import advice',async()=>{for(const p of ['bot/routes/wallet.js','bot/utils/tonClaim.js','webapp/src/hooks/useTokenBalances.js','webapp/src/hooks/useWalletUsdValue.js']){const s=await readFile(new URL('../'+p,import.meta.url),'utf8');assert.ok(!s.includes('EQDY3qbfGN6IMI5d4MsEoprhuMTz09OkqjyhPKX6DVtzbi6X'));assert.ok(!s.includes('TPC_JETTON_ADDRESS'));}});
