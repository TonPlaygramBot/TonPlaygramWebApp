import path from 'path';
import { buildPublicIndex } from './indexer.js';

const rootDir = process.cwd();
const output = buildPublicIndex(rootDir);
console.log(`Public index generated at ${path.relative(rootDir, output)}`);
