import test from 'node:test';
import assert from 'node:assert/strict';
import { Address } from '@ton/core';
import { gameStakeConfigToCell } from '../wrappers/GameStake.js';

test('game stake config stores share and wallet', () => {
  const dev = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');
  const wallet = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA0w');
  const cell = gameStakeConfigToCell({ developer: dev, developerShare: 15, jettonWallet: wallet });
  const slice = cell.beginParse();
  assert.equal(slice.loadAddress().toString(), dev.toString());
  assert.equal(slice.loadUint(8), 15);
  assert.equal(slice.loadAddress().toString(), wallet.toString());
});
