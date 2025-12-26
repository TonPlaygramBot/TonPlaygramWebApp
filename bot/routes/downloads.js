import { Router } from 'express';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apkFileName = process.env.TELEGRAM_APK_FILE || 'tonplaygram-telegram-launcher.apk';
const apkRelativePath = path.join('downloads', apkFileName);
const envApkUrl = (process.env.TELEGRAM_APK_URL || process.env.VITE_TELEGRAM_APK_URL || '').trim();
const publicHint = 'Place the APK at webapp/public/downloads/ or set TELEGRAM_APK_URL.';

function resolveLocalApk() {
  const distPath = path.join(__dirname, '../../webapp/dist', apkRelativePath);
  if (existsSync(distPath)) return distPath;
  const publicPath = path.join(__dirname, '../../webapp/public', apkRelativePath);
  if (existsSync(publicPath)) return publicPath;
  return null;
}

router.get('/apk', (req, res) => {
  if (envApkUrl) {
    return res.json({ url: envApkUrl, source: 'env' });
  }

  const localApk = resolveLocalApk();
  if (localApk) {
    const origin =
      (process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const normalizedPath = apkRelativePath.replace(/\\/g, '/');
    return res.json({
      url: `${origin}/${normalizedPath}`,
      source: localApk.includes('/dist/') ? 'dist' : 'public'
    });
  }

  return res.status(404).json({
    error: 'APK link not configured',
    hint: publicHint
  });
});

export default router;
