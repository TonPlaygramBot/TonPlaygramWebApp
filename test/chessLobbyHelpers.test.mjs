import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import vm from 'vm';

const source = fs.readFileSync('webapp/src/pages/Games/ChessBattleRoyalLobby.jsx', 'utf8');
const helperNames = [
  'buildChessGameParams',
  'buildHostedTableId',
  'extractHostCodeFromTableId',
  'isChessHostedTableId',
  'normalizeHostCode',
  'resolveChessSide',
  'resolveChessTableMode',
  'resolveInitialOnlineQueue',
  'resolveLobbyStatus',
  'resolveSeatAccountId',
  'resolveSeatErrorMessage'
];

const importEnd = source.indexOf('const DEV_ACCOUNT');
const componentStart = source.indexOf('export default function ChessBattleRoyalLobby');
const helpersSource = source
  .slice(importEnd, componentStart)
  .replace(/export \{[\s\S]*?\};/, '')
  .replace(/import\.meta\.env/g, 'importMetaEnv');

const sandbox = {
  URLSearchParams,
  window: {
    Telegram: { WebApp: { initData: '' } },
    localStorage: { getItem: () => 'stored-account' }
  },
  importMetaEnv: {},
  getTpcAccountId: () => 'stored-account',
  console
};
vm.createContext(sandbox);
vm.runInContext(`${helpersSource}\nObject.assign(globalThis, { ${helperNames.join(', ')} });`, sandbox);

test('chess private lobby codes normalize to stable hosted table ids', () => {
  assert.equal(sandbox.normalizeHostCode(' friend 123!! '), 'FRIEND123');
  assert.equal(sandbox.buildHostedTableId(' friend 123!! '), 'chess-2-host-FRIEND123');
  assert.equal(sandbox.isChessHostedTableId('chess-2-host-FRIEND123'), true);
  assert.equal(sandbox.extractHostCodeFromTableId('chess-2-host-FRIEND123'), 'FRIEND123');
  assert.equal(sandbox.resolveChessTableMode('chess-2-host-FRIEND123'), 'private');
  assert.equal(sandbox.resolveChessTableMode(''), 'quick');
});

test('chess lobby derives private queue from URL table or host code', () => {
  const fromHostCode = sandbox.resolveInitialOnlineQueue(new URLSearchParams('hostCode=room-7'));
  assert.equal(fromHostCode.requestedMode, 'private');
  assert.equal(fromHostCode.requestedHostCode, 'ROOM-7');

  const fromTable = sandbox.resolveInitialOnlineQueue(new URLSearchParams('tableId=chess-2-host-FRIEND'));
  assert.equal(fromTable.requestedMode, 'private');
  assert.equal(fromTable.requestedHostCode, 'FRIEND');
  assert.equal(fromTable.requestedTableId, 'chess-2-host-FRIEND');
});

test('chess lobby status and side helpers match paired players', () => {
  const players = [
    { id: 'white-player', side: 'white', name: 'White' },
    { id: 'black-player', side: 'black', name: 'Black' }
  ];
  assert.equal(sandbox.resolveLobbyStatus(players, ['white-player'], 'white-player'), 'Opponent joined. Locking seats…');
  assert.equal(sandbox.resolveLobbyStatus(players, ['white-player', 'black-player'], 'white-player'), 'Both players ready. Starting match…');
  assert.equal(sandbox.resolveChessSide(players, 'black-player'), 'black');
});

test('chess lobby builds online game params and seat account fallback', () => {
  const params = sandbox.buildChessGameParams({
    mode: 'online',
    stake: { token: 'TPC', amount: 100 },
    avatar: 'avatar.png',
    tgId: 'tg-1',
    trackedAccountId: 'tracked-1',
    accountId: 'state-1',
    selectedFlag: '🇦🇱',
    selectedAiFlag: '🤖',
    preferredSide: 'white',
    extraParams: { tableId: 'chess-2-host-FRIEND', side: 'white' }
  });
  assert.equal(params.get('mode'), 'online');
  assert.equal(params.get('accountId'), 'tracked-1');
  assert.equal(params.get('tableId'), 'chess-2-host-FRIEND');
  assert.equal(params.get('side'), 'white');
  assert.equal(params.get('aiFlag'), null);
  assert.equal(sandbox.resolveSeatAccountId('', 'state-1'), 'stored-account');
  assert.match(sandbox.resolveSeatErrorMessage('stake_mismatch'), /different stake/);
});
