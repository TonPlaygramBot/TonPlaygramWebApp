import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'url';
register('ts-node/esm', pathToFileURL('./'));

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { compile } from '@ton/blueprint';
import { mnemonicToWalletKey } from 'ton-crypto';
import { TonClient, TonClient4, WalletContractV4, internal } from 'ton';
import { Address, toNano, beginCell } from '@ton/core';
import { JettonMinter, jettonContentToCell, jettonMinterConfigToCell } from '../wrappers/JettonMinter';
import { JettonWallet } from '../wrappers/JettonWallet';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const mnemonic = process.env.MNEMONIC;
const ENDPOINT = process.env.RPC_URL;
const ADMIN = process.env.ADMIN_ADDRESS && Address.parse(process.env.ADMIN_ADDRESS);

if (!mnemonic || !ENDPOINT || !ADMIN) {
  console.error('MNEMONIC, RPC_URL and ADMIN_ADDRESS must be set in scripts/.env');
  process.exit(1);
}

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

  const fullSupply = 1000000000n * 1000000000n;
  await minter.sendMint(client.provider(minter.address), sender, ADMIN, fullSupply, toNano('0.01'), toNano('0.02'));
  console.log('Minted supply to admin');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
