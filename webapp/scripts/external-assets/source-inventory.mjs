import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const WEBAPP_DIR = fileURLToPath(new URL('../../', import.meta.url));
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx', '.css', '.html']);
const ASSET_EXTENSION = /\.(?:avif|png|jpe?g|webp|gif|svg|ico|bmp|tga|ktx2?|basis|dds|hdr|exr|glb|gltf|bin|wasm|fbx|obj|mtl|mp3|ogg|wav|m4a|aac|mp4|webm|woff2?|ttf|otf|eot|json|css|m?js)$/i;
const MODEL_EXTENSION = /\.(?:gltf|glb|fbx|obj)$/i;
const MODULE_HOSTS = new Set(['esm.sh', 'cdn.skypack.dev']);
const LIVE_SCRIPT_HOSTS = new Set(['telegram.org', 'accounts.google.com', 'connect.facebook.net', 'www.tiktok.com']);
const LIVE_METADATA_URLS = new Set([
  'https://config.ton.org/wallets-v2.json',
  'https://raw.githubusercontent.com/ton-connect/wallets-list-staging/refs/heads/main/wallets-v2.json'
]);
const IGNORED_DIRECTORIES = new Set(['node_modules', 'vendor', '__tests__', '__mocks__', 'test', 'tests', 'docs', 'coverage', 'preview', 'previews', 'review', 'reviews']);
const WEAPON_KART_COMPONENT = 'components/WeaponKartGame.jsx';
const GEOMETRY_REFERENCE_MODULES = new Set([
  'src/games/tirana-city-source/cityBusinessProfiles.mjs',
  'src/games/tirana-city-source/businessBuildingProfiles.mjs'
]);

const normalizeRelative = value => value.split(path.sep).join('/');
const htmlDecode = value => value.replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');

function normalizedHttpUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value.trim()) || /\$\{|[\r\n]/.test(value)) return null;
  try {
    const url = new URL(htmlDecode(value.trim()));
    if (url.username || url.password) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

export function isSupportedExternalAsset(value, { resourceType } = {}) {
  const url = normalizedHttpUrl(value);
  if (!url || LIVE_SCRIPT_HOSTS.has(url.hostname) || LIVE_METADATA_URLS.has(`${url.origin}${url.pathname}`)) return false;
  // Wikimedia File: articles describe attribution/licensing and return HTML,
  // even when their titles end in .jpg. Actual uploaded image URLs and the
  // Special:FilePath image redirect remain eligible resources.
  if (url.hostname === 'commons.wikimedia.org' && /^\/wiki\/File(?::|%3a)/i.test(url.pathname)) return false;
  if (/\/(?:auth|oauth2?|login|signin)(?:\/|$)/i.test(url.pathname)) return false;
  if (/\.json$/i.test(url.pathname) && (/^api\./i.test(url.hostname) || /\/api(?:\/|$)/i.test(url.pathname))) return false;
  // These are content endpoints despite having no filename suffix. General
  // APIs, account flows, links and arbitrary extensionless URLs stay excluded.
  if (url.hostname === 'fonts.googleapis.com' && /^\/css2?$/.test(url.pathname)) return true;
  if (url.hostname === 'images.unsplash.com' && /^\/photo-/.test(url.pathname)) return true;
  if (MODULE_HOSTS.has(url.hostname) && url.pathname !== '/') return true;
  if (resourceType === 'stylesheet' || resourceType === 'script') return true;
  return ASSET_EXTENSION.test(url.pathname);
}

async function sourceFiles(directory, root = directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || IGNORED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
    const absolute = path.join(directory, entry.name);
    // Imported payloads and URL maps are outputs of this inventory, never new
    // source seeds. Scanning them would recursively import generated aliases.
    if (normalizeRelative(path.relative(root, absolute)) === 'assets/external') continue;
    if (entry.isDirectory()) files.push(...await sourceFiles(absolute, root));
    else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) &&
      !/(?:\.(?:test|spec|stories)\.|\.d\.(?:ts|mts)$|(?:^|[-.])(?:preview|review)\.)/i.test(entry.name)) {
      files.push({ absolute, relative: normalizeRelative(path.relative(root, absolute)) });
    }
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

/** This legacy component has no route/import in the application. Keep the
 * exception conditional: any new reference or source glob restores inventory
 * coverage. Inspect all source folders here, including previews and tests. */
