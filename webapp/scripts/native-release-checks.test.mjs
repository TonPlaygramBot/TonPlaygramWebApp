import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, access, symlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { auditNativePackage, publicHttpsUrl } from './audit-native-package.mjs'
import { pruneNativeGamePacks } from './prune-native-game-packs.mjs'
import { isPinnedWrapper, WRAPPER_SHA256 } from './fetch-gradle-wrapper.mjs'
async function fixture (t, assets = [{ url: '/assets/game/model.glb', sourceUrl: 'https://cdn.example.test/assets/game/model.glb' }]) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'native-release-')); t.after(() => rm(dir, { recursive: true, force: true }))
  const put = async (p, data) => { await mkdir(path.dirname(path.join(dir, p)), { recursive: true }); await writeFile(path.join(dir, p), typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data)) }
  await put('index.html', '<!doctype html><html>shell</html>'); await put('assets/game/model.glb', Buffer.alloc(4096)); await put('cover.png', 'cover')
  await put('pwa/game-packs/index.json', { source: 'cdn', packs: [{ id: 'game', cover: '/cover.png', manifestUrl: '/pwa/game-packs/game.json' }] })
  await put('pwa/game-packs/game.json', { assets }); return { dir, put }
}
test('prune validates CDN, removes only removable build assets, preserves shell/cover and audits remaining bytes', async t => {
  const { dir } = await fixture(t, [{ url: '/assets/game/model.glb', sourceUrl: 'https://cdn.example.test/model.glb' }, { url: '/cover.png', sourceUrl: '/cover.png' }, { url: '/index.html', sourceUrl: '/index.html', nativeRemovable: false }])
  const result = await pruneNativeGamePacks({ distDir: dir }); assert.equal(result.removedBytes, 4096); assert.equal(result.removedFiles, 1)
  await assert.rejects(access(path.join(dir, 'assets/game/model.glb'))); await access(path.join(dir, 'cover.png')); await access(path.join(dir, 'index.html'))
  const audit = await auditNativePackage({ distDir: dir, maxBytes: 10000 }); assert.ok(audit.bytes < 4096); assert.ok(audit.files >= 4)
  assert.equal((await pruneNativeGamePacks({ distDir: dir })).removedFiles, 0)
})
test('invalid late source rejects before deleting earlier valid output', async t => {
  const { dir } = await fixture(t, [{ url: '/assets/game/model.glb', sourceUrl: 'https://cdn.example.test/model.glb' }, { url: '/bad.glb', sourceUrl: 'http://bad.test/bad.glb' }])
  await assert.rejects(pruneNativeGamePacks({ distDir: dir }), /HTTPS CDN/); await access(path.join(dir, 'assets/game/model.glb'))
})
test('manifest traversal cannot read or prune an external file', async t => {
  const { dir, put } = await fixture(t); await put('pwa/game-packs/index.json', { source: 'cdn', packs: [{ manifestUrl: '/../escape.json' }] })
  await assert.rejects(pruneNativeGamePacks({ distDir: dir }), /escapes/); await access(path.join(dir, 'assets/game/model.glb'))
})
test('symlink asset or directory cannot delete outside generated dist', async t => {
  const { dir, put } = await fixture(t); const external = await mkdtemp(path.join(os.tmpdir(), 'native-external-')); t.after(() => rm(external, { recursive: true, force: true })); await writeFile(path.join(external, 'keep.glb'), 'keep')
  await symlink(external, path.join(dir, 'linked'))
  await put('pwa/game-packs/game.json', { assets: [{ url: '/linked/keep.glb', sourceUrl: 'https://cdn.example.test/keep.glb' }] })
  await assert.rejects(pruneNativeGamePacks({ distDir: dir }), /escapes/); assert.equal(await readFile(path.join(external, 'keep.glb'), 'utf8'), 'keep')
})
test('same-origin builds are not silently pruned', async t => {
  const { dir, put } = await fixture(t); await put('pwa/game-packs/index.json', { source: 'same-origin', packs: [] })
  await assert.rejects(pruneNativeGamePacks({ distDir: dir }), /Refusing/); await access(path.join(dir, 'assets/game/model.glb'))
})
test('native audit rejects missing report, empty shell, oversized output and symlinks', async t => {
  const { dir, put } = await fixture(t); await assert.rejects(auditNativePackage({ distDir: dir }), /ENOENT/)
  await pruneNativeGamePacks({ distDir: dir }); await assert.rejects(auditNativePackage({ distDir: dir, maxBytes: 10 }), /exceeds budget/)
  await symlink('index.html', path.join(dir, 'alias.html')); await assert.rejects(auditNativePackage({ distDir: dir }), /symlink/); await rm(path.join(dir, 'alias.html'))
  await put('index.html', ''); await assert.rejects(auditNativePackage({ distDir: dir }), /empty/)
})
test('public CDN configuration rejects credentials, fragments and non-HTTPS', () => {
  for (const value of ['', undefined, 'http://cdn.test', 'https://u:secret@cdn.test', 'https://cdn.test/path?token=abc', 'https://cdn.test/#part'])assert.equal(publicHttpsUrl(value), false)
  assert.equal(publicHttpsUrl('https://cdn.example.test/release-1'), true)
})
test('wrapper pin rejects zip-header spoof and toolchain stays coherent with API36', async () => {
  assert.equal(isPinnedWrapper(Buffer.from('PK\x03\x04untrusted')), false); assert.match(WRAPPER_SHA256, /^[a-f0-9]{64}$/)
  const gradle = await readFile(new URL('../android/build.gradle', import.meta.url), 'utf8'); const wrapper = await readFile(new URL('../android/gradle/wrapper/gradle-wrapper.properties', import.meta.url), 'utf8')
  assert.match(gradle, /com.android.tools.build:gradle:8\.10\.1/); assert.match(wrapper, /gradle-8\.11\.1-bin.zip/); assert.match(wrapper, /distributionSha256Sum=f397b287023acdba1e9f6fc5ea72d22dd63669d59ed4a289a29b1a76eee151c6/)
})
test('signed-store workflow requires CDN native-lite path and compile CI never publishes fixture APK', async () => {
  const root = new URL('../../.github/workflows/', import.meta.url); const release = await readFile(new URL('android-store-release.yml', root), 'utf8'); const check = await readFile(new URL('android-toolchain-check.yml', root), 'utf8')
  assert.match(release, /GAME_PACK_CDN_BASE_URL/); assert.match(release, /run build:native-lite/); assert.match(release, /publicHttpsUrl/)
  assert.match(check, /testDebugUnitTest lintDebug assembleDebug/); assert.doesNotMatch(check, /uses: actions\/upload-artifact|uses: softprops\/action-gh-release/)
})

test('CDN configuration rejects local hosts and all literal IP address variants', () => {
  for (const host of ['localhost', 'localhost.', 'cdn.localhost', 'cdn.local', 'cdn.internal', 'router.home.arpa', 'intranet', '127.0.0.1', '127.1', '2130706433', '0x7f000001', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '[::1]', '[::]', '[fd00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '8.8.8.8', '[2606:4700:4700::1111]']) {
    assert.equal(publicHttpsUrl(`https://${host}/assets`), false, host)
  }
  assert.equal(publicHttpsUrl('https://cdn.example.com/assets'), true)
})
