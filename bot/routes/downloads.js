import { Router } from 'express';
import archiver from 'archiver';
import path from 'path';
import { existsSync, mkdirSync, createWriteStream, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apkFileName = process.env.TELEGRAM_APK_FILE || 'tonplaygram-telegram-launcher.apk';
const apkRelativePath = path.join('downloads', apkFileName);
const envApkUrl = (process.env.TELEGRAM_APK_URL || process.env.VITE_TELEGRAM_APK_URL || '').trim();
const publicHint = 'Place the APK at webapp/public/downloads/ or set TELEGRAM_APK_URL.';
const codeBundleFile = process.env.TELEGRAM_CODE_BUNDLE || 'tonplaygram-source-bundle.zip';
const codeBundleRelativePath = path.join('downloads', codeBundleFile);
const repoRoot = path.join(__dirname, '../..');

function resolveLocalApk() {
  const distPath = path.join(__dirname, '../../webapp/dist', apkRelativePath);
  if (existsSync(distPath)) return distPath;
  const publicPath = path.join(__dirname, '../../webapp/public', apkRelativePath);
  if (existsSync(publicPath)) return publicPath;
  return null;
}

function ensureServedFile(localPath, relativePath) {
  const distTarget = path.join(__dirname, '../../webapp/dist', relativePath);
  if (!existsSync(distTarget)) {
    mkdirSync(path.dirname(distTarget), { recursive: true });
    copyFileSync(localPath, distTarget);
  }
  return distTarget;
}

function originFromRequest(req) {
  return (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

async function generateCodeBundle(targetPath) {
  return new Promise((resolve, reject) => {
    mkdirSync(path.dirname(targetPath), { recursive: true });
    const output = createWriteStream(targetPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve(targetPath));
    archive.on('error', reject);

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: repoRoot,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.env*',
        'webapp/dist/**',
        'webapp/public/downloads/**',
        '**/*.log',
        'billiards.Unity/**'
      ]
    });

    archive.finalize();
  });
}

async function ensureCodeBundle() {
  const distPath = path.join(__dirname, '../../webapp/dist', codeBundleRelativePath);
  if (existsSync(distPath)) return { path: distPath, source: 'dist' };

  const publicPath = path.join(__dirname, '../../webapp/public', codeBundleRelativePath);
  if (existsSync(publicPath)) {
    ensureServedFile(publicPath, codeBundleRelativePath);
    return { path: distPath, source: 'public' };
  }

  await generateCodeBundle(publicPath);
  ensureServedFile(publicPath, codeBundleRelativePath);
  return { path: distPath, source: 'generated' };
}

router.get('/apk', async (req, res) => {
  if (envApkUrl) {
    return res.json({ url: envApkUrl, source: 'env' });
  }

  try {
    const localApk = resolveLocalApk();
    if (localApk) {
      ensureServedFile(localApk, apkRelativePath);
      const origin = originFromRequest(req);
      const normalizedPath = apkRelativePath.replace(/\\/g, '/');
      return res.json({
        url: `${origin}/${normalizedPath}`,
        source: localApk.includes('/dist/') ? 'dist' : 'public'
      });
    }

    const bundle = await ensureCodeBundle();
    const origin = originFromRequest(req);
    const normalizedPath = codeBundleRelativePath.replace(/\\/g, '/');
    return res.json({
      url: `${origin}/${normalizedPath}`,
      source: bundle.source,
      type: 'zip',
      message: 'Fallback code bundle without private credentials or node_modules.'
    });
  } catch (err) {
    console.error('Failed to resolve apk download:', err);
    return res.status(500).json({
      error: 'Failed to build download link',
      hint: publicHint
    });
  }
});

export default router;
