import { describe, expect, it } from 'vitest';
import { extractSocketUser } from '../src/ws/socketAuth.js';

describe('extractSocketUser', () => {
  it('uses tpc account number from token as canonical identity', () => {
    const socket = {
      handshake: {
        auth: {
          token: 'telegram-123:alice:TPC-999',
        },
      },
    } as any;

    const user = extractSocketUser(socket);
    expect(user).toEqual({
      id: 'telegram-123',
      canonicalUserId: 'TPC-999',
      username: 'alice',
      tpcAccountNumber: 'TPC-999',
    });
  });

  it('prefers explicit handshake tpc account number when provided', () => {
    const socket = {
      handshake: {
        auth: {
          token: 'google-456:bob',
          tpcAccountNumber: 'TPC-888',
        },
      },
    } as any;

    const user = extractSocketUser(socket);
    expect(user?.canonicalUserId).toBe('TPC-888');
  });

  it('falls back to provider identity if tpc account number is absent', () => {
    const socket = {
      handshake: {
        auth: {
          token: 'google-456:bob',
        },
      },
    } as any;

    const user = extractSocketUser(socket);
    expect(user?.canonicalUserId).toBe('google-456');
  });
});
