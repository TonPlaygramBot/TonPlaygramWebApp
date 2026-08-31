import { describe, expect, it } from 'vitest';
import { normalizeSocialProfile } from './socialProfileLinks.js';

describe('normalizeSocialProfile', () => {
  it('turns a username into an official Instagram profile link', () => {
    expect(normalizeSocialProfile('instagram', '@tonplaygram')).toEqual({ accountName: '@tonplaygram', profileUrl: 'https://www.instagram.com/tonplaygram/' });
  });
  it('converts an official Twitter URL to the current X domain', () => {
    expect(normalizeSocialProfile('x', 'https://twitter.com/TonPlaygram')).toEqual({ accountName: '@TonPlaygram', profileUrl: 'https://x.com/TonPlaygram' });
  });
  it('rejects links from a different website', () => {
    expect(normalizeSocialProfile('tiktok', 'https://example.com/fake').error).toMatch(/valid username/i);
  });
  it('requires a numeric Discord user id', () => {
    expect(normalizeSocialProfile('discord', 'my-name').error).toMatch(/numeric User ID/);
  });
});
