import { CityInput } from '../input';
import type { StreetIntent } from './StreetSimulation.mjs';
/** Desktop and touch share intents; pointer ownership is independent per finger. */
export class StreetInput extends CityInput {
  private owners = new Map<number, { kind: string; x: number; y: number }>();
  private active = true;
  constructor(
    private dispatch: (action: string) => void,
    private look: (dx: number, dy: number) => void
  ) {
    super(dispatch);
    window.addEventListener('keydown', this.extra);
    window.addEventListener('blur', this.resetPointers);
    document.addEventListener('visibilitychange', this.hidden);
  }
  private resetPointers = () => this.releaseAll();
  private hidden = () => { if (document.hidden) this.releaseAll(); };
  private extra = (e: KeyboardEvent) => {
    if (
      !this.active ||
      e.repeat ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    const action =
      e.code === 'Space'
        ? 'jump'
        : e.code === 'KeyC'
          ? 'crouch'
          : e.code === 'KeyV'
            ? 'kick'
            : e.code === 'KeyB'
              ? 'guard'
              : e.code === 'KeyZ'
                ? 'aim'
                : null;
    if (action) {
      e.preventDefault();
      this.dispatch(action);
    }
  };
  override setEnabled(enabled: boolean) {
    this.active = enabled;
    this.releaseAll();
    super.setEnabled(enabled);
  }
  pointerDown(id: number, kind: string, x: number, y: number) {
    if (
      !this.active ||
      this.owners.has(id) ||
      (['look', 'move'].includes(kind) && [...this.owners.values()].some((v) => v.kind === kind))
    )
      return false;
    this.owners.set(id, { kind, x, y });
    this.syncHeld();
    return true;
  }
  pointerMove(id: number, x: number, y: number) {
    const owner = this.owners.get(id);
    if (!owner) return;
    if (owner.kind === 'look' || owner.kind === 'fire' && ![...this.owners.values()].some(v => v.kind === 'look'))
      this.look(x - owner.x, y - owner.y);
    owner.x = x;
    owner.y = y;
  }
  pointerUp(id: number) {
    const owner = this.owners.get(id);
    if (!owner) return;
    this.owners.delete(id);
    this.syncHeld();
    if (owner.kind === 'move') {
      this.touch.x = 0;
      this.touch.y = 0;
    }
  }
  releaseAll() {
    this.owners?.clear();
    this.clear();
  }
  private syncHeld() {
    const held = new Set([...this.owners.values()].map(o => o.kind));
    this.touch.fire = held.has('fire');
    this.touch.gas = Number(held.has('gas')) - Number(held.has('reverse'));
    this.touch.brake = held.has('brake');
    this.touch.fast = held.has('ascend');
  }
  readStreet(yaw: number, pitch: number, driving: boolean): StreetIntent {
    return { ...this.read(yaw, driving), pitch };
  }
  override destroy() {
    window.removeEventListener('keydown', this.extra);
    window.removeEventListener('blur', this.resetPointers);
    document.removeEventListener('visibilitychange', this.hidden);
    this.releaseAll();
    super.destroy();
  }
}
