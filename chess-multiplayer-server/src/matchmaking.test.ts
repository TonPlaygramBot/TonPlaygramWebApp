import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { chessServerConfig } from './app.config.js';

const options = (accountId: string) => ({ accountId, name: accountId, visibility: 'public' as const, invitationCode: '', stake: 100, token: 'TPG' });
const waitForPatch = () => new Promise((resolve) => setTimeout(resolve, 80));

describe('chess_lobby matchmaking', () => {
  let server: ColyseusTestServer;

  beforeAll(async () => { server = await boot(chessServerConfig as any); });
  afterAll(async () => { await server.shutdown(); });

  it('pairs two clients, reserves both seats, assigns opposite colours, and seats a third separately', async () => {
    const first = await server.sdk.joinOrCreate('chess_lobby', options('first'));
    await waitForPatch();
    expect(first.state.players.size).toBe(1);

    const second = await server.sdk.joinOrCreate('chess_lobby', options('second'));
    await waitForPatch();
    expect(second.roomId).toBe(first.roomId);
    expect(first.state.players.size).toBe(2);

    const third = await server.sdk.joinOrCreate('chess_lobby', options('third'));
    await waitForPatch();
    expect(third.roomId).not.toBe(first.roomId);
    expect(third.state.players.size).toBe(1);

    const firstStarted = new Promise<any>((resolve) => first.onMessage('match_start', resolve));
    const secondStarted = new Promise<any>((resolve) => second.onMessage('match_start', resolve));
    await waitForPatch();
    expect(first.state.phase).toBe('countdown');
    const [firstMatch, secondMatch] = await Promise.all([firstStarted, secondStarted]);
    expect(firstMatch.roomId).toBe(first.roomId);
    expect(secondMatch.roomId).toBe(first.roomId);
    expect(firstMatch.players.map((player: any) => player.side).sort()).toEqual(['black', 'white']);
    expect(secondMatch.players).toEqual(firstMatch.players);

    await Promise.all([first.leave(true), second.leave(true), third.leave(true)]);
  }, 8_000);
});