export async function shouldExcludeWeaponKartGame({ repoRoot, sourceDir } = {}) {
  const root = sourceDir || path.join(repoRoot ? path.join(repoRoot, 'webapp') : WEBAPP_DIR, 'src');
  const component = path.resolve(root, WEAPON_KART_COMPONENT);
  const hasReference = async directory => {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const filename = path.resolve(directory, entry.name);
      if (filename === component) continue;
      if (entry.isDirectory()) {
        if (await hasReference(filename)) return true;
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const text = await readFile(filename, 'utf8');
        if (/WeaponKartGame|import\s*\.\s*meta\s*\.\s*glob|require\s*\.\s*context/i.test(text)) return true;
      }
    }
    return false;
  };
  return !await hasReference(root);
}

const propertyName = node => node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : '';

function ignoredContext(node) {
  for (let current = node; current?.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isJsxAttribute(parent)) {
      const name = propertyName(parent.name).toLowerCase();
      if (name === 'href') {
        const element = parent.parent?.parent;
        if (propertyName(element?.tagName).toLowerCase() !== 'link') return true;
      }
      if (['xmlns', 'action'].includes(name)) return true;
    }
    if (ts.isPropertyAssignment(parent) && /^(?:license|licence|licenseUrl|licenceUrl|attribution|author|homepage|website|documentation|sourcePage)$/i.test(propertyName(parent.name))) return true;
    if (ts.isCallExpression(parent) && /^(?:console\.|window\.open$|openExternal|openTelegramLink|openLink)/.test(parent.expression.getText())) return true;
    if (ts.isStatement(parent)) break;
  }
  return false;
}

function isHistoricalImportedUrlList(node, filename) {
  if (filename !== 'src/games/tiranastreets/shared/importedAssets.mjs' ||
      !ts.isPropertyAssignment(node) || propertyName(node.name) !== 'urls' ||
      !ts.isObjectLiteralExpression(node.parent)) return false;
  const fields = Object.fromEntries(node.parent.properties
    .filter(property => ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer))
    .map(property => [propertyName(property.name), property.initializer.text]));
  // These generated records retain guesses made before the original was
  // acquired. ImportedAssetVisuals uses localUrl exclusively when present;
  // import-tirana-originals and the local-alias verifier use sourceUrl+sha256.
  // A record without a selected, hashed local original still needs its urls.
  return fields.localUrl?.startsWith('/assets/') && Boolean(normalizedHttpUrl(fields.sourceUrl)) && /^[a-f0-9]{64}$/i.test(fields.sha256 || '');
}

