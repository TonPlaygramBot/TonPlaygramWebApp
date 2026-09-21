import { copyFile, link, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

// External game assets are immutable build inputs. Hard links avoid keeping two
// copies of a multi-gigabyte download on the build machine; hosts still receive
// ordinary files. Other public files can be rewritten after bundling, so copy them.
export async function copyPublicAssets(publicDir, outDir, emittedFiles = []) {
  const externalRoot = path.join(publicDir, 'assets', 'external') + path.sep;
  const emittedPaths = new Set(emittedFiles);
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      const relative = path.relative(publicDir, source);
      // Vite normally copies public files before emitting transformed entries.
      // This post-build copy must preserve those emitted entries, including
      // index.html, when a public file has the same output path.
      if (emittedPaths.has(relative.split(path.sep).join('/'))) continue;
      const target = path.join(outDir, relative);
      if (entry.isDirectory()) {
        await mkdir(target, { recursive: true });
        await walk(source);
      } else if (entry.isFile()) {
        await mkdir(path.dirname(target), { recursive: true });
        if (source.startsWith(externalRoot)) {
          try { await link(source, target); continue; }
          catch (error) {
            if (error.code === 'EEXIST') {
              // A repeated output pass may already contain a public copy. Unlink
              // that destination before replacing it: copying over a hard link
              // could otherwise overwrite the immutable source itself.
              await rm(target, { force: true });
              try { await link(source, target); continue; }
              catch (retryError) { error = retryError; }
            }
            if (!['EXDEV', 'EPERM', 'ENOTSUP', 'EACCES'].includes(error.code)) throw error;
          }
        }
        await copyFile(source, target);
      }
    }
  }
  await walk(publicDir);
}

export function copyPublicAssetsPlugin() {
  let config;
  return {
    name: 'tonplaygram-copy-public-assets',
    apply: 'build',
    configResolved(resolved) { config = resolved; },
    async writeBundle(_output, bundle) {
      if (config.publicDir) await copyPublicAssets(config.publicDir, path.resolve(config.root, config.build.outDir), Object.keys(bundle));
    }
  };
}
