import TonWeb from 'tonweb';
import { mnemonicNew, mnemonicToWalletKey } from 'ton-crypto';
import { WalletContractV4 } from 'ton';

export function normalizeAddress(addr) {
  try {
    return new TonWeb.utils.Address(addr).toString(true, false, false);
  } catch {
    return null;
  }
}

export async function generateWalletAddress() {
  const mnemonic = await mnemonicNew(24);
  const keyPair = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey
  });
  return wallet.address.toString({ urlSafe: true, bounceable: false });
}
