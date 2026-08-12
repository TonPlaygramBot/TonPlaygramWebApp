import { Client, Room } from 'colyseus';
import { authenticatePlayer, type PlayerAuth } from './auth.js';
import { ChessLobbyState, LobbyPlayer } from './state.js';

interface RoomOptions { visibility?: 'public' | 'private'; invitationCode?: string; stake?: number; token?: string }
const code = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export const canStartChessMatch = (players: Iterable<LobbyPlayer>) => {
  const seats = [...players];
  return seats.length === 2 && seats.every((player) => player.ready && player.connected);
};

export const assignRandomChessSides = (players: LobbyPlayer[], random = Math.random) => {
  if (players.length !== 2) return players;
  const whiteIndex = random() < 0.5 ? 0 : 1;
  players.forEach((player, index) => { player.side = index === whiteIndex ? 'white' : 'black'; });
  return players;
};

export class ChessBattleRoyaleRoom extends Room<{ state: ChessLobbyState }> {
  maxClients = 2;
  private countdown?: ReturnType<typeof setTimeout>;

  async onAuth(client: Client, options: Record<string, unknown>) {
    if (this.state?.visibility === 'private' && code(options.invitationCode) !== this.state.invitationCode) {
      throw new Error('invalid_invitation_code');
    }
    return authenticatePlayer(client, options);
  }

  onCreate(options: RoomOptions) {
    const visibility = options.visibility === 'private' ? 'private' : 'public';
    const invitationCode = visibility === 'private' ? code(options.invitationCode) : '';
    if (visibility === 'private' && !invitationCode) throw new Error('invitation_code_required');
    this.setState(new ChessLobbyState());
    this.state.visibility = visibility;
    this.state.invitationCode = invitationCode;
    this.state.maxPlayers = this.maxClients;
    this.state.stake = Number(options.stake) || 0;
    this.state.token = String(options.token || 'TPG').toUpperCase();
    if (!Number.isSafeInteger(this.state.stake) || this.state.stake <= 0 || this.state.token !== 'TPG') throw new Error('invalid_stake');
    this.setMetadata({ visibility, invitationCode, stake: this.state.stake, token: this.state.token, maxPlayers: this.maxClients, phase: 'waiting' });
    this.onMessage('ready', (client, ready: boolean) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.phase === 'playing') return;
      player.ready = Boolean(ready);
      this.evaluateCountdown();
    });
  }

  async onJoin(client: Client, _options: RoomOptions, auth: PlayerAuth) {
    if (auth.balance < this.state.stake) throw new Error('insufficient_balance');
    const duplicate = [...this.state.players.entries()].find(([, p]) => p.accountId === auth.accountId);
    if (duplicate) this.state.players.delete(duplicate[0]);
    const player = new LobbyPlayer();
    const maskedAccount = auth.accountId.length <= 8 ? `${auth.accountId.slice(0, 2)}••${auth.accountId.slice(-2)}` : `${auth.accountId.slice(0, 4)}••••${auth.accountId.slice(-4)}`;
    Object.assign(player, auth, { maskedAccount, joinedAt: Date.now(), connected: true, ready: false });
    this.state.players.set(client.sessionId, player);
    console.info('[chess_lobby] player joined', { roomId: this.roomId, sessionId: client.sessionId, accountId: auth.accountId, players: this.state.players.size });
    if (this.state.players.size === this.maxClients) {
      this.lock();
      try { await this.reserveStakes(); } catch (error) { this.state.players.delete(client.sessionId); this.unlock(); throw error; }
      // Quick Match has no ready-up step: successfully reserving both stakes is
      // the authoritative confirmation for both connected seats.
      this.state.players.forEach((seatedPlayer) => { seatedPlayer.ready = true; });
    }
    this.evaluateCountdown();
  }

  async onLeave(client: Client, closeCode?: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = false;
    player.ready = false;
    this.cancelCountdown();
    if (closeCode === 4000) {
      if (this.state.stakesReserved && this.state.phase !== 'playing') await this.releaseStakes('matchmaking_cancelled');
      this.state.players.delete(client.sessionId);
      console.info('[chess_lobby] player left', { roomId: this.roomId, sessionId: client.sessionId, players: this.state.players.size });
      return this.cancelCountdown();
    }
    try {
      await this.allowReconnection(client, 30);
      const restored = this.state.players.get(client.sessionId);
      if (restored) restored.connected = true;
      console.info('[chess_lobby] player reconnected', { roomId: this.roomId, sessionId: client.sessionId });
      this.evaluateCountdown();
    } catch {
      this.state.players.delete(client.sessionId);
      console.info('[chess_lobby] reconnect expired', { roomId: this.roomId, sessionId: client.sessionId, players: this.state.players.size });
      this.cancelCountdown();
    }
  }

  onDispose() { if (this.countdown) clearTimeout(this.countdown); }

  private async reserveStakes() {
    if (this.state.stakesReserved) return;
    const base = String(process.env.ACCOUNT_API_URL || '').replace(/\/$/, '');
    if (!base) { this.state.tableNumber = `TABLE #${this.roomId.slice(-6).toUpperCase().padStart(6, '0')}`; this.state.matchId = this.roomId; this.state.stakesReserved = true; return; }
    const response = await fetch(`${base}/api/matchmaking/reserve`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-matchmaking-secret': String(process.env.MATCHMAKING_SERVICE_SECRET || '') }, body: JSON.stringify({ roomId: this.roomId, accounts: [...this.state.players.values()].map(p => p.accountId), stake: this.state.stake, token: this.state.token }) });
    const result = await response.json().catch(() => ({})) as any;
    if (!response.ok) throw new Error(String(result.error || 'stake_reservation_failed'));
    this.state.tableNumber = result.tableNumber; this.state.matchId = result.matchId; this.state.stakesReserved = true;
  }

  private async releaseStakes(reason: string) {
    const base = String(process.env.ACCOUNT_API_URL || '').replace(/\/$/, '');
    if (base) await fetch(`${base}/api/matchmaking/release`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-matchmaking-secret': String(process.env.MATCHMAKING_SERVICE_SECRET || '') }, body: JSON.stringify({ matchId: this.state.matchId, reason }) });
    this.state.stakesReserved = false;
  }

  private evaluateCountdown() {
    const players = [...this.state.players.values()];
    const canStart = canStartChessMatch(players);
    if (!canStart) return this.cancelCountdown();
    if (this.state.phase === 'countdown') return;
    this.state.phase = 'countdown';
    this.state.countdownEndsAt = Date.now() + 5000;
    void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'countdown' });
    this.lock();
    this.countdown = setTimeout(() => {
      const players = assignRandomChessSides([...this.state.players.values()]);
      this.state.phase = 'playing';
      this.state.countdownEndsAt = 0;
      void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'playing' });
      this.broadcast('match_start', { roomId: this.roomId, matchId: this.state.matchId, tableNumber: this.state.tableNumber, players: players.map((p) => ({ accountId: p.accountId, maskedAccount: p.maskedAccount, name: p.name, side: p.side })) });
    }, 5000);
  }

  private cancelCountdown() {
    if (this.state.phase === 'playing') return;
    if (this.countdown) clearTimeout(this.countdown);
    this.countdown = undefined;
    this.state.phase = 'waiting';
    this.state.countdownEndsAt = 0;
    if (this.locked && this.state.players.size < this.maxClients) this.unlock();
    void this.setMetadata({ visibility: this.state.visibility, invitationCode: this.state.invitationCode, phase: 'waiting' });
  }
}

// Preserve the existing server import while giving the room its game-specific name.
export { ChessBattleRoyaleRoom as ChessLobbyRoom };