function parseJavaScript(text, filename, found) {
  const kind = /\.tsx?$/.test(filename) ? (filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) : ts.ScriptKind.JSX;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, kind);
  const declarations = new Map();
  const visitDeclarations = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer &&
      (node.parent.flags & ts.NodeFlags.Const)) {
      const name = node.name.text;
      declarations.set(name, declarations.has(name) ? null : node.initializer);
    }
    ts.forEachChild(node, visitDeclarations);
  };
  visitDeclarations(source);
  const evaluate = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return undefined;
    const nextSeen = new Set(seen).add(node);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isNumericLiteral(node)) return node.text;
    if (ts.isIdentifier(node)) return evaluate(declarations.get(node.text), nextSeen);
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return evaluate(node.expression, nextSeen);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = evaluate(node.left, nextSeen), right = evaluate(node.right, nextSeen);
      return left === undefined || right === undefined ? undefined : left + right;
    }
    if (ts.isTemplateExpression(node)) {
      let result = node.head.text;
      for (const span of node.templateSpans) {
        const value = evaluate(span.expression, nextSeen);
        if (value === undefined) return undefined;
        result += value + span.literal.text;
      }
      return result;
    }
    return undefined;
  };
  const describe = node => ({ referrer: filename, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  const visit = node => {
    if (isHistoricalImportedUrlList(node, filename) || ignoredContext(node)) return;
    // These two catalogs document photographs inspected while authoring
    // geometry. Their viewers render `photo`; `referenceImage` is not read.
    // Keep remote photo/src values, and referenceImage in other modules.
    if (GEOMETRY_REFERENCE_MODULES.has(filename) && ts.isPropertyAssignment(node) && propertyName(node.name) === 'referenceImage') return;
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) found.imports.add(node.moduleSpecifier.text);
    const isStringFragment = node.parent && (ts.isTemplateSpan(node.parent) ||
      (ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken));
    if (!isStringFragment && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node) || ts.isBinaryExpression(node))) {
      const value = evaluate(node);
      if (value !== undefined) {
        found.add(value, filename);
        // CSS embedded in styled strings is also runtime asset usage.
        if (/url\s*\(|@import\b/.test(value)) parseCss(value, filename, found);
        if (/<(?:img|script|link|source|video|audio)\b/i.test(value)) parseHtml(value, filename, found);
        if (/^https?:\/\//.test(value) && !isSupportedExternalAsset(value) &&
          (value.endsWith('/') || /(?:base|prefix|decoder|path)/i.test(node.parent?.name?.getText() || ''))) {
          found.directory(value, filename);
        }
      } else if (ts.isTemplateExpression(node) && /https?:\/\//.test(node.getText())) {
        found.dynamic.push({ ...describe(node), expression: node.getText() });
      }
    }
    if (ts.isArrayLiteralExpression(node)) {
      const urls = node.elements.map(element => evaluate(element)).filter(value => isSupportedExternalAsset(value));
      const label = propertyName(node.parent?.name) || propertyName(node.parent?.parent?.name) || 'array';
      if (urls.length > 1 && /(?:urls?|fallback|sources?|candidates|models?|three|orbit|gltf)/i.test(label)) {
        found.fallbackGroups.push({ ...describe(node), label, urls: [...new Set(urls)] });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function parseCss(text, filename, found) {
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
    const before = css.slice(Math.max(0, match.index - 12), match.index);
    found.add(match[1] ?? match[2] ?? match[3], filename, { resourceType: /@import\s*$/i.test(before) ? 'stylesheet' : undefined });
  }
  for (const match of css.matchAll(/@import\s+["']([^"']+)["']/gi)) found.add(match[1], filename, { resourceType: 'stylesheet' });
}

function parseHtml(text, filename, found) {
  const html = text.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    parseJavaScript(match[1], filename, found);
  }
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) parseCss(match[1], filename, found);
  for (const match of html.matchAll(/<(script|link|img|source|video|audio|iframe|object|embed)\b([^>]*)>/gi)) {
    const tag = match[1].toLowerCase();
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(attribute => [attribute[1].toLowerCase(), htmlDecode(attribute[2] ?? attribute[3])]));
    if (tag === 'link' && !/^(?:stylesheet|icon|preload|modulepreload|apple-touch-icon)$/.test(attributes.rel || '')) continue;
    const resourceType = tag === 'script' ? 'script' : tag === 'link' && attributes.rel === 'stylesheet' ? 'stylesheet' : undefined;
    for (const attribute of ['src', 'href', 'poster', 'data']) if (attributes[attribute]) found.add(attributes[attribute], filename, { resourceType });
    if (attributes.srcset) for (const item of attributes.srcset.split(',')) found.add(item.trim().split(/\s+/)[0], filename);
  }
}

/** Static import/export, dynamic import and worker URL references for the
 * downloader's module-closure pass. Bare imports are deliberately preserved;
 * their package resolution belongs to the downloader, not a guessed URL. */
export function extractModuleDependencySpecifiers(text, filename = 'module.js') {
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const dependencies = new Set();
  const add = node => { if (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) dependencies.add(node.text); };
  const visit = node => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText() === 'importScripts')) node.arguments.forEach(add);
    if (ts.isNewExpression(node) && node.expression.getText() === 'URL' && node.arguments?.[1]?.getText() === 'import.meta.url') add(node.arguments[0]);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...dependencies].sort();
}

function inventoryCollector() {
  const assets = new Map(), directories = new Map();
  const merge = (map, url, referrer) => {
    if (!map.has(url)) map.set(url, new Set());
    map.get(url).add(referrer);
  };
  const found = {
    fallbackGroups: [], dynamic: [], imports: new Set(),
    add(value, referrer, options) {
      if (isSupportedExternalAsset(value, options)) merge(assets, normalizedHttpUrl(value).href, referrer);
    },
    directory(value, referrer) {
      const url = normalizedHttpUrl(value);
      if (url && url.pathname !== '/') merge(directories, url.href, referrer);
    }
  };
  return { assets, directories, found };
}

function summarizeInventory({ assets, directories, found }) {
  const serialize = map => [...map].sort(([a], [b]) => a.localeCompare(b)).map(([url, referrers]) => ({ url, referrers: [...referrers].sort() }));
  const result = serialize(assets);
  return {
    assets: result,
    modelSeeds: result.filter(asset => MODEL_EXTENSION.test(new URL(asset.url).pathname)),
    moduleSeeds: result.filter(asset => /\.m?js$/i.test(new URL(asset.url).pathname) || MODULE_HOSTS.has(new URL(asset.url).hostname)),
    directoryPrefixes: serialize(directories),
    fallbackGroups: found.fallbackGroups,
    dynamicReferences: found.dynamic
  };
}

