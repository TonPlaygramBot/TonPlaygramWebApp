import gamesCatalog from '../config/gamesCatalog.js';

const GAME_SLUGS = new Set(gamesCatalog.map(({ slug }) => slug));

export function normalizeInviteGame(game) {
  const slug = String(game || '').trim().toLowerCase();
  return GAME_SLUGS.has(slug) ? slug : 'snake';
}

/**
 * Invite matches bypass the regular lobby, so include the multiplayer fields
 * understood by both the older (`table`) and newer (`tableId`) game screens.
 */
export function getGameInvitePath(invite = {}) {
  const game = normalizeInviteGame(invite.game);
  const params = new URLSearchParams();
  const roomId = String(invite.roomId || '').trim();
  const capacity = Math.max(2, Number(invite.capacity) || (Array.isArray(invite.group) ? invite.group.length + 1 : 2));

  if (roomId) {
    params.set('table', roomId);
    params.set('tableId', roomId);
  }
  params.set('mode', 'online');
  params.set('capacity', String(capacity));
  params.set('players', String(capacity));
  params.set('type', 'regular');
  if (invite.inviteAccept) params.set('inviteAccept', '1');
  if (invite.token) params.set('token', String(invite.token));
  if (invite.amount !== undefined && invite.amount !== null && invite.amount !== '') {
    params.set('amount', String(invite.amount));
  }

  return `/games/${game}?${params.toString()}`;
}
