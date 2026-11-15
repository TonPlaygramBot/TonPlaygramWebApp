import { beforeEach, describe, expect, it } from 'vitest';
import { clearGoogleProfile, loadGoogleCredential, storeGoogleCredential, storeGoogleProfile } from './google.js';
const credential = (claims) => `header.${btoa(JSON.stringify(claims))}.signature`;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
describe('Google social credentials', () => {
  it('retains signed credential only in the tab session, separate from the display profile', () => {
    storeGoogleProfile({ id: 'person' });
    const token = credential({ sub: 'person', exp: Math.floor(Date.now() / 1000) + 3600 });
    storeGoogleCredential(token);
    expect(loadGoogleCredential()).toBe(token);
    expect(Object.values(localStorage).join('')).not.toContain(token);
    clearGoogleProfile();
    expect(loadGoogleCredential()).toBe('');
  });
  it('does not mistake a stored Google ID or display profile for proof of sign-in', () => {
    storeGoogleProfile({ id: 'person' });
    expect(loadGoogleCredential()).toBe('');
  });
  it('drops expired, malformed and mismatched account credentials', () => {
    storeGoogleProfile({ id: 'person' });
    for (const token of ['bad', credential({ sub: 'person', exp: 1 }), credential({ sub: 'someone-else', exp: Math.floor(Date.now() / 1000) + 3600 })]) {
      storeGoogleCredential(token);
      expect(loadGoogleCredential()).toBe('');
    }
  });
});
