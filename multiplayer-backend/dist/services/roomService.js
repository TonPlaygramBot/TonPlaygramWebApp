import { customAlphabet } from 'nanoid';
export class RoomService {
    rooms = new Map();
    playerRoom = new Map();
    codeGenerator = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);
    createRoom(hostUserId, isPrivate, matchId) {
        const roomCode = this.codeGenerator();
        const room = {
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
    joinRoom(userId, roomCode) {
        const room = this.rooms.get(roomCode);
        if (!room || room.members.size >= 2) {
            return null;
        }
        room.members.add(userId);
        this.playerRoom.set(userId, roomCode);
        return room;
    }
    leaveRoom(userId) {
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
    getRoomByCode(roomCode) {
        return this.rooms.get(roomCode) ?? null;
    }
    getRoomByUser(userId) {
        const code = this.playerRoom.get(userId);
        return code ? this.rooms.get(code) ?? null : null;
    }
}
