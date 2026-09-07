import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import { ensureAccountId } from '../../utils/telegram.js';
import type { ArcheryMatch, ShotIntent } from './shared/rules';

export type OnlineArcheryView = ArcheryMatch & {
  tableId: string;
  stake: number;
  serverNow: number;
  turnDeadline: number;
  connected: Record<string, boolean>;
  settlement?: { status?: string } | null;
};

export class OnlineArcherySession {
  localId = '';
  private listeners = new Set<(state: OnlineArcheryView) => void>();
  private view: OnlineArcheryView | null = null;
  private closed = false;
  private joining = false;
  private replaced = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;

  constructor(private tableId: string, private onConnection: (message: string) => void) {
    socket.on('archery:state', this.accept);
    socket.on('archery:replaced', this.replace);
    socket.on('connect', this.join);
    socket.on('disconnect', this.disconnected);
    socket.on('connect_error', this.disconnected);
    document.addEventListener('visibilitychange', this.visible);
    refreshSocketAuthIdentity({}, { reconnect: true });
    socket.connect();
    void this.join();
    this.heartbeat = setInterval(() => {
      if (!this.closed && !this.replaced && socket.connected) void this.sync();
    }, 5000);
  }

  private ack(event: string, data: unknown): Promise<any> {
    return new Promise((resolve, reject) => socket.timeout(7000).emit(event, data, (error: unknown, response: any) => {
      if (error) reject(new Error('Connection timed out. Reconnecting…'));
      else resolve(response);
    }));
  }

  private accept = (data: OnlineArcheryView) => {
    if (this.closed || this.replaced || data?.tableId !== this.tableId) return;
    this.view = data;
    if (!this.localId) return;
    this.onConnection('');
    this.listeners.forEach((listener) => listener(data));
  };

  private replace = () => {
    this.replaced = true;
    this.onConnection('This match is open on another device. Return to the lobby.');
  };

  private disconnected = () => {
    if (!this.closed) this.onConnection('Connection lost. Restoring your shooting line…');
  };

  private visible = () => {
    if (document.hidden) socket.emit('archery:suspend', {});
    else void this.join();
  };

  private join = async () => {
    if (this.closed || this.joining || this.replaced || !socket.connected) return;
    this.joining = true;
    try {
      const id = String(await ensureAccountId());
      if (this.closed) return;
      const registered = await this.ack('register', {
        accountId: id, tpcAccountNumber: id, tpcAccountId: id, playerId: id
      });
      if (!registered?.success) throw new Error('Sign in to your TPG account to reconnect.');
      const response = await this.ack('archery:join', { tableId: this.tableId });
      if (!response?.ok) throw new Error(String(response?.error || 'Could not join the range.').replace(/_/g, ' '));
      this.localId = response.playerId;
      this.accept(response.state);
    } catch (error) {
      if (!this.closed) {
        this.onConnection(error instanceof Error ? error.message : 'Unable to reconnect.');
        clearTimeout(this.retry);
        this.retry = setTimeout(this.join, 2500);
      }
    } finally {
      this.joining = false;
    }
  };

  private async sync() {
    try {
      const response = await this.ack('archery:sync', {});
      if (response?.ok) this.accept(response.state);
    } catch { this.disconnected(); }
  }

  subscribe(listener: (state: OnlineArcheryView) => void) {
    this.listeners.add(listener);
    if (this.view) listener(this.view);
    return () => this.listeners.delete(listener);
  }

  async shoot(shot: ShotIntent, turnId: number) {
    if (!socket.connected || this.replaced) throw new Error('Wait for the range to reconnect.');
    const response = await this.ack('archery:shot', {
      shot, turnId, requestId: `arrow-${turnId}-${Math.random().toString(36).slice(2, 12)}`
    });
    if (!response?.ok) throw new Error(String(response?.error || 'Shot not accepted.').replace(/_/g, ' '));
  }

  leave() { if (!this.replaced) socket.emit('archery:leave', {}); }

  dispose() {
    this.closed = true;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    socket.off('archery:state', this.accept);
    socket.off('archery:replaced', this.replace);
    socket.off('connect', this.join);
    socket.off('disconnect', this.disconnected);
    socket.off('connect_error', this.disconnected);
    document.removeEventListener('visibilitychange', this.visible);
    if (!this.replaced) socket.emit('archery:suspend', {});
    this.listeners.clear();
  }
}
