import { MapSchema, Schema, type } from '@colyseus/schema';

export class LobbyPlayer extends Schema {
  @type('string') accountId = '';
  @type('string') name = '';
  @type('string') avatar = '';
  @type('boolean') ready = false;
  @type('boolean') connected = true;
  @type('number') joinedAt = 0;
  @type('string') maskedAccount = '';
}

export class ChessLobbyState extends Schema {
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
  @type('string') phase: 'waiting' | 'countdown' | 'playing' = 'waiting';
  @type('string') visibility: 'public' | 'private' = 'public';
  @type('string') invitationCode = '';
  @type('number') minPlayers = 2;
  @type('number') maxPlayers = 2;
  @type('number') countdownEndsAt = 0;
  @type('number') createdAt = Date.now();
  @type('number') stake = 0;
  @type('string') token = 'TPG';
  @type('string') tableNumber = '';
  @type('string') matchId = '';
  @type('boolean') stakesReserved = false;
}
