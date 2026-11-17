import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { Blockchain } from '@ton/sandbox';
import { beginCell, toNano } from '@ton/core';
import { compileContracts } from './compile.mjs';
import { JettonMinter, jettonContentToCell } from '../../wrappers/JettonMinter';
import { JettonWallet } from '../../wrappers/JettonWallet';
function assertRejected(result, destination, exitCode) {
  const rejected = result.transactions.find(tx =>
    tx.inMessage?.info.type === 'internal' && tx.inMessage.info.dest.equals(destination) &&
    tx.description.type === 'generic' && tx.description.computePhase.type === 'vm' &&
    tx.description.aborted && tx.description.computePhase.exitCode === exitCode);
  assert(rejected, `Expected contract rejection with exit code ${exitCode}`);
}
let code;
before(async () => { code = await compileContracts({capped: true}); });
async function setup() {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('admin');
  const outsider = await chain.treasury('outsider');
  const content = jettonContentToCell({type: 1, uri: 'https://example.invalid/tpg-testnet.json'});
  const minter = chain.openContract(JettonMinter.createFromConfig({admin: admin.address, content, wallet_code: code.JettonWallet}, code.JettonMinter));
  await minter.sendDeploy(admin.getSender(), toNano('0.1'));
  return { chain, admin, outsider, minter, content };
}
const CAP = 10_000_000_000n * 1_000_000_000n;
test('fixed cap getter, zero initial supply and rejection of unauthorized issuance', async () => {
  const {chain, minter, admin, outsider} = await setup();
  const max = await chain.runGetMethod(minter.address, 'get_max_supply');
  assert.equal(max.stackReader.readBigNumber(), CAP);
  assert.equal(await minter.getTotalSupply(), 0n);
  assertRejected(await minter.sendMint(outsider.getSender(), outsider.address, 1n, 0n, toNano('0.1')), minter.address, 73);
  assert.equal(await minter.getTotalSupply(), 0n);
});
test('exact boundary succeeds, one base unit above fails without supply or wallet mutation', async () => {
  const {chain, minter, admin} = await setup();
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, CAP + 1n, 0n, toNano('0.1')), minter.address, 76);
  assert.equal(await minter.getTotalSupply(), 0n);
  await minter.sendMint(admin.getSender(), admin.address, CAP - 1n, 0n, toNano('0.1'));
  await minter.sendMint(admin.getSender(), admin.address, 1n, 0n, toNano('0.1'));
  const wallet = chain.openContract(JettonWallet.createFromAddress(await minter.getWalletAddress(admin.address)));
  assert.equal(await minter.getTotalSupply(), CAP);
  assert.equal(await wallet.getJettonBalance(), CAP);
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, 1n, 0n, toNano('0.1')), minter.address, 76);
  assert.equal(await minter.getTotalSupply(), CAP);
  assert.equal(await wallet.getJettonBalance(), CAP);
});
test('burn reopens only equivalent capacity (outstanding cap, not lifetime cap)', async () => {
  const {chain, minter, admin} = await setup();
  await minter.sendMint(admin.getSender(), admin.address, CAP, 0n, toNano('0.1'));
  const wallet = chain.openContract(JettonWallet.createFromAddress(await minter.getWalletAddress(admin.address)));
  await admin.send({to:wallet.address,value:toNano('0.1'),body:JettonWallet.burnMessage(50n,admin.address,null)});
  assert.equal(await minter.getTotalSupply(), CAP - 50n);
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, 51n, 0n, toNano('0.1')), minter.address, 76);
  await minter.sendMint(admin.getSender(), admin.address, 50n, 0n, toNano('0.1'));
  assert.equal(await minter.getTotalSupply(), CAP);
  assert.equal(await wallet.getJettonBalance(), CAP);
});
test('admin transfer and metadata edits cannot raise cap', async () => {
  const {minter, admin, outsider} = await setup();
  await minter.sendMint(admin.getSender(), admin.address, CAP, 0n, toNano('0.1'));
  await minter.sendChangeAdmin(admin.getSender(), outsider.address);
  await minter.sendChangeContent(outsider.getSender(), jettonContentToCell({type:1,uri:'https://example.invalid/new.json'}));
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, 1n, 0n, toNano('0.1')), minter.address, 73);
  assertRejected(await minter.sendMint(outsider.getSender(), outsider.address, 1n, 0n, toNano('0.1')), minter.address, 76);
  assert.equal(await minter.getTotalSupply(), CAP);
});
test('zero and non-transfer mint messages are rejected', async () => {
  const {minter, admin} = await setup();
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, 0n, 0n, toNano('0.1')), minter.address, 76);
  const malformed = beginCell().storeUint(0x595f07bc,32).storeUint(0,64).storeCoins(1n).endCell();
  const body = beginCell().storeUint(21,32).storeUint(0,64).storeAddress(admin.address).storeCoins(toNano('0.1')).storeRef(malformed).endCell();
  assertRejected(await admin.send({to:minter.address,value:toNano('0.2'),body}), minter.address,77);
  assert.equal(await minter.getTotalSupply(),0n);
});
