import fs from 'fs';
import path from 'path';
import type { PublicArticle } from './types.js';

export function loadKnowledgeIndex(indexPath: string): PublicArticle[] {
  const resolved = path.resolve(indexPath);
  if (!fs.existsSync(resolved)) {
    return [];
  }
  return JSON.parse(fs.readFileSync(resolved, 'utf8')) as PublicArticle[];
}
