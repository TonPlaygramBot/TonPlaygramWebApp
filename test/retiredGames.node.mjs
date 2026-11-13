import test from 'node:test';
import assert from 'node:assert/strict';
import games from '../webapp/src/config/gamesCatalog.js';
import { validateSeatTableRequest } from '../bot/config/onlineGamePolicy.js';

test('retired games cannot be discovered or start new stake reservations', () => {
  for (const slug of ['royallanes','tavullbattleroyal','backgammon']) {
    assert.equal(games.some(game=>game.slug===slug),false);
    const result=validateSeatTableRequest({gameType:slug,maxPlayers:2,stake:100,matchMeta:{mode:'online',token:'TPG',format:'tenpin'}});
    assert.equal(result.ok,false,slug);
    assert.equal(result.error,'unsupported_game_type');
  }
});
