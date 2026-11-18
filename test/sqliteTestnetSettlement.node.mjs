import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createTestnetSettlement } from '../bot/settlement/testnetSettlement.mjs';
import { openSqliteTestnetRepository } from '../bot/settlement/sqliteTestnetRepository.mjs';
const moduleURL = new URL('../bot/settlement/sqliteTestnetRepository.mjs', import.meta.url).href;
const domainURL = new URL('../bot/settlement/testnetSettlement.mjs', import.meta.url).href;
const input = { network:'testnet', kind:'purchase', asset:'native',source:`0:${'a'.repeat(64)}`,destination:`0:${'b'.repeat(64)}`,amountBaseUnits:'100',reference:'order1',idempotencyKey:'purchase:order1' };
const h = 'c'.repeat(64);
const verifier = async row => ({ ...row.payload, intentId:row.id, submissionHash:row.submissionHash, finalized:true, delivered:true, recipientTransactionSucceeded:true,transactionHash:h,messageHash:h });
function fixture(t) { const dir=mkdtempSync(join(tmpdir(),'ton-durable-')); t.after(()=>rmSync(dir,{recursive:true,force:true})); return { filename:join(dir,'settlement.testnet.sqlite'),network:'testnet',purpose:'isolated-testnet-settlement' }; }
function child(code) { return new Promise((resolve,reject)=>{ const p=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe']}); let out='',err='';p.stdout.on('data',x=>out+=x);p.stderr.on('data',x=>err+=x);p.on('error',reject);p.on('exit',c=>c===0?resolve(out):reject(new Error(err||`exit ${c}`))); }); }
test('durable restart preserves confirmed intent and idempotency',async t=>{
 const config=fixture(t);let repo=openSqliteTestnetRepository(config);let svc=createTestnetSettlement({repository:repo,verifier});const row=await svc.createIntent(input);await svc.markSubmitted(row.id,h);await svc.reconcile(row.id);repo.close();
 repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());svc=createTestnetSettlement({repository:repo,verifier});assert.equal((await svc.createIntent(input)).status,'confirmed');assert.equal((await svc.reconcile(row.id)).revision,2);await assert.rejects(svc.createIntent({...input,amountBaseUnits:'101'}),/idempotency conflict/);
});
test('process exit after submission recovers pending delivery without duplicate intent',async t=>{
 const config=fixture(t);const result=await child(`import {openSqliteTestnetRepository as open} from '${moduleURL}';import {createTestnetSettlement as create} from '${domainURL}';const repo=open(${JSON.stringify(config)});const svc=create({repository:repo,verifier:async()=>null});const row=await svc.createIntent(${JSON.stringify(input)});await svc.markSubmitted(row.id,'${h}');console.log(row.id);process.exit(0);`);
 const repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());const svc=createTestnetSettlement({repository:repo,verifier});const id=result.trim();assert.equal((await svc.createIntent(input)).id,id);assert.equal((await repo.get(id)).status,'submitted');assert.equal((await svc.reconcile(id)).status,'confirmed');
});
test('concurrent processes deduplicate intent and receipt confirmation atomically',async t=>{
 const config=fixture(t);const repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());const script=`import {openSqliteTestnetRepository as open} from '${moduleURL}';import {createTestnetSettlement as create} from '${domainURL}';const repo=open(${JSON.stringify(config)});const svc=create({repository:repo,verifier:async()=>null});console.log((await svc.createIntent(${JSON.stringify(input)})).id);repo.close();`;
 const ids=await Promise.all(Array.from({length:8},()=>child(script)));assert.equal(new Set(ids).size,1);
 const svc=createTestnetSettlement({repository:repo,verifier});const one=await svc.createIntent(input);const two=await svc.createIntent({...input,idempotencyKey:'purchase:2'});await svc.markSubmitted(one.id,h);await svc.markSubmitted(two.id,h);await svc.reconcile(one.id);await assert.rejects(svc.reconcile(two.id),/UNIQUE/);assert.equal((await repo.get(two.id)).status,'submitted');
});
test('stale writes, bypass confirmation and unsafe configuration fail closed',async t=>{
 const config=fixture(t);assert.throws(()=>openSqliteTestnetRepository({...config,network:'mainnet'}));assert.throws(()=>openSqliteTestnetRepository({...config,filename:':memory:'}));const repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());const svc=createTestnetSettlement({repository:repo,verifier});const row=await svc.createIntent(input);await assert.rejects(repo.compareAndSwap(row.id,0,{status:'confirmed'}),/invalid transition/);await assert.rejects(repo.confirmUnique(row.id,0,h,{transactionHash:h,messageHash:h}),/conflict/);await svc.markSubmitted(row.id,h);await assert.rejects(repo.compareAndSwap(row.id,0,{status:'reconciliation_required'}),/conflict/);
});

test('SIGKILL after durable submit recovers without clean close',async t=>{
 const config=fixture(t);const code=`import {openSqliteTestnetRepository as open} from '${moduleURL}';import {createTestnetSettlement as create} from '${domainURL}';const repo=open(${JSON.stringify(config)});const svc=create({repository:repo,verifier:async()=>null});const row=await svc.createIntent(${JSON.stringify(input)});await svc.markSubmitted(row.id,'${h}');console.log(row.id);setInterval(()=>{},1000);`;
 const id=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,['--input-type=module','-e',code],{stdio:['ignore','pipe','pipe']});let out='';p.stdout.on('data',x=>{out+=x;if(out.includes('\n'))p.kill('SIGKILL');});p.on('error',reject);p.on('exit',(_c,signal)=>signal==='SIGKILL'?resolve(out.trim()):reject(new Error('unexpected exit')));});
 const repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());assert.equal((await repo.get(id)).status,'submitted');const svc=createTestnetSettlement({repository:repo,verifier});assert.equal((await svc.reconcile(id)).status,'confirmed');
});
test('two processes race for one receipt; only one confirmation survives',async t=>{
 const config=fixture(t);const repo=openSqliteTestnetRepository(config);t.after(()=>repo.close());const svc=createTestnetSettlement({repository:repo,verifier});const rows=await Promise.all(['a','b'].map(id=>svc.createIntent({...input,idempotencyKey:id})));for(const row of rows)await svc.markSubmitted(row.id,h);
 const results=await Promise.all(rows.map(row=>child(`import {openSqliteTestnetRepository as open} from '${moduleURL}';const repo=open(${JSON.stringify(config)});try {await repo.confirmUnique('${row.id}',1,'${h}',{transactionHash:'${h}',messageHash:'${h}'});console.log('confirmed');} catch(e) {if(!e.message.includes('UNIQUE'))throw e;console.log('conflict');}repo.close();`)));assert.deepEqual(results.map(x=>x.trim()).sort(),['confirmed','conflict']);
});
test('existing unrelated or mainnet database is refused',t=>{
 const config=fixture(t);const db=new DatabaseSync(config.filename);db.exec('CREATE TABLE user_balances (id TEXT)');db.close();assert.throws(()=>openSqliteTestnetRepository(config),/unrelated/);
});
test('mainnet metadata refused before schema mutation',t=>{
 const config=fixture(t);const db=new DatabaseSync(config.filename);db.exec("CREATE TABLE settlement_meta (id INTEGER PRIMARY KEY,network TEXT,version INTEGER); INSERT INTO settlement_meta VALUES(1,'mainnet',1)");db.close();assert.throws(()=>openSqliteTestnetRepository(config),/incompatible/);const check=new DatabaseSync(config.filename);assert.equal(check.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='settlement_intents'").get().n,0);check.close();
});
