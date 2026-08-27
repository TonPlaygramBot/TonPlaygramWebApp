import { orderTexasHoldemStateForNetwork, orderTexasHoldemStateForViewer } from '../webapp/src/utils/texasHoldemOnlineState.js';

describe('Texas Holdem online player perspective', () => {
  const state = {
    players: [{ id: 'host', hand: ['AS', 'KH'] }, { id: 'guest', hand: ['2C', '3D'] }],
    actionIndex: 1,
    dealerIndex: 0,
    winnerFocusIndex: 1,
    winners: [{ winners: [{ index: 1 }] }]
  };

  test('places each viewer in the local human seat without copying the host cards', () => {
    const guest = orderTexasHoldemStateForViewer(state, 'guest');
    expect(guest.players[0].id).toBe('guest');
    expect(guest.players[0].hand).toEqual(['2C', '3D']);
    expect(guest.players[1].hand).toEqual(['AS', 'KH']);
    expect(guest.actionIndex).toBe(0);
    expect(guest.dealerIndex).toBe(1);
    expect(guest.winners[0].winners[0].index).toBe(0);
  });

  test('restores canonical table order before broadcasting state', () => {
    const guest = orderTexasHoldemStateForViewer(state, 'guest');
    const network = orderTexasHoldemStateForNetwork(guest, [{ id: 'host' }, { id: 'guest' }]);
    expect(network.players.map((player) => player.id)).toEqual(['host', 'guest']);
    expect(network.actionIndex).toBe(1);
    expect(network.dealerIndex).toBe(0);
  });
});
