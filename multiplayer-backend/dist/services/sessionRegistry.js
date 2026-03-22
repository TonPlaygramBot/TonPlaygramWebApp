export class SessionRegistry {
    userSocketMap = new Map();
    setSocket(userId, socketId) {
        this.userSocketMap.set(userId, socketId);
    }
    removeSocket(userId) {
        this.userSocketMap.delete(userId);
    }
    getSocket(userId) {
        return this.userSocketMap.get(userId);
    }
}
