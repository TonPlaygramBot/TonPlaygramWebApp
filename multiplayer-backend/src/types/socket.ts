import type { MatchActionPayload, MatchResultPayload, MatchState, JoinQueuePayload, RoomCreatePayload, RoomJoinPayload, RealtimeError } from './events.js';

export interface ServerToClientEvents {
  'player:connect': (payload: { userId: string; socketId: string }) => void;
  'match:found': (payload: { matchId: string; roomCode: string; opponentUserId: string }) => void;
  'match:start': (payload: { matchId: string; initialState: MatchState }) => void;
  'match:state_update': (payload: MatchState) => void;
  'match:validated_action': (payload: { matchId: string; tick: number; accepted: boolean }) => void;
  'match:end': (payload: MatchResultPayload) => void;
  'player:disconnect': (payload: { userId: string }) => void;
  'player:reconnect': (payload: { userId: string; matchId?: string }) => void;
  error: (payload: RealtimeError) => void;
}

export interface ClientToServerEvents {
  'player:queue_join': (payload: JoinQueuePayload) => void;
  'player:queue_leave': () => void;
  'room:create': (payload: RoomCreatePayload) => void;
  'room:join': (payload: RoomJoinPayload) => void;
  'room:leave': () => void;
  'match:action': (payload: MatchActionPayload) => void;
  'match:end': (payload: MatchResultPayload) => void;
  ping: () => void;
}
