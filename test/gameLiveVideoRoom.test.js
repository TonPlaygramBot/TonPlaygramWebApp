import { buildGameLiveChatRoomId } from '../webapp/src/utils/liveVideoRoom.js';
import { readFile } from 'node:fs/promises';

describe('Chess Battle Royal live video room', () => {
  test('uses the shared online match table rather than a player account', () => {
    const firstPlayerParams = new URLSearchParams('tableId=chess-table-42&accountId=1001');
    const secondPlayerParams = new URLSearchParams('tableId=chess-table-42&accountId=2002');

    expect(buildGameLiveChatRoomId('chessbattleroyal', firstPlayerParams)).toBe(
      buildGameLiveChatRoomId('chessbattleroyal', secondPlayerParams)
    );
    expect(buildGameLiveChatRoomId('chessbattleroyal', firstPlayerParams)).toBe(
      'live-chessbattleroyal-chess-table-42'
    );
  });

  test('keeps separate matches in separate video rooms', () => {
    expect(buildGameLiveChatRoomId('chessbattleroyal', new URLSearchParams('table=alpha')))
      .not.toBe(buildGameLiveChatRoomId('chessbattleroyal', new URLSearchParams('table=beta')));
  });
});

describe('Pool Royale live video avatar', () => {
  test('marks the local online avatar as the live-call anchor', async () => {
    const source = await readFile('webapp/src/pages/Games/PoolRoyale.jsx', 'utf8');
    const onlineAvatarBranch = source.match(
      /\{isOnlineMatch \? \([\s\S]*?\) : \(/u
    )?.[0];

    expect(onlineAvatarBranch).toContain('alt="You"');
    expect(onlineAvatarBranch).toContain('data-self-player="true"');
  });

  test('uses the match table for both Pool Royale callers', () => {
    const firstPlayerParams = new URLSearchParams(
      'mode=online&tableId=pool-table-42&accountId=1001&seat=A'
    );
    const secondPlayerParams = new URLSearchParams(
      'mode=online&tableId=pool-table-42&accountId=2002&seat=B'
    );

    expect(buildGameLiveChatRoomId('poolroyale', firstPlayerParams)).toBe(
      buildGameLiveChatRoomId('poolroyale', secondPlayerParams)
    );
    expect(buildGameLiveChatRoomId('poolroyale', firstPlayerParams)).toBe(
      'live-poolroyale-pool-table-42'
    );
  });
});
