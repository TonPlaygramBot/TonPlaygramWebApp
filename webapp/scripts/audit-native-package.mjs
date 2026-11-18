import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
export const DEFAULT_NATIVE_WEB_BUDGET = 150 * 1024 * 1024
export function publicHttpsUrl (value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash } catch { return false }
}
/** Engineering shell budget, not an assertion about a store's compressed limit.
 * Reject symlinks so the measured tree is exactly the tree Capacitor will copy. */
export async function auditNativePackage ({ distDir = fileURLToPath(new URL('../dist/', import.meta.url)), maxBytes = DEFAULT_NATIVE_WEB_BUDGET, requireCdn = true } = {}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw Error('Invalid native web budget')
  const index = await readFile(path.join(distDir, 'index.html'), 'utf8')
  if (!index.trim()) throw Error('Native index.html is empty')
  if (requireCdn) {
    const catalog = JSON.parse(await readFile(path.join(distDir, 'pwa/game-packs/index.json'), 'utf8'))
    const report = JSON.parse(await readFile(path.join(distDir, 'pwa/game-packs/native-prune-report.json'), 'utf8'))
    if (catalog.source !== 'cdn' || !Array.isArray(catalog.packs) || !catalog.packs.length || report.catalogSource !== 'cdn' || report.schemaVersion !== 1) throw Error('Native release requires a CDN catalog and successful prune report')
  }
  const files = []
  async function walk (dir) {
    for (const name of await readdir(dir)) {
      const p = path.join(dir, name); const info = await lstat(p)
      if (info.isSymbolicLink()) throw Error('Native package contains a symlink: ' + path.relative(distDir, p))
      if (info.isDirectory()) await walk(p); else if (info.isFile())files.push({ path: path.relative(distDir, p).split(path.sep).join('/'), bytes: info.size })
      else throw Error('Unsupported native package entry: ' + name)
    }
  }
  await walk(distDir)
  const bytes = files.reduce((sum, f) => sum + f.bytes, 0); const largest = files.sort((a, b) => b.bytes - a.bytes).slice(0, 10)
  if (bytes > maxBytes) throw Error(`Native web shell exceeds budget: ${bytes} > ${maxBytes} bytes. Largest: ${largest.map(f => `${f.path} (${f.bytes})`).join(', ')}`)
  return { bytes, files: files.length, maxBytes, largest }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  auditNativePackage().then(report => console.log(JSON.stringify(report, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1 })
}
