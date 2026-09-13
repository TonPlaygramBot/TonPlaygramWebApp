import {
  createGame,
  applyAction,
  activePlayer,
  chooseAiAction,
  publicGame
} from './shared/engine.mjs';
import type { GameSession, GameView } from './types';
export class LocalTabletopSession implements GameSession {
  localId = 'you';
  private state;
  private listeners = new Set<(s: GameView) => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;
  constructor(
    gameId: string,
    count: number,
    private difficulty: string,
    name = 'You'
  ) {
    this.state = createGame(
      gameId,
      Array.from({ length: count }, (_, i) => ({
        id: i ? `ai-${i}` : 'you',
        name: i ? ['', 'Ada', 'Niko', 'Mira'][i] : name
      })),
      crypto.getRandomValues(new Uint32Array(1))[0]
    );
  }
  subscribe(fn: (s: GameView) => void) {
    this.listeners.add(fn);
    fn(publicGame(this.state, this.localId));
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    if (this.closed) return;
    const view = publicGame(this.state, this.localId);
    this.listeners.forEach((fn) => fn(view));
    clearTimeout(this.timer);
    if (!this.state.done && activePlayer(this.state).id !== this.localId)
      this.timer = setTimeout(() => {
        if (this.closed) return;
        const id = chooseAiAction(this.state, this.difficulty),
          result = applyAction(this.state, activePlayer(this.state).id, id);
        if (result.ok) {
          this.state = result.state;
          this.emit();
        }
      }, 850);
  }
  async act(actionId: string, revision: number) {
    if (this.closed) throw Error('Match closed.');
    const result = applyAction(this.state, this.localId, actionId, revision);
    if (!result.ok) throw Error(result.error);
    this.state = result.state;
    this.emit();
  }
  dispose() {
    this.closed = true;
    clearTimeout(this.timer);
    this.listeners.clear();
  }
}
