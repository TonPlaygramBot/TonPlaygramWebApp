import { friendRequestId, isIncomingFriendRequest } from '../webapp/src/utils/friendRequests.js'
import { describe, expect, test } from '@jest/globals'

describe('friend request helpers', () => {
  test('recognizes recipients even when API and client identity types differ', () => {
    expect(isIncomingFriendRequest({ toTelegramId: '123' }, 123, 'account-1')).toBe(true)
  })

  test('recognizes an account ID recipient', () => {
    expect(isIncomingFriendRequest({ toAccountId: 'account-1' }, 123, 'account-1')).toBe(true)
  })

  test('does not present an outgoing request as actionable', () => {
    expect(isIncomingFriendRequest({ fromId: 123, toId: 456 }, 123, 'account-1')).toBe(false)
  })

  test('uses the explicit API request ID before the database field', () => {
    expect(friendRequestId({ requestId: 'request-id', _id: 'mongo-id' })).toBe('request-id')
  })
})
