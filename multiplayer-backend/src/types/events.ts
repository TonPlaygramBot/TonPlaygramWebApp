export type MatchActionType = 'MOVE' | 'ATTACK' | 'DEFEND' | 'END_TURN';

export interface SocketUser {
  id: string;
  username: string;
}

export interface JoinQueuePayload {
  gameMode: string;
  region?: string;
}

export interface RoomCreatePayload {
  isPrivate: boolean;
}

export interface RoomJoinPayload {
  roomCode: string;
}

export interface MatchActionPayload {
  matchId: string;
  tick: number;
  actionType: MatchActionType;
  actionData: Record<string, unknown>;
}

export interface MatchState {
  matchId: string;
  tick: number;
  currentTurnUserId: string;
  scores: Record<string, number>;
  status: 'ACTIVE' | 'ENDED';
  updatedAt: number;
}

export interface MatchResultPayload {
  matchId: string;
  winnerUserId: string;
  scoreByUser: Record<string, number>;
  reason: 'normal' | 'forfeit' | 'timeout';
}

export interface RealtimeError {
  code: string;
  message: string;
  details?: unknown;
}
