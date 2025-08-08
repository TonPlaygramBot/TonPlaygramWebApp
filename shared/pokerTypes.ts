export type StakeTier = 100 | 500 | 1000 | 5000 | 10000;
export type SeatsOption = 2 | 4 | 6 | 9;

export type Card = `${'A'|'K'|'Q'|'J'|'T'|'9'|'8'|'7'|'6'|'5'|'4'|'3'|'2'}${'h'|'d'|'c'|'s'}`;

export interface PlayerState {
  id: string;
  stack: number;
  bet: number;
  folded: boolean;
  hole?: Card[];
}

export interface TableState {
  roomId: string;
  stake: StakeTier;
  seats: SeatsOption;
  players: PlayerState[];
  board: Card[];
  pot: number;
  minRaise: number;
  activePlayerId?: string;
  handFinished?: boolean;
}

export type PlayerAction =
  | { type: 'FOLD' }
  | { type: 'CHECK_CALL' }
  | { type: 'RAISE'; amount: number };

export interface JoinRoomPayload {
  stake: StakeTier;
  seats: SeatsOption;
}

export enum ServerEvent {
  TABLE_UPDATE = 'TABLE_UPDATE',
}

export enum ClientEvent {
  JOIN_ROOM = 'JOIN_ROOM',
  PLAYER_ACTION = 'PLAYER_ACTION',
  START_HAND = 'START_HAND',
}
