import { MapSchema, Schema, type } from '@colyseus/schema';

export class LobbyPlayer extends Schema {
  @type('string') accountId = '';
  @type('string') name = '';
  @type('string') avatar = '';
  @type('boolean') ready = false;
  @type('boolean') connected = true;
  @type('number') joinedAt = 0;
}

export class ChessLobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
  @type('string') phase: 'waiting' | 'countdown' | 'playing' = 'waiting';
  @type('string') visibility: 'public' | 'private' = 'public';
  @type('string') invitationCode = '';
  @type('number') minPlayers = 4;
  @type('number') maxPlayers = 8;
  @type('number') countdownEndsAt = 0;
  @type('number') createdAt = Date.now();
}
