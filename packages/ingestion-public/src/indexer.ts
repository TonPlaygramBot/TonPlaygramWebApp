import fs from 'fs';
import path from 'path';
import { ingestPublicContent } from './parser.js';

export function buildPublicIndex(rootDir: string, outputFile = 'packages/ingestion-public/public-index.json'): string {
  const articles = ingestPublicContent(rootDir);
  const target = path.resolve(rootDir, outputFile);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(articles, null, 2));
  return target;
}
