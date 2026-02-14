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

function tryRead(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function buildAutoPlatformArticles(rootDir: string): PublicArticle[] {
  const articles: PublicArticle[] = [];
  const appFile = tryRead(path.join(rootDir, 'webapp/src/App.jsx'));
  const gamesCatalog = tryRead(path.join(rootDir, 'webapp/src/config/gamesCatalog.js'));

  const routeMatches = [...appFile.matchAll(/<Route\s+path="([^"]+)"\s+element={<([A-Za-z0-9_]+)/g)];
  const gameRouteMatches = [...gamesCatalog.matchAll(/route:\s*'([^']+)'/g)].map((m) => m[1]);

  const routeLines = routeMatches
    .filter(([, route]) => !route.startsWith('/admin'))
    .map(([, route, component]) => `- ${route}: opens ${component} page for users.`);

  const gameLines = gameRouteMatches.map((route) => `- ${route}: game lobby entry route.`);

  const body = [
    '## Core routes',
    ...routeLines,
    '',
    '## Game lobby routes',
    ...gameLines,
    '',
    '## Safety note',
    'This auto-generated map includes user-visible routes only and excludes internal implementation details.'
  ].join('\n');

  const sourcePath = 'webapp/src/App.jsx + webapp/src/config/gamesCatalog.js';
  const hash = crypto.createHash('sha256').update(`${appFile}\n${gamesCatalog}`).digest('hex');

  chunkBySection(body).forEach((section, index) => {
    articles.push({
      id: `platform-route-map#${section.sectionId}-${index + 1}`,
      title: 'Platform route map (auto-generated)',
      slug: 'platform-route-map',
      sectionId: section.sectionId,
      content: section.content,
      url: '/help/platform-route-map',
      locale: 'en',
      version: 'auto',
      contentHash: hash,
      sourcePath
    });
  });

  return articles;
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

  all.push(...buildAutoPlatformArticles(rootDir));
  return all;
}
