import { describe, expect, it } from 'vitest';
import { RoomService } from '../src/services/roomService.js';

describe('RoomService', () => {
  it('creates and joins a room successfully', () => {
    const service = new RoomService();
    const room = service.createRoom('host', true, 'match-1');

    const joined = service.joinRoom('guest', room.roomCode);

    expect(joined).not.toBeNull();
    expect(joined?.members.size).toBe(2);
  });

  it('cleans room when all players leave', () => {
    const service = new RoomService();
    const room = service.createRoom('host', false, 'match-2');
    service.joinRoom('guest', room.roomCode);

    service.leaveRoom('host');
    service.leaveRoom('guest');

    expect(service.getRoomByCode(room.roomCode)).toBeNull();
  });
});
