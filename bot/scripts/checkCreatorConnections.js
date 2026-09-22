import { catalog, credentials } from '../creator/catalog.js';
import { configured, publicOrigin } from '../creator/security.js';
const storageReady = configured();
const origin = publicOrigin();
const platforms = catalog().map(platform => {
  const pair = credentials(platform.id);
  return {
    platform: platform.name,
    clientIdConfigured: Boolean(pair?.id),
    clientSecretConfigured: Boolean(pair?.secret),
    secureStorageConfigured: storageReady,
    ...(platform.id === 'tiktok' ? { directPostApprovalConfirmed: process.env.CREATOR_TIKTOK_APPROVED === 'true' } : {}),
    configurationReady: platform.available,
    callback: `${origin}/api/creator/oauth/${platform.id}/callback`
  };
});
console.log(JSON.stringify({ notice: 'Configuration presence only. Test official consent with approved accounts before launch.', platforms }, null, 2));
