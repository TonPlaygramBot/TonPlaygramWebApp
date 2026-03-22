export class SessionRegistry {
  private readonly userSocketMap = new Map<string, string>();

  setSocket(userId: string, socketId: string): void {
    this.userSocketMap.set(userId, socketId);
  }

  removeSocket(userId: string): void {
    this.userSocketMap.delete(userId);
  }

  getSocket(userId: string): string | undefined {
    return this.userSocketMap.get(userId);
  }
}
