import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const execFileAsync = promisify(execFile)
const WEBAPP_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST_PATH = resolve(WEBAPP_ROOT, 'config/sketchfab-assets.json')
const DEFAULT_GLTF_FILE = 'scene.gltf'
const DEFAULT_GLB_FILE = 'model.glb'
const SUPPORTED_FORMATS = new Set(['gltf', 'glb'])

function parseArgs (argv) {
  const out = {
    asset: 'all',
    from: null,
    manifest: MANIFEST_PATH,
    targetDir: null,
    target: null,
    validateOnly: false,
    help: false
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--asset') {
      out.asset = argv[i + 1] || out.asset
      i += 1
    } else if (arg === '--from') {
      out.from = argv[i + 1] ? resolve(argv[i + 1]) : null
      i += 1
    } else if (arg === '--manifest') {
      out.manifest = argv[i + 1] ? resolve(argv[i + 1]) : out.manifest
      i += 1
    } else if (arg === '--target-dir') {
      out.targetDir = argv[i + 1] ? resolve(argv[i + 1]) : out.targetDir
      i += 1
    } else if (arg === '--target') {
      out.target = argv[i + 1] ? resolve(argv[i + 1]) : out.target
      i += 1
    } else if (arg === '--validate-only') {
      out.validateOnly = true
    } else if (arg === '--help' || arg === '-h') {
      out.help = true
    }
  }

  return out
}

function printHelp (assets = []) {
  const assetList = assets.length
    ? assets
      .map((asset) => `  ${asset.id.padEnd(28)} ${asset.label || asset.id} -> ${asset.targetDir}/${targetFileName(asset)}`)
      .join('\n')
    : '  No assets are configured yet. Add entries to webapp/config/sketchfab-assets.json.'

  console.log(`Install configured Sketchfab assets without committing binaries.

Usage:
  SKETCHFAB_TOKEN=<token> npm run fetch:sketchfab-assets
  SKETCHFAB_TOKEN=<token> npm run fetch:sketchfab-assets -- --asset wooden-crate
  npm run fetch:sketchfab-assets -- --asset wooden-crate --from /path/to/sketchfab-gltf.zip
  npm run fetch:sketchfab-assets -- --asset wooden-crate --from /path/to/extracted-gltf-folder
  npm run fetch:sketchfab-assets -- --asset wooden-crate --from /path/to/model.glb
  npm run fetch:sketchfab-assets -- --validate-only

Assets:
${assetList}

The default output root is public/models/sketchfab/, which is gitignored so downloaded models, textures, buffers, and archives stay out of pull requests.`)
}

async function loadManifest (manifestPath) {
  const raw = await readFile(manifestPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!parsed || !Array.isArray(parsed.assets)) {
    throw new Error(`Manifest must contain an "assets" array: ${manifestPath}`)
  }

  const ids = new Set()
  return parsed.assets.map((asset) => {
    if (!asset.id || typeof asset.id !== 'string') {
      throw new Error('Every Sketchfab asset manifest entry needs a string "id".')
    }
    if (ids.has(asset.id)) throw new Error(`Duplicate Sketchfab asset id: ${asset.id}`)
    ids.add(asset.id)

    const format = asset.format || 'gltf'
    if (!SUPPORTED_FORMATS.has(format)) {
      throw new Error(`Unsupported format "${format}" for ${asset.id}. Use "gltf" or "glb".`)
    }
    if (!asset.uid || typeof asset.uid !== 'string') {
      throw new Error(`Sketchfab asset ${asset.id} needs a Sketchfab model uid.`)
    }
    if (!asset.targetDir || typeof asset.targetDir !== 'string') {
      throw new Error(`Sketchfab asset ${asset.id} needs a targetDir.`)
    }

    return {
      ...asset,
      format,
      label: asset.label || asset.id
    }
  })
}

function resolveAsset (assets, assetId) {
  const asset = assets.find((entry) => entry.id === assetId)
  if (!asset) throw new Error(`Unknown --asset "${assetId}". Use --help to list configured assets.`)
  return asset
}

function targetFileName (asset) {
  if (asset.targetFileName) return asset.targetFileName
  return asset.format === 'glb' ? DEFAULT_GLB_FILE : DEFAULT_GLTF_FILE
}

function resolveTargetDir (asset, targetDirOverride = null, targetOverride = null) {
  if (targetDirOverride) return resolve(targetDirOverride)
  if (targetOverride) return dirname(resolve(targetOverride))
  return resolve(WEBAPP_ROOT, asset.targetDir)
}

function targetModelPath (asset, targetDir) {
  return join(targetDir, targetFileName(asset))
}

