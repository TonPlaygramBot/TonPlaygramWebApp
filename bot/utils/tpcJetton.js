import { Address, toNano, beginCell } from '@ton/core';
import { JettonMinter } from '../../wrappers/JettonMinter.ts';
import { JettonWallet } from '../../wrappers/JettonWallet.ts';

/**
 * Get TPC balance of the provided address.
 * @param {TonClient} client TON client instance
 * @param {string} minterAddress Jetton minter address
 * @param {string} ownerAddress Wallet address to check
 */
export async function getTpcBalance(client, minterAddress, ownerAddress) {
  const master = client.open(JettonMinter.createFromAddress(Address.parse(minterAddress)));
  const walletAddr = await master.getWalletAddress(Address.parse(ownerAddress));
  const wallet = client.open(JettonWallet.createFromAddress(walletAddr));
  return await wallet.getJettonBalance(client.provider(wallet.address));
}

/**
 * Send TPC tokens
 */
export async function sendTpc(client, minterAddress, sender, toAddress, amount) {
  const master = client.open(JettonMinter.createFromAddress(Address.parse(minterAddress)));
  const walletAddr = await master.getWalletAddress(sender.address);
  const wallet = client.open(JettonWallet.createFromAddress(walletAddr));
  await wallet.sendTransfer(client.provider(wallet.address), sender, toNano('0.05'), amount, Address.parse(toAddress), sender.address, beginCell().endCell(), toNano('0.02'), beginCell().endCell());
}

/**
 * Show transaction history for provided address
 */
export async function getTpcHistory(client, address, limit = 10) {
  return await client.getTransactions(Address.parse(address), { limit });
}
