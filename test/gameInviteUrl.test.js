import { getGameInvitePath, normalizeInviteGame } from '../webapp/src/utils/gameInviteUrl.js';

describe('game invite URLs', () => {
  it('opens a one-versus-one invite on the exact online table', () => {
    const path = getGameInvitePath({
      game: 'ludobattleroyal',
      roomId: 'invite-host-guest-123-2',
      token: 'TPG',
      amount: 25
    });
    const url = new URL(path, 'https://tonplaygram.test');

    expect(url.pathname).toBe('/games/ludobattleroyal');
    expect(url.searchParams.get('table')).toBe('invite-host-guest-123-2');
    expect(url.searchParams.get('tableId')).toBe('invite-host-guest-123-2');
    expect(url.searchParams.get('mode')).toBe('online');
    expect(url.searchParams.get('capacity')).toBe('2');
    expect(url.searchParams.get('players')).toBe('2');
  });

  it('keeps unsupported notification slugs on an existing route', () => {
    expect(normalizeInviteGame('../missing-page')).toBe('snake');
    expect(getGameInvitePath({ game: '../missing-page', roomId: 'room-2' }))
      .toMatch(/^\/games\/snake\?/);
  });

  it('keeps standalone campaigns out of multiplayer invites', () => {
    expect(normalizeInviteGame('black-tide')).toBe('snake');
  });

  it('preserves the player count for group invites', () => {
    const url = new URL(getGameInvitePath({ roomId: 'group-room', capacity: 4 }), 'https://tonplaygram.test');
    expect(url.searchParams.get('capacity')).toBe('4');
    expect(url.searchParams.get('players')).toBe('4');
  });
});
