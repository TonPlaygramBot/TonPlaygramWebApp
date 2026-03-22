import { MatchStatus, ParticipantResult } from '@prisma/client';
import { prisma } from '../db/prisma.js';
export async function createMatch(params) {
    return prisma.match.create({
        data: {
            roomCode: params.roomCode,
            status: MatchStatus.PENDING,
            participants: {
                create: params.players.map((player) => ({
                    userId: player.userId,
                    role: player.role,
                })),
            },
            roomMetadata: {
                create: {
                    roomCode: params.roomCode,
                    isPrivate: params.isPrivate,
                    createdByUser: params.createdByUser,
                },
            },
        },
        include: { participants: true },
    });
}
export async function startMatch(matchId, stateSnapshot) {
    return prisma.match.update({
        where: { id: matchId },
        data: {
            status: MatchStatus.ACTIVE,
            startedAt: new Date(),
            stateSnapshot,
        },
    });
}
export async function finishMatch(payload) {
    const participants = await prisma.matchParticipant.findMany({
        where: { matchId: payload.matchId },
    });
    await Promise.all(participants.map((participant) => prisma.matchParticipant.update({
        where: { id: participant.id },
        data: {
            score: payload.scoreByUser[participant.userId] ?? 0,
            result: participant.userId === payload.winnerUserId ? ParticipantResult.WIN : ParticipantResult.LOSS,
        },
    })));
    return prisma.match.update({
        where: { id: payload.matchId },
        data: {
            status: MatchStatus.FINISHED,
            winnerUserId: payload.winnerUserId,
            endedAt: new Date(),
            resultSummary: payload.resultSummary,
            stateSnapshot: payload.resultSummary,
        },
    });
}
export async function listMatchHistory(userId, limit = 20) {
    return prisma.matchParticipant.findMany({
        where: { userId },
        include: { match: true },
        orderBy: { updatedAt: 'desc' },
        take: limit,
    });
}
