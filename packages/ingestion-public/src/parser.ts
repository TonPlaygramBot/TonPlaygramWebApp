import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { PublicArticle } from '../../agent-core/src/types.js';

const ALLOWED_DIRS = ['public_docs', 'help_articles', 'rules', 'policies'];

interface Frontmatter {
  title: string;
  slug: string;
  locale: string;
  version: string;
}

function parseFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/m.exec(content);
  if (!match) throw new Error('Missing frontmatter');

  const raw = match[1].split('\n').map((line) => line.trim());
  const map = Object.fromEntries(raw.map((line) => line.split(':').map((x) => x.trim())));

  return {
    frontmatter: {
      title: map.title,
      slug: map.slug,
      locale: map.locale ?? 'en',
      version: map.version ?? '1.0.0'
    },
    body: match[2].trim()
  };
}

function chunkBySection(body: string): Array<{ sectionId: string; content: string }> {
  const parts = body.split('\n## ');
  return parts.map((part, idx) => {
    const normalized = idx === 0 ? part : `## ${part}`;
    const titleLine = normalized.split('\n')[0].replace(/^##\s*/, '').trim();
    const sectionId = titleLine.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return { sectionId: sectionId || `section-${idx + 1}`, content: normalized.trim() };
  });
}

export function ingestPublicContent(rootDir: string): PublicArticle[] {
  const all: PublicArticle[] = [];

  ALLOWED_DIRS.forEach((dirName) => {
    const full = path.join(rootDir, dirName);
    if (!fs.existsSync(full)) return;

    fs.readdirSync(full)
      .filter((file) => file.endsWith('.md'))
      .forEach((file) => {
        const sourcePath = path.join(dirName, file);
        const raw = fs.readFileSync(path.join(full, file), 'utf8');
        const { frontmatter, body } = parseFrontmatter(raw);
        const sections = chunkBySection(body);
        const hash = crypto.createHash('sha256').update(raw).digest('hex');

        sections.forEach((section, index) => {
          all.push({
            id: `${frontmatter.slug}#${section.sectionId}-${index + 1}`,
            title: frontmatter.title,
            slug: frontmatter.slug,
            sectionId: section.sectionId,
            content: section.content,
            url: `/help/${frontmatter.slug}`,
            locale: frontmatter.locale,
            version: frontmatter.version,
            contentHash: hash,
            sourcePath
          });
        });
      });
  });

  return all;
}
