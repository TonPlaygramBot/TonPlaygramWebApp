import { customAlphabet } from 'nanoid';

export interface Room {
  roomCode: string;
  matchId: string;
  hostUserId: string;
  isPrivate: boolean;
  members: Set<string>;
}

export class RoomService {
  private readonly rooms = new Map<string, Room>();
  private readonly playerRoom = new Map<string, string>();
  private readonly codeGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

  createRoom(hostUserId: string, isPrivate: boolean, matchId: string): Room {
    const roomCode = this.codeGenerator();
    const room: Room = {
      roomCode,
      matchId,
      hostUserId,
      isPrivate,
      members: new Set([hostUserId]),
    };
    this.rooms.set(roomCode, room);
    this.playerRoom.set(hostUserId, roomCode);
    return room;
  }

  joinRoom(userId: string, roomCode: string): Room | null {
    const room = this.rooms.get(roomCode);
    if (!room || room.members.size >= 2) {
      return null;
    }
    room.members.add(userId);
    this.playerRoom.set(userId, roomCode);
    return room;
  }

  leaveRoom(userId: string): Room | null {
    const roomCode = this.playerRoom.get(userId);
    if (!roomCode) {
      return null;
    }
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }

    room.members.delete(userId);
    this.playerRoom.delete(userId);

    if (room.members.size === 0) {
      this.rooms.delete(roomCode);
    }

    return room;
  }

  getRoomByCode(roomCode: string): Room | null {
    return this.rooms.get(roomCode) ?? null;
  }

  getRoomByUser(userId: string): Room | null {
    const code = this.playerRoom.get(userId);
    return code ? this.rooms.get(code) ?? null : null;
  }
}
