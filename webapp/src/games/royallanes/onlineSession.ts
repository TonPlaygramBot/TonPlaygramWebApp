import { socket, refreshSocketAuthIdentity } from '../../utils/socket.js';
import { ensureAccountId } from '../../utils/telegram.js';
import type { BowlingSession, MatchView, Shot } from './types';
export class OnlineBowlingSession implements BowlingSession {
  localId = '';
  private listeners = new Set<(state: MatchView) => void>();
  private view: MatchView | null = null;
  private closed = false;
  private joining = false;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;
  private replaced = false;
  constructor(
    private tableId: string,
    private onConnection: (message: string) => void
  ) {
    socket.on('bowling:state', this.accept);
    socket.on('bowling:replaced', this.replace);
    socket.on('connect', this.join);
    socket.on('disconnect', this.disconnected);
    socket.on('connect_error', this.disconnected);
    document.addEventListener('visibilitychange', this.visible);
    refreshSocketAuthIdentity({}, { reconnect: true });
    socket.connect();
    void this.join();
    this.heartbeat = setInterval(() => {
      if (
        !this.closed &&
        !this.replaced &&
        socket.connected &&
        this.view?.phase === 'aiming'
      )
        void this.sync();
    }, 5000);
  }
  private ack(event: string, data: unknown): Promise<any> {
    return new Promise((resolve, reject) =>
      socket
        .timeout(7000)
        .emit(event, data, (error: unknown, response: any) =>
          error
            ? reject(Error('Connection timed out. Reconnecting…'))
            : resolve(response)
        )
    );
  }
  private accept = (data: MatchView) => {
    if (this.closed || this.replaced || data?.tableId !== this.tableId) return;
    this.view = data;
    if (!this.localId) return;
    this.onConnection('');
    this.listeners.forEach((fn) => fn(data));
  };
  private replace = () => {
    this.replaced = true;
    this.onConnection(
      'This match is open on another device. Return to the lobby with Back.'
    );
  };
  private disconnected = () => {
    if (!this.closed)
      this.onConnection('Connection lost. Reconnecting to your lane…');
  };
  private visible = () => {
    if (document.hidden) {
      socket.emit('bowling:suspend', {});
      return;
    }
    void this.join();
  };
  private join = async () => {
    if (this.closed || this.joining || this.replaced || !socket.connected)
      return;
    this.joining = true;
    try {
      const id = String(await ensureAccountId());
      if (this.closed) return;
      const registered = await this.ack('register', {
        accountId: id,
        tpcAccountNumber: id,
        tpcAccountId: id,
        playerId: id
      });
      if (!registered?.success)
        throw Error('Sign in to your TPG account to reconnect.');
      const response = await this.ack('bowling:join', {
        tableId: this.tableId
      });
      if (this.closed) return;
      if (!response?.ok)
        throw Error(
          response?.error === 'join_through_bowling_lobby'
            ? 'This match has ended. Return to the Royal Lanes lobby.'
            : String(response?.error || 'Could not join the lane.').replace(
                /_/g,
                ' '
              )
        );
      this.localId = response.playerId;
      this.accept(response.state);
    } catch (e) {
      if (!this.closed) {
        this.onConnection(
          e instanceof Error ? e.message : 'Unable to reconnect.'
        );
        clearTimeout(this.retry);
        this.retry = setTimeout(this.join, 2500);
      }
    } finally {
      this.joining = false;
    }
  };
  private async sync() {
    try {
      const r = await this.ack('bowling:sync', {});
      if (r?.ok) this.accept(r.state);
    } catch {
      this.disconnected();
    }
  }
  subscribe(fn: (s: MatchView) => void) {
    this.listeners.add(fn);
    if (this.view) fn(this.view);
    return () => this.listeners.delete(fn);
  }
  async roll(shot: Shot, turnId: number) {
    if (!socket.connected || this.replaced)
      throw Error('Wait for your lane to reconnect.');
    const requestId = `roll-${turnId}-${Math.random().toString(36).slice(2, 12)}`;
    let response;
    try {
      response = await this.ack('bowling:roll', { shot, turnId, requestId });
    } catch (e) {
      await this.sync();
      throw e;
    }
    if (!response?.ok)
      throw Error(
        String(response?.error || 'Shot not accepted.').replace(/_/g, ' ')
      );
  }
  leave() {
    if (!this.replaced) socket.emit('bowling:leave', {});
  }
  dispose() {
    this.closed = true;
    clearTimeout(this.retry);
    clearInterval(this.heartbeat);
    socket.off('bowling:state', this.accept);
    socket.off('bowling:replaced', this.replace);
    socket.off('connect', this.join);
    socket.off('disconnect', this.disconnected);
    socket.off('connect_error', this.disconnected);
    document.removeEventListener('visibilitychange', this.visible);
    if (!this.replaced) socket.emit('bowling:suspend', {});
    this.listeners.clear();
  }
}
