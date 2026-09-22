import { catalog, credentialConfiguration } from './catalog.js';
import { googleSignInStatus } from './googleSignIn.js';
import { configured, publicOrigin } from './security.js';

export function creatorConfigurationReport() {
  const secureStorageConfigured = configured();
  let origin;
  try { origin = publicOrigin(); } catch { origin = null; }
  return {
    version: 1,
    notice: 'Configuration presence only. Approved developer apps and real account consent are still required.',
    googleIdentityConfigured: googleSignInStatus().available,
    platforms: catalog().map(platform => ({
      platform: platform.id,
      ...credentialConfiguration(platform.id),
      secureStorageConfigured,
      configurationReady: platform.available,
      setupReason: platform.setupReason,
      ...(platform.id === 'tiktok' ? { directPostApprovalConfirmed: process.env.CREATOR_TIKTOK_APPROVED === 'true' } : {}),
      callback: origin ? `${origin}/api/creator/oauth/${platform.id}/callback` : null
    }))
  };
}

export function logCreatorConfiguration(logger = console.log) {
  let report;
  try { report = creatorConfigurationReport(); }
  catch { report = { version: 1, setupReason: 'report_unavailable' }; }
  // Never log exception messages: they can contain provider or environment data.
  logger(`[creator-config] ${JSON.stringify(report)}`);
}
