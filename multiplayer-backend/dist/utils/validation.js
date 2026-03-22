import { z } from 'zod';
export const queueJoinSchema = z.object({
    gameMode: z.string().min(2).max(32),
    region: z.string().min(2).max(16).optional(),
});
export const roomCreateSchema = z.object({
    isPrivate: z.boolean(),
});
export const roomJoinSchema = z.object({
    roomCode: z.string().length(6),
});
export const matchActionSchema = z.object({
    matchId: z.string().min(1),
    tick: z.number().int().nonnegative(),
    actionType: z.enum(['MOVE', 'ATTACK', 'DEFEND', 'END_TURN']),
    actionData: z.record(z.unknown()),
});
export const matchResultSchema = z.object({
    matchId: z.string().min(1),
    winnerUserId: z.string().min(1),
    scoreByUser: z.record(z.number().int()),
    reason: z.enum(['normal', 'forfeit', 'timeout']),
});
