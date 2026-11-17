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
before(async () => { code = await compileContracts(); });
async function setup() {
  const chain = await Blockchain.create();
  const admin = await chain.treasury('admin');
  const outsider = await chain.treasury('outsider');
  const content = jettonContentToCell({type: 1, uri: 'https://example.invalid/tpg-testnet.json'});
  const minter = chain.openContract(JettonMinter.createFromConfig({admin: admin.address, content, wallet_code: code.JettonWallet}, code.JettonMinter));
  await minter.sendDeploy(admin.getSender(), toNano('0.1'));
  return { chain, admin, outsider, minter, content };
}
test('compiles real contracts and deploys with zero supply in local emulator', async () => {
  const { minter, admin, content } = await setup();
  const data = await minter.getJettonData();
  assert.equal(data.totalSupply, 0n);
  assert.equal(data.mintable, true); // Existing contract is NOT capped.
  assert(data.adminAddress.equals(admin.address));
  assert(data.content.equals(content));
});
test('admin mints fixture units to a derived wallet; outsider cannot mint', async () => {
  const { chain, minter, admin, outsider } = await setup();
  assertRejected(await minter.sendMint(outsider.getSender(), outsider.address, 900n, 0n, toNano('0.1')), minter.address, 73);
  assert.equal(await minter.getTotalSupply(), 0n);
  await minter.sendMint(admin.getSender(), admin.address, 1000n, 0n, toNano('0.1'));
  assert.equal(await minter.getTotalSupply(), 1000n);
  const wallet = chain.openContract(JettonWallet.createFromAddress(await minter.getWalletAddress(admin.address)));
  assert.equal(await wallet.getJettonBalance(), 1000n);
});
test('owner transfers and burns; outsider cannot debit wallet', async () => {
  const { chain, minter, admin, outsider } = await setup();
  await minter.sendMint(admin.getSender(), admin.address, 1000n, 0n, toNano('0.1'));
  const wallet = chain.openContract(JettonWallet.createFromAddress(await minter.getWalletAddress(admin.address)));
  const body = JettonWallet.transferMessage(100n, outsider.address, admin.address, null, 0n, null);
  assertRejected(await outsider.send({to: wallet.address, value: toNano('0.1'), body}), wallet.address, 705);
  assert.equal(await wallet.getJettonBalance(), 1000n);
  await admin.send({to: wallet.address, value: toNano('0.1'), body});
  assert.equal(await wallet.getJettonBalance(), 900n);
  const receiver = chain.openContract(JettonWallet.createFromAddress(await minter.getWalletAddress(outsider.address)));
  assert.equal(await receiver.getJettonBalance(), 100n);
  await admin.send({to: wallet.address, value: toNano('0.1'), body: JettonWallet.burnMessage(50n, admin.address, null)});
  assert.equal(await wallet.getJettonBalance(), 850n);
  assert.equal(await minter.getTotalSupply(), 950n);
});
test('only admin can change metadata/admin; ownership transfer removes old authority', async () => {
  const { minter, admin, outsider, content } = await setup();
  const replacement = jettonContentToCell({type: 1, uri: 'https://example.invalid/updated.json'});
  assertRejected(await minter.sendChangeContent(outsider.getSender(), replacement), minter.address, 73);
  assertRejected(await minter.sendChangeAdmin(outsider.getSender(), outsider.address), minter.address, 73);
  assert((await minter.getContent()).equals(content));
  assert((await minter.getAdminAddress()).equals(admin.address));
  await minter.sendChangeContent(admin.getSender(), replacement);
  assert((await minter.getContent()).equals(replacement));
  await minter.sendChangeAdmin(admin.getSender(), outsider.address);
  assertRejected(await minter.sendMint(admin.getSender(), admin.address, 100n, 0n, toNano('0.1')), minter.address, 73);
  assert.equal(await minter.getTotalSupply(), 0n);
  await minter.sendMint(outsider.getSender(), outsider.address, 100n, 0n, toNano('0.1'));
  assert.equal(await minter.getTotalSupply(), 100n);
});
test('forged burn notification cannot reduce total supply', async () => {
  const { minter, admin, outsider } = await setup();
  await minter.sendMint(admin.getSender(), admin.address, 1000n, 0n, toNano('0.1'));
  assertRejected(await outsider.send({to: minter.address, value: toNano('0.1'), body: beginCell().storeUint(0x7bdd97de,32).storeUint(0,64).storeCoins(100n).storeAddress(admin.address).storeAddress(outsider.address).endCell()}), minter.address, 74);
  assert.equal(await minter.getTotalSupply(), 1000n);
});
