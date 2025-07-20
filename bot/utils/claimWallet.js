import { mnemonicToWalletKey } from 'ton-crypto';
import { TonClient4, WalletContractV4 } from 'ton';
import { Address, beginCell, toNano } from '@ton/core';

export async function sendClaim(toAddress, amount) {
  const mnemonic = process.env.TPC_CLAIM_MNEMONIC;
  const endpoint = process.env.CLAIM_RPC_URL;
  const walletAddr = process.env.TPC_CLAIM_WALLET_ADDRESS;
  if (!mnemonic || !endpoint || !walletAddr) {
    throw new Error('claim wallet credentials not set');
  }
  const keyPair = await mnemonicToWalletKey(mnemonic.trim().split(/\s+/));
  const client = new TonClient4({ endpoint });
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);
  const jettonWallet = Address.parse(walletAddr);
  const jettonAmount = BigInt(amount) * 1000000000n;
  const body = beginCell()
    .storeUint(0xf8a7ea5, 32)
    .storeUint(0, 64)
    .storeCoins(jettonAmount)
    .storeAddress(Address.parse(toAddress))
    .storeAddress(wallet.address)
    .storeMaybeRef(null)
    .storeCoins(0n)
    .storeMaybeRef(null)
    .endCell();
  const sender = walletContract.sender(client.provider(), keyPair.secretKey);
  await sender.send({ to: jettonWallet, value: toNano('0.05'), bounce: true, body });
}
