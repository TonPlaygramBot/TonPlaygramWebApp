import { mnemonicNew, mnemonicToPrivateKey } from 'ton-crypto';
import { WalletContractV4 } from 'ton';

export async function generateWalletAddress() {
  const mnemonics = await mnemonicNew();
  const keyPair = await mnemonicToPrivateKey(mnemonics);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const address = wallet.address.toString();
  return {
    address,
    publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    // secret key and mnemonic intentionally omitted to avoid sensitive data exposure
  };
}
