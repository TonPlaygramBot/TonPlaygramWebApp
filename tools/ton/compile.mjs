import { compileFunc, compilerVersion } from '@ton-community/func-js';
import { Cell } from '@ton/core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../../', import.meta.url));
export async function compileContracts({ capped = false } = {}) {
  const result = {};
  // Match repository compile targets, without invoking any deployment module.
  for (const name of ['JettonWallet', 'JettonMinter']) {
    const config = await readFile(path.join(root, `wrappers/${name}.compile.ts`), 'utf8');
    const targets = [...config.matchAll(/'([^']+\.fc)'/g)].map(m => capped && m[1] === 'ft/jetton-minter-discoverable.fc' ? 'ft/tpg-capped-minter.fc' : m[1]);
    if (!targets.length) throw new Error(`No compile targets for ${name}`);
    const sources = Object.fromEntries(await Promise.all(targets.map(async target => [target, await readFile(path.join(root, target), 'utf8')])));
    const compiled = await compileFunc({ targets, sources });
    if (compiled.status !== 'ok') throw new Error(`${name}: ${compiled.message}`);
    result[name] = Cell.fromBase64(compiled.codeBoc);
  }
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const contracts = await compileContracts({ capped: process.argv.includes('--capped') });
  console.log(JSON.stringify({ compiler: await compilerVersion(), codeHashes: Object.fromEntries(Object.entries(contracts).map(([name, code]) => [name, code.hash().toString('hex')])) }, null, 2));
}
