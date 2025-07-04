import { register } from 'node:module';
import { pathToFileURL } from 'url';
register('ts-node/esm', pathToFileURL('./'));

import fs from 'fs';
import { compile } from '@ton/blueprint';
import { mnemonicToWalletKey } from 'ton-crypto';
import { TonClient, TonClient4, WalletContractV4, internal } from 'ton';
import { Address, toNano, beginCell } from '@ton/core';
import { JettonMinter, jettonContentToCell, jettonMinterConfigToCell } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';

const mnemonic = process.env.DEPLOY_MNEMONIC;
if (!mnemonic) {
  console.error('DEPLOY_MNEMONIC env variable not set');
  process.exit(1);
}

const ENDPOINT = process.env.TON_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC';
const ADMIN = Address.parse('UQDqDBiNU132j15Qka5EmSf37jCTLF-RdOlaQOXLHIJ5t-XT');

async function main() {
  const keyPair = await mnemonicToWalletKey(mnemonic.split(' '));
  const client = new TonClient4({ endpoint: ENDPOINT });
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletContract = client.open(wallet);

  const walletCode = await compile('JettonWallet');
  const minterCode = await compile('JettonMinter');

  const metadata = JSON.parse(fs.readFileSync('./tpc_metadata.json', 'utf-8'));
  const contentCell = jettonContentToCell({ type: 1, uri: metadata.image });
  const minter = JettonMinter.createFromConfig({ admin: ADMIN, content: contentCell, wallet_code: walletCode }, minterCode);

  const sender = walletContract.sender(client.provider(), keyPair.secretKey);
  await sender.send({
    value: toNano('0.05'),
    to: minter.address,
    bounce: false,
    init: { code: minterCode, data: jettonMinterConfigToCell({ admin: ADMIN, content: contentCell, wallet_code: walletCode }) },
    body: beginCell().endCell(),
  });

  console.log('Jetton minter deployed at', minter.address.toString());

  const fullSupply = 10000000000n * 1000000000n;
  await minter.sendMint(client.provider(minter.address), sender, ADMIN, fullSupply, toNano('0.01'), toNano('0.02'));
  console.log('Minted supply to admin');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
