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
  }
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
      [...this.owners.values()].some((v) => v.kind === kind)
    )
      return false;
    this.owners.set(id, { kind, x, y });
    if (kind === 'fire') this.touch.fire = true;
    if (kind === 'gas') this.touch.gas = 1;
    if (kind === 'reverse') this.touch.gas = -1;
    if (kind === 'brake') this.touch.brake = true;
    if (kind === 'ascend') this.touch.fast = true;
    return true;
  }
  pointerMove(id: number, x: number, y: number) {
    const owner = this.owners.get(id);
    if (!owner) return;
    if (owner.kind === 'look' || owner.kind === 'fire')
      this.look(x - owner.x, y - owner.y);
    owner.x = x;
    owner.y = y;
  }
  pointerUp(id: number) {
    const owner = this.owners.get(id);
    if (!owner) return;
    this.owners.delete(id);
    if (owner.kind === 'fire') this.touch.fire = false;
    if (owner.kind === 'gas' || owner.kind === 'reverse')
      this.touch.gas = [...this.owners.values()].some((o) => o.kind === 'gas')
        ? 1
        : [...this.owners.values()].some((o) => o.kind === 'reverse')
          ? -1
          : 0;
    if (owner.kind === 'brake') this.touch.brake = false;
    if (owner.kind === 'ascend') this.touch.fast = false;
    if (owner.kind === 'move') {
      this.touch.x = 0;
      this.touch.y = 0;
    }
  }
  releaseAll() {
    this.owners?.clear();
    this.clear();
  }
  readStreet(yaw: number, pitch: number, driving: boolean): StreetIntent {
    return { ...this.read(yaw, driving), pitch };
  }
  override destroy() {
    window.removeEventListener('keydown', this.extra);
    this.releaseAll();
    super.destroy();
  }
}
