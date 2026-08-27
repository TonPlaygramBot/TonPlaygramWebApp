import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGameLiveChatRoomId } from './liveVideoRoom.js'

test('online live video uses the authoritative match table', () => {
  const params = new URLSearchParams('table=players-2&tableId=match-abc')
  assert.equal(buildGameLiveChatRoomId('ludobattleroyal', params), 'live-ludobattleroyal-match-abc')
})

test('legacy games still fall back to their table parameter', () => {
  const params = new URLSearchParams('table=legacy-room')
  assert.equal(buildGameLiveChatRoomId('ludobattleroyal', params), 'live-ludobattleroyal-legacy-room')
})
