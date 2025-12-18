import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repositoryRoot = path.resolve(__dirname, '..');
const codeRoots = [
  path.join(repositoryRoot, 'webapp', 'src'),
  path.join(repositoryRoot, 'bot'),
  path.join(repositoryRoot, 'lib'),
  path.join(repositoryRoot, 'scripts')
].filter((p) => fs.existsSync(p));

const ignoredFolders = new Set([
  'node_modules',
  'dist',
  '.git',
  '.vite',
  '.next',
  'build',
  '.DS_Store'
]);

const allowedExtensions = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.scss',
  '.md',
  '.html'
]);

function walkFiles() {
  const files = [];
  const queue = [...codeRoots];

  while (queue.length) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      if (ignoredFolders.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (allowedExtensions.has(path.extname(entry.name))) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function sanitizeAndResolvePath(requestedPath) {
  const fullPath = path.resolve(repositoryRoot, requestedPath);
  if (!fullPath.startsWith(repositoryRoot)) {
    throw new Error('Path outside repository');
  }
  return fullPath;
}

function createDevAssistantPlugin() {
  return {
    name: 'dev-assistant-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/dev-assistant/index', (req, res) => {
        const files = walkFiles().map((f) => path.relative(repositoryRoot, f));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ files, root: repositoryRoot }));
      });

      server.middlewares.use('/api/dev-assistant/search', (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const query = (url.searchParams.get('q') || '').trim();

        if (!query) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing query' }));
          return;
        }

        const lowerQuery = query.toLowerCase();
        const files = walkFiles();
        const results = [];

        for (const filePath of files) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split(/\r?\n/);
            const matches = [];

            lines.forEach((line, index) => {
              if (line.toLowerCase().includes(lowerQuery)) {
                matches.push({
                  line: line.trim(),
                  lineNumber: index + 1
                });
              }
            });

            if (matches.length) {
              results.push({
                path: path.relative(repositoryRoot, filePath),
                matches: matches.slice(0, 6)
              });
            }

            if (results.length >= 30) break;
          } catch (err) {
            server.config.logger.error(`Dev assistant search failed for ${filePath}: ${err.message}`);
          }
        }

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          query,
          results,
          scanned: files.length
        }));
      });

      server.middlewares.use('/api/dev-assistant/file', (req, res) => {
        const url = new URL(req.url || '', 'http://localhost');
        const relativePath = url.searchParams.get('path');

        if (!relativePath) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing path' }));
          return;
        }

        try {
          const fullPath = sanitizeAndResolvePath(relativePath);
          if (!fs.existsSync(fullPath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'File not found' }));
            return;
          }

          const content = fs.readFileSync(fullPath, 'utf-8');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            path: path.relative(repositoryRoot, fullPath),
            content
          }));
        } catch (error) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: error.message }));
        }
      });
    }
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), createDevAssistantPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  // SPA fallback for React Router
  server: {
    historyApiFallback: true
  }
});
