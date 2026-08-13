export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube', 'x', 'threads'];

const limits = {
  instagram: { caption: 2200, mime: ['image/', 'video/'], mediaRequired: true },
  facebook: { caption: 63206, mime: ['image/', 'video/'] },
  tiktok: { caption: 2200, mime: ['video/'], mediaRequired: true },
  youtube: { caption: 5000, mime: ['video/'], mediaRequired: true, titleRequired: true },
  x: { caption: 280, mime: ['image/', 'video/'] },
  threads: { caption: 500, mime: ['image/', 'video/'] }
};

export function validateSocialContent(platform, content) {
  const rule = limits[platform];
  if (!rule) return { ready: false, errors: ['Unsupported provider'] };
  const override = content.overrides?.[platform] || {};
  const caption = typeof override === 'string' ? override : override.caption || content.caption || '';
  const errors = [];
  if (caption.length > rule.caption) errors.push(`Caption exceeds maximum length (${rule.caption})`);
  if (rule.titleRequired && !override.title) errors.push('Title required');
  if (rule.mediaRequired && !content.media?.length) errors.push('Media required');
  for (const media of content.media || []) {
    if (media.mimeType && !rule.mime.some((prefix) => media.mimeType.startsWith(prefix))) {
      errors.push(`${media.mimeType} is not supported`);
    }
  }
  return { ready: errors.length === 0, errors };
}

class MockProvider {
  constructor(platform) { this.platform = platform; }
  async validate(content) { return validateSocialContent(this.platform, content); }
  async publish(content) {
    const validation = await this.validate(content);
    if (!validation.ready) {
      const error = new Error(validation.errors.join('; '));
      error.type = 'VALIDATION_ERROR';
      throw error;
    }
    const behavior = process.env[`SOCIAL_MOCK_${this.platform.toUpperCase()}_RESULT`] || 'success';
    if (behavior !== 'success') {
      const error = new Error(behavior === 'auth_failure' ? 'Mock credential expired' : 'Mock provider failure');
      error.type = behavior === 'retryable_failure' ? 'RETRYABLE_ERROR' : behavior === 'auth_failure' ? 'AUTH_ERROR' : 'PERMANENT_ERROR';
      throw error;
    }
    const externalId = `mock-${this.platform}-${Date.now()}`;
    return { externalId, publicationUrl: `https://example.test/${this.platform}/${externalId}` };
  }
}

export function getSocialProvider(platform) {
  if (!SOCIAL_PLATFORMS.includes(platform)) throw new Error('Unsupported provider');
  if ((process.env.SOCIAL_PROVIDER_MODE || 'mock') !== 'mock') {
    const error = new Error(`${platform} official API credentials/adapter not configured`);
    error.type = 'AUTH_ERROR';
    throw error;
  }
  return new MockProvider(platform);
}
