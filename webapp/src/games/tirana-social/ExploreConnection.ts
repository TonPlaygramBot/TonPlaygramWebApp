import {socket, refreshSocketAuthIdentity} from '../../utils/socket.js';
import type {Input} from '../tiranastreets/shared/engine.mjs';
import type {ExploreSnapshot} from './types';

export type ExploreStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closed';
const neutral = (): Input => ({x:0,y:0,yaw:0,seq:0,fire:false,brake:true,fast:false});
/** One transport session and input counter. Rendering and pause events must
 * never inject independent wall-clock sequence numbers into the server stream. */
export class ExploreConnection {
  roomId = '';
  private clientId = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2,'0')).join('');
  private dead = false;
  private listening = false;
  private wanted = false;
  private busy = false;
  private sequence = 0;
  private input = neutral();
  private heartbeat?: ReturnType<typeof setInterval>;
  private joining: Promise<void> | null = null;
  private cancelWait?: () => void;
  private appearance = 'rpm-current';
  private invitation?: string;
  private phase: ExploreStatus = 'idle';
  constructor(
    private accountId: string,
    private publish: (s: ExploreSnapshot) => void,
    private fail: (message: string) => void,
    private status: (s: ExploreStatus) => void = () => {}
  ) {}
  private setStatus(value: ExploreStatus) {
    if (value === this.phase) return;
    this.phase = value; this.status(value);
  }
  private snapshot = (s: ExploreSnapshot) => {
    if (this.dead || s?.id !== this.roomId || s.version !== 1 || !s.state?.players?.[s.playerId] || !Array.isArray(s.members)) return;
    // A transient request timeout must not leave a healthy resumed stream
    // marked offline in the movement UI.
    if (this.phase === 'error') { this.setStatus('connected'); this.fail(''); }
    const own = s.members.find(m => m.id === s.playerId);
    if (own?.appearance) this.appearance = own.appearance;
    this.publish(s);
  };
  private clearHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
  }
  private disconnect = () => {
    if (this.dead) return;
    this.clearHeartbeat();
    this.controls(neutral());
    this.setStatus('reconnecting');
  };
  private reconnect = () => {
    if (this.wanted && !this.dead) void this.establish().catch(e => this.report(e));
  };
  private left = ({roomId}: {roomId: string}) => {
    if (this.dead || roomId !== this.roomId) return;
    this.clearHeartbeat();
    this.setStatus('error');
    this.fail('Exploration session ended. Use Reconnect to join again.');
  };
  private report(error: unknown) {
    if (!this.dead) {
      this.setStatus('error');
      this.fail(error instanceof Error ? error.message : 'Explore connection failed');
    }
  }
  private waitForSocket(): Promise<void> {
    if (socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); socket.off('connect', done); socket.off('connect_error', failed); this.cancelWait = undefined; };
      const done = () => { cleanup(); resolve(); };
      const failed = (e: Error) => { cleanup(); reject(e); };
      const timer = setTimeout(() => failed(Error('Game server connection timed out. Reconnect to retry.')), 10000);
      this.cancelWait = () => failed(Error('Explore closed'));
      socket.on('connect', done); socket.on('connect_error', failed);
      socket.connect();
    });
  }
  async join(appearance: string, roomId?: string) {
    if (this.dead) throw Error('Explore closed');
    this.appearance = appearance;
    this.invitation = roomId || undefined;
    this.wanted = true;
    if (!this.listening) {
      this.listening = true;
      socket.on('connect', this.reconnect);
      socket.on('disconnect', this.disconnect);
      socket.on('explore:snapshot', this.snapshot);
      socket.on('explore:left', this.left);
    }
    return this.establish();
  }
  private establish(): Promise<void> {
    if (this.joining) return this.joining;
    const pending = Promise.resolve().then(async () => {
      this.setStatus(this.roomId ? 'reconnecting' : 'connecting');
      this.clearHeartbeat();
      refreshSocketAuthIdentity({accountId:this.accountId}, {reconnect:true});
      await this.waitForSocket();
      if (this.dead) return;
      await new Promise<void>((resolve, reject) => socket.timeout(8000).emit('register', {tpcAccountNumber:this.accountId},
        (err: Error | null, r: {success?: boolean; error?: string}) => err || !r?.success ? reject(Error(r?.error || 'Sign in to your game account first')) : resolve()));
      if (this.dead) return;
      let result: ExploreSnapshot;
      try {
        result = await this.request('join', {appearance:this.appearance,roomId:this.roomId || this.invitation || ''});
      } catch (e) {
        // Public instances disappear when their last member disconnects. An
        // explicit invitation never silently redirects to a different room.
        if (this.dead || this.invitation || !(e instanceof Error) || e.message !== 'Room not found') throw e;
        this.roomId = '';
        result = await this.request('join', {appearance:this.appearance,roomId:''});
      }
      if (this.dead) {
        if (socket.connected) socket.emit('explore:request', {action:'leave',accountId:this.accountId,clientId:this.clientId,roomId:result.id}, () => {});
        return;
      }
      if (result?.version !== 1 || !result.id || !result.state?.players?.[result.playerId]) throw Error('Invalid Explore server snapshot');
      this.roomId = result.id;
      this.controls(neutral());
      this.setStatus('connected'); this.fail(''); this.snapshot(result);
      this.heartbeat = setInterval(() => {
        if (this.busy || this.dead || !socket.connected) return;
        this.busy = true;
        void this.request('input', {input:this.input}).catch(e => this.report(e)).finally(() => { this.busy = false; });
      }, 100);
    });
    this.joining = pending;
    void pending.finally(() => { if (this.joining === pending) this.joining = null; }).catch(() => {});
    return pending;
  }
  request = async (action: string, payload: Record<string, unknown> = {}): Promise<any> => {
    if (this.dead) throw Error('Explore closed');
    return new Promise((resolve, reject) => socket.timeout(8000).emit('explore:request', {
      ...payload, action, accountId:this.accountId, clientId:this.clientId,
      roomId: typeof payload.roomId === 'string' ? payload.roomId : this.roomId
    }, (err: Error | null, r: {success:boolean;data:any;error?:string}) =>
      err || !r?.success ? reject(Error(r?.error || 'Explore server did not respond')) : resolve(r.data)));
  };
  controls(input: Input) {
    if (this.dead) return;
    this.input = {...input, seq:++this.sequence, fire:false};
  }
  dispose() {
    if (this.dead) return;
    this.dead = true; this.wanted = false;
    this.cancelWait?.(); this.clearHeartbeat();
    socket.off('connect', this.reconnect); socket.off('disconnect', this.disconnect);
    socket.off('explore:snapshot', this.snapshot); socket.off('explore:left', this.left);
    if (this.roomId && socket.connected) socket.emit('explore:request', {action:'leave',roomId:this.roomId,accountId:this.accountId,clientId:this.clientId}, () => {});
    this.setStatus('closed');
  }
}
