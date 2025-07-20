import { TonClient, WalletContractV4, internal, beginCell, Address, toNano } from 'ton';
import { mnemonicToWalletKey } from 'ton-crypto';

const endpoint = process.env.RPC_URL || 'https://toncenter.com/api/v2/jsonRPC';
const contract = process.env.CLAIM_CONTRACT_ADDRESS;
const mnemonic = process.env.CLAIM_WALLET_MNEMONIC;

export default async function tonClaim(toAddress, amount) {
  if (!contract || !mnemonic) {
    throw new Error('CLAIM_CONTRACT_ADDRESS and CLAIM_WALLET_MNEMONIC must be set');
  }

  const client = new TonClient({ endpoint });
  const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);
  const seqno = await walletContract.getSeqno();

  await walletContract.sendTransfer({
    secretKey: keyPair.secretKey,
    seqno,
    messages: [
      internal({
        to: Address.parse(contract),
        value: toNano('0.05'),
        bounce: false,
        body: beginCell()
          .storeUint(0x01, 32)
          .storeUint(0, 64)
          .storeAddress(Address.parse(toAddress))
          .storeCoins(amount)
          .endCell(),
      }),
    ],
  });
}
