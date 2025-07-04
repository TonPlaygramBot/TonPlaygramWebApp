import { Web3Storage, File } from 'web3.storage';
import fs from 'fs';

const token = process.env.WEB3_STORAGE_TOKEN;
if (!token) {
  console.error('WEB3_STORAGE_TOKEN env variable not set');
  process.exit(1);
}

async function main() {
  const client = new Web3Storage({ token });
  const buffer = await fs.promises.readFile('webapp/public/assets/icons/coin_embedded.svg');
  const cid = await client.put([new File([buffer], 'coin_embedded.svg')], { wrapWithDirectory: false });
  const metaPath = 'tpc_metadata.json';
  const meta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'));
  meta.image = `ipfs://${cid}`;
  await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2));
  console.log('Uploaded logo. CID:', cid);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
