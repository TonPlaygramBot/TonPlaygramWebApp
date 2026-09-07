import ts from 'typescript';
import { readFile, writeFile } from 'node:fs/promises';

const source = new URL('../webapp/src/games/archeryroyal/shared/rules.ts', import.meta.url);
const target = new URL('../webapp/src/games/archeryroyal/shared/rules.mjs', import.meta.url);
const input = await readFile(source, 'utf8');
const output = ts.transpileModule(input, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 }
}).outputText;
await writeFile(target, output);
