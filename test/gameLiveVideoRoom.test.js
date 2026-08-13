import { buildGameLiveChatRoomId } from '../webapp/src/utils/liveVideoRoom.js';

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
