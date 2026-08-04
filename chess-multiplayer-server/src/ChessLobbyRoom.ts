import { Client, Room } from 'colyseus';
import { authenticatePlayer, type PlayerAuth } from './auth.js';
import { ChessLobbyState, LobbyPlayer } from './state.js';

interface RoomOptions { visibility?: 'public' | 'private'; invitationCode?: string; maxPlayers?: number }
const code = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export class ChessLobbyRoom extends Room<{ state: ChessLobbyState }> {
  maxClients = 8;
  private countdown?: ReturnType<typeof setTimeout>;

  async onAuth(client: Client, options: Record<string, unknown>) { return authenticatePlayer(client, options); }

  onCreate(options: RoomOptions) {
    const visibility = options.visibility === 'private' ? 'private' : 'public';
    const invitationCode = visibility === 'private' ? code(options.invitationCode) : '';
    if (visibility === 'private' && !invitationCode) throw new Error('invitation_code_required');
    this.maxClients = Math.min(8, Math.max(4, Number(options.maxPlayers) || 8));
    this.setState(new ChessLobbyState());
    this.state.visibility = visibility;
    this.state.invitationCode = invitationCode;
    this.state.maxPlayers = this.maxClients;
    this.setMetadata({ visibility, invitationCode, maxPlayers: this.maxClients, phase: 'waiting' });
    this.onMessage('ready', (client, ready: boolean) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase === 'playing') return;
      player.ready = Boolean(ready);
      this.evaluateCountdown();
    });
  }

  onJoin(client: Client, _options: RoomOptions, auth: PlayerAuth) {
    const duplicate = [...this.state.players.entries()].find(([, p]) => p.accountId === auth.accountId);
    if (duplicate) this.state.players.delete(duplicate[0]);
    const player = new LobbyPlayer();
    Object.assign(player, auth, { joinedAt: Date.now(), connected: true, ready: false });
    this.state.players.set(client.sessionId, player);
    this.evaluateCountdown();
  }

  async onLeave(client: Client, closeCode?: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    player.ready = false;
    this.cancelCountdown();
    if (closeCode === 4000) return void this.state.players.delete(client.sessionId);
    try {
      await this.allowReconnection(client, 30);
      const restored = this.state.players.get(client.sessionId);
      if (restored) restored.connected = true;
      this.evaluateCountdown();
    } catch { this.state.players.delete(client.sessionId); }
  }

  onDispose() { if (this.countdown) clearTimeout(this.countdown); }

  private evaluateCountdown() {
    const players = [...this.state.players.values()];
    const canStart = players.length >= this.state.minPlayers && players.every((p) => p.ready && p.connected);
    if (!canStart) return this.cancelCountdown();
    if (this.state.phase === 'countdown') return;
    this.state.phase = 'countdown';
    this.state.countdownEndsAt = Date.now() + 5000;
    void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'countdown' });
    this.lock();
    this.countdown = setTimeout(() => {
      this.state.phase = 'playing';
      this.state.countdownEndsAt = 0;
      void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'playing' });
      this.broadcast('match_start', { roomId: this.roomId, players: [...this.state.players.values()].map((p) => ({ accountId: p.accountId, name: p.name })) });
    }, 5000);
  }

  private cancelCountdown() {
    if (this.state.phase === 'playing') return;
    if (this.countdown) clearTimeout(this.countdown);
    this.countdown = undefined;
    this.state.phase = 'waiting';
    this.state.countdownEndsAt = 0;
    if (this.locked) this.unlock();
    void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'waiting' });
  }
}