async function scanDirectories(directories, inventory, excludedFiles = new Set()) {
  for (const [directory, prefix] of directories) {
    for (const file of await sourceFiles(directory)) {
      if (excludedFiles.has(path.resolve(file.absolute))) continue;
      const text = await readFile(file.absolute, 'utf8');
      if (!/https?:|\bimport\b/.test(text)) continue;
      const referrer = `${prefix}/${file.relative}`;
      const extension = path.extname(file.relative).toLowerCase();
      if (extension === '.css') parseCss(text, referrer, inventory.found);
      else if (extension === '.html') parseHtml(text, referrer, inventory.found);
      else parseJavaScript(text, referrer, inventory.found);
    }
  }
}

async function scanKnownLibraryAssets(root, inventory) {
  // Include TonConnect UI's own visual assets before the first Vite build.
  // The SDK's third-party wallet registry is live integration data, including
  // externally managed wallet icons; it is not part of the offline game bundle.
  // Do not enumerate/download that registry merely because the SDK is imported.
  const imports = inventory.found.imports;
  const packages = [];
  if (imports.has('@tonconnect/ui-react') || imports.has('@tonconnect/ui')) packages.push('@tonconnect/ui');
  for (const name of packages) {
    const packageDir = path.join(root, 'node_modules', name);
    let packageText;
    try { packageText = await readFile(path.join(packageDir, 'package.json'), 'utf8'); }
    catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const metadata = JSON.parse(packageText);
    const entry = metadata.module || metadata.exports?.['.']?.import;
    if (typeof entry !== 'string') throw new Error(`Cannot identify the installed ${name} ESM asset provider.`);
    const filename = path.resolve(packageDir, entry);
    if (!filename.startsWith(`${packageDir}${path.sep}`)) throw new Error(`Invalid ${name} asset provider path.`);
    parseJavaScript(await readFile(filename, 'utf8'), `node_modules/${name}/${entry.replace(/^\.\//, '')}`, inventory.found);
  }
}

/** repoRoot is the repository containing webapp; explicit directories are useful
 * for isolated fixture tests and do not load any application modules. */
export async function collectExternalAssetInventory({ repoRoot, sourceDir, publicDir } = {}) {
  const root = repoRoot ? path.join(repoRoot, 'webapp') : WEBAPP_DIR;
  const inventory = inventoryCollector();
  const sources = sourceDir || path.join(root, 'src');
  const excludedFiles = new Set();
  if (await shouldExcludeWeaponKartGame({ sourceDir: sources })) excludedFiles.add(path.resolve(sources, WEAPON_KART_COMPONENT));
  await scanDirectories([[sources, 'src'], [publicDir || path.join(root, 'public'), 'public']], inventory, excludedFiles);
  await scanKnownLibraryAssets(root, inventory);
  if (!sourceDir && !publicDir) {
    try { parseHtml(await readFile(path.join(root, 'index.html'), 'utf8'), 'index.html', inventory.found); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return summarizeInventory(inventory);
}

export async function collectStaticExternalAssets(options = {}) {
  return (await collectExternalAssetInventory(options)).assets;
}

/** Inspect emitted code to catch asset providers inside used dependencies.
 * Only the known Drei environment map is expanded, and only when its base URL
 * survives tree shaking. This does not traverse unused node_modules examples. */
export async function collectBuiltExternalAssetInventory({ repoRoot, distDir } = {}) {
  const root = repoRoot ? path.join(repoRoot, 'webapp') : WEBAPP_DIR;
  const inventory = inventoryCollector();
  await scanDirectories([[distDir || path.join(root, 'dist'), 'dist']], inventory);
  const providerSeeds = [];
  try {
    const helperPath = path.join(root, 'node_modules/@react-three/drei/helpers/environment-assets.js');
    const loaderPath = path.join(root, 'node_modules/@react-three/drei/core/useEnvironment.js');
    const [helper, loader] = await Promise.all([readFile(helperPath, 'utf8'), readFile(loaderPath, 'utf8')]);
    const base = loader.match(/CUBEMAP_ROOT\s*=\s*['"]([^'"]+)['"]/)?.[1];
    if (base && inventory.directories.has(base)) {
      for (const match of helper.matchAll(/\b(\w+):\s*['"]([^'"]+\.hdr)['"]/g)) {
        const url = new URL(match[2], base).href;
        const referrer = 'node_modules/@react-three/drei/helpers/environment-assets.js';
        inventory.found.add(url, referrer);
        providerSeeds.push({ provider: 'drei-environment', preset: match[1], url, referrers: [referrer, ...inventory.directories.get(base)] });
      }
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { ...summarizeInventory(inventory), providerSeeds };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  collectExternalAssetInventory().then(inventory => {
    process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
