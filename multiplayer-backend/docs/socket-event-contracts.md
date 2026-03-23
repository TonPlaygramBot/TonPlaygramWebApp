# Socket Event Contracts

Authentication uses `handshake.auth.token` formatted as `userId:username` or `userId:username:tpcAccountNumber`.
When `tpcAccountNumber` is present (either in token or `handshake.auth.tpcAccountNumber`), it becomes the canonical user identity used for lobby tracking, queueing, and room seating.

## Client -> Server
- `player:queue_join`
  - `{ gameMode: string, region?: string, tpcAccountNumber?: string }`
- `player:queue_leave`
  - `void`
- `room:create`
  - `{ isPrivate: boolean }`
- `room:join`
  - `{ roomCode: string }`
- `room:leave`
  - `void`
- `match:action`
  - `{ matchId: string, tick: number, actionType: 'MOVE' | 'ATTACK' | 'DEFEND' | 'END_TURN', actionData: Record<string, unknown> }`
- `match:end`
  - `{ matchId: string, winnerUserId: string, scoreByUser: Record<string, number>, reason: 'normal' | 'forfeit' | 'timeout' }`
- `ping`
  - `void`

## Server -> Client
- `player:connect`
  - `{ userId: string, socketId: string }`
- `player:disconnect`
  - `{ userId: string }`
- `player:reconnect`
  - `{ userId: string, matchId?: string }`
- `match:found`
  - `{ matchId: string, roomCode: string, opponentUserId: string }`
- `match:start`
  - `{ matchId: string, initialState: MatchState }`
- `match:state_update`
  - `MatchState`
- `match:validated_action`
  - `{ matchId: string, tick: number, accepted: boolean }`
- `match:end`
  - `MatchResultPayload`
- `error`
  - `{ code: string, message: string, details?: unknown }`