async function fetchJson (url, options) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Request failed ${response.status} ${response.statusText}: ${body}`)
  }
  return response.json()
}

async function downloadBuffer (url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Sketchfab archive download failed ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function pathExists (path) {
  return stat(path)
    .then(() => true)
    .catch(() => false)
}

async function collectFiles (root) {
  const entries = await readdir(root, { withFileTypes: true })
  const out = []
  for (const entry of entries) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await collectFiles(full)))
    } else if (entry.isFile()) {
      out.push(full)
    }
  }
  return out
}

async function findModelFile (root, extension, preferredName) {
  const files = await collectFiles(root)
  const matches = files.filter((file) => extname(file).toLowerCase() === extension)
  if (matches.length === 0) throw new Error(`No ${extension} file found in ${root}.`)
  return matches.find((file) => basename(file).toLowerCase() === preferredName.toLowerCase()) || matches[0]
}

async function unzipToTemp (zipPath) {
  const tempDir = await mkdtemp(join(tmpdir(), 'sketchfab-asset-'))
  await execFileAsync('unzip', ['-q', zipPath, '-d', tempDir])
  return tempDir
}

async function readGltfJson (gltfPath) {
  const text = await readFile(gltfPath, 'utf8')
  return JSON.parse(text)
}

function isExternalUri (uri) {
  return typeof uri === 'string' && uri && !uri.startsWith('data:') && !/^https?:\/\//i.test(uri)
}

async function validateExternalReferences (json, gltfDir) {
  const uris = [
    ...(Array.isArray(json.buffers) ? json.buffers.map((buffer) => buffer.uri) : []),
    ...(Array.isArray(json.images) ? json.images.map((image) => image.uri) : [])
  ].filter(isExternalUri)

  for (const uri of uris) {
    const filePath = resolve(gltfDir, decodeURIComponent(uri))
    if (!(await pathExists(filePath))) {
      throw new Error(`glTF references missing file: ${uri}`)
    }
  }

  return uris
}

async function validateGltf (gltfPath) {
  const json = await readGltfJson(gltfPath)
  if (!Array.isArray(json.scenes) || json.scenes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one scene.')
  }
  if (!Array.isArray(json.meshes) || json.meshes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one mesh.')
  }
  if (!Array.isArray(json.nodes) || json.nodes.length === 0) {
    throw new Error('Sketchfab glTF validation failed: expected at least one node.')
  }

  const externalUris = await validateExternalReferences(json, dirname(gltfPath))
  return {
    type: 'gltf',
    scenes: json.scenes.length,
    nodes: json.nodes.length,
    meshes: json.meshes.length,
    materials: Array.isArray(json.materials) ? json.materials.length : 0,
    textures: Array.isArray(json.textures) ? json.textures.length : 0,
    images: Array.isArray(json.images) ? json.images.length : 0,
    buffers: Array.isArray(json.buffers) ? json.buffers.length : 0,
    externalFiles: externalUris.length
  }
}

async function validateGlb (glbPath) {
  const buffer = await readFile(glbPath)
  if (buffer.length < 20) throw new Error('GLB validation failed: file is too small.')
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('GLB validation failed: missing glTF magic header.')
  }
  const version = buffer.readUInt32LE(4)
  if (version !== 2) throw new Error(`GLB validation failed: expected version 2, received ${version}.`)
  return { type: 'glb', bytes: buffer.length, version }
}

async function validateInstalled (asset, targetDir) {
  const modelPath = targetModelPath(asset, targetDir)
  if (asset.format === 'glb') return validateGlb(modelPath)
  return validateGltf(modelPath)
}

async function installDirectory (asset, sourceModelPath, targetDir) {
  const sourceDir = dirname(sourceModelPath)
  const summary = asset.format === 'glb' ? await validateGlb(sourceModelPath) : await validateGltf(sourceModelPath)
  const tmpTarget = `${targetDir}.tmp`
  await rm(tmpTarget, { recursive: true, force: true })
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(dirname(targetDir), { recursive: true })
  await cp(sourceDir, tmpTarget, { recursive: true })

  const installedModel = targetModelPath(asset, tmpTarget)
  const copiedSource = join(tmpTarget, basename(sourceModelPath))
  if (basename(sourceModelPath) !== targetFileName(asset)) {
    await rename(copiedSource, installedModel)
  }

  await validateInstalled(asset, tmpTarget)
  await rename(tmpTarget, targetDir)
  return summary
}

async function installSingleGlb (asset, sourceGlb, targetDir) {
  const summary = await validateGlb(sourceGlb)
  const tmpTarget = `${targetDir}.tmp`
  await rm(tmpTarget, { recursive: true, force: true })
  await rm(targetDir, { recursive: true, force: true })
  await mkdir(tmpTarget, { recursive: true })
  await cp(sourceGlb, targetModelPath(asset, tmpTarget))
  await validateInstalled(asset, tmpTarget)
  await rename(tmpTarget, targetDir)
  return summary
}

async function installFromZip (asset, zipPath, targetDir) {
  const tempDir = await unzipToTemp(zipPath)
  try {
    const extension = asset.format === 'glb' ? '.glb' : '.gltf'
    const modelPath = await findModelFile(tempDir, extension, targetFileName(asset))
    if (asset.format === 'glb') return await installSingleGlb(asset, modelPath, targetDir)
    return await installDirectory(asset, modelPath, targetDir)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function installFromPath (asset, source, targetDir) {
  if (!source) throw new Error('Missing --from path.')
  const info = await stat(source)
  if (info.isDirectory()) {
    const extension = asset.format === 'glb' ? '.glb' : '.gltf'
    const modelPath = await findModelFile(source, extension, targetFileName(asset))
    const summary = asset.format === 'glb'
      ? await installSingleGlb(asset, modelPath, targetDir)
      : await installDirectory(asset, modelPath, targetDir)
    console.log(`Copied ${asset.label} Sketchfab ${asset.format} folder to ${targetDir}`)
    console.log(`Validated ${JSON.stringify(summary)}`)
    return
  }

  const ext = extname(source).toLowerCase()
  if (ext === '.zip') {
    const summary = await installFromZip(asset, source, targetDir)
    console.log(`Extracted ${asset.label} Sketchfab ${asset.format} ZIP to ${targetDir}`)
    console.log(`Validated ${JSON.stringify(summary)}`)
    return
  }
  if (ext === '.gltf' && asset.format === 'gltf') {
    const summary = await installDirectory(asset, source, targetDir)
    console.log(`Copied ${asset.label} Sketchfab glTF to ${targetDir}`)
    console.log(`Validated ${JSON.stringify(summary)}`)
    return
  }
  if (ext === '.glb' && asset.format === 'glb') {
    const summary = await installSingleGlb(asset, source, targetDir)
    console.log(`Copied ${asset.label} Sketchfab GLB to ${targetDir}`)
    console.log(`Validated ${JSON.stringify(summary)}`)
    return
  }

  throw new Error(`Expected a Sketchfab ${asset.format} .zip, extracted folder, or matching model file, received: ${source}`)
}

function buildAuthorizationHeader (token) {
  if (process.env.SKETCHFAB_AUTH_HEADER) return process.env.SKETCHFAB_AUTH_HEADER
  const scheme = process.env.SKETCHFAB_AUTH_SCHEME || 'Bearer'
  return `${scheme} ${token}`
}

async function downloadAsset (asset, token, targetDir) {
  const apiUrl = `https://api.sketchfab.com/v3/models/${asset.uid}/download`
  const data = await fetchJson(apiUrl, {
    headers: {
      Authorization: buildAuthorizationHeader(token),
      Accept: 'application/json'
    }
  })
  const archiveUrl = data?.[asset.format]?.url
  if (!archiveUrl) {
    throw new Error(`Sketchfab response did not include a ${asset.format}.url download for ${asset.label}.`)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'sketchfab-download-'))
  const zipPath = join(tempDir, `${asset.uid}-${asset.format}.zip`)
  try {
    await writeFile(zipPath, await downloadBuffer(archiveUrl))
    const summary = await installFromZip(asset, zipPath, targetDir)
    console.log(`Downloaded ${asset.label} Sketchfab ${asset.format} to ${targetDir}`)
    console.log(`Validated ${JSON.stringify(summary)}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function validateExisting (asset, targetDir) {
  const summary = await validateInstalled(asset, targetDir)
  console.log(`Validated existing ${asset.label} Sketchfab ${asset.format} at ${targetModelPath(asset, targetDir)}`)
  console.log(`Validated ${JSON.stringify(summary)}`)
}

async function main () {
  const args = parseArgs(process.argv.slice(2))
  const assets = await loadManifest(args.manifest)

  if (args.help) {
    printHelp(assets)
    return
  }
  if (args.from && args.asset === 'all') {
    throw new Error('--from can only install one asset at a time. Pass a concrete --asset id.')
  }
  if ((args.targetDir || args.target) && args.asset === 'all') {
    throw new Error('--target-dir/--target can only be used with one concrete --asset id.')
  }

  const selectedAssets = args.asset === 'all' ? assets : [resolveAsset(assets, args.asset)]
  if (selectedAssets.length === 0) {
    console.log('No Sketchfab assets are configured. Add entries to webapp/config/sketchfab-assets.json.')
    return
  }

  if (args.validateOnly) {
    for (const asset of selectedAssets) {
      // eslint-disable-next-line no-await-in-loop
      await validateExisting(asset, resolveTargetDir(asset, args.targetDir, args.target))
    }
    return
  }

  if (args.from) {
    const asset = selectedAssets[0]
    await installFromPath(asset, args.from, resolveTargetDir(asset, args.targetDir, args.target))
    return
  }

  const token = process.env.SKETCHFAB_TOKEN
  if (!token) {
    printHelp(assets)
    throw new Error('SKETCHFAB_TOKEN is required unless --from or --validate-only is provided.')
  }

  for (const asset of selectedAssets) {
    // eslint-disable-next-line no-await-in-loop
    await downloadAsset(asset, token, resolveTargetDir(asset))
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
