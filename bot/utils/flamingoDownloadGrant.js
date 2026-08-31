import { createHmac, timingSafeEqual } from 'crypto'

const grantSecret = () => process.env.FLAMINGO_DOWNLOAD_SECRET ||
  process.env.API_AUTH_TOKEN ||
  process.env.BOT_TOKEN ||
  'tonplaygram-local-download-secret'

const signatureFor = payload => createHmac('sha256', grantSecret()).update(payload).digest('base64url')

// Download links must survive an API restart and may be opened by a different
// instance behind a load balancer. A signed, short-lived token keeps all grant
// state in the URL instead of in one Node process's memory.
export const createFlamingoDownloadGrant = (details, now = Date.now()) => {
  const payload = Buffer.from(JSON.stringify({ ...details, expiresAt: now + 5 * 60_000 })).toString('base64url')
  return `${payload}.${signatureFor(payload)}`
}

export const readFlamingoDownloadGrant = (token, now = Date.now()) => {
  const [payload, suppliedSignature, extra] = String(token || '').split('.')
  if (!payload || !suppliedSignature || extra) return null
  const expectedSignature = signatureFor(payload)
  const supplied = Buffer.from(suppliedSignature)
  const expected = Buffer.from(expectedSignature)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
  try {
    const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!grant.file || !Number.isFinite(grant.expiresAt) || grant.expiresAt < now) return null
    return grant
  } catch {
    return null
  }
}
