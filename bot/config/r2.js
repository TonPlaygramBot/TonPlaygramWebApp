import { S3Client } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID || ''

// Server-only client for future R2 operations. Never import this file in webapp/.
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined,
  credentials:
    process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
      : undefined
})

export const r2BucketName = process.env.R2_BUCKET_NAME || ''
export const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '')
