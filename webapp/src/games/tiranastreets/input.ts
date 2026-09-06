import { emptyInput, type Input } from "./shared/engine.mjs";

export class CityInput {
  touch = { x: 0, y: 0, gas: 0, fast: false, brake: false, fire: false };
  private keys = new Set<string>();
  private sequence = Date.now() * 1000;
  private enabled = true;
  constructor(private onAction: (action: string) => void) {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.clear);
    document.addEventListener("visibilitychange", this.visibility);
  }
  private down = (e: KeyboardEvent) => {
    if (
      !this.enabled ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLSelectElement
    )
      return;
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        " ",
        "w",
        "a",
        "s",
        "d",
        "e",
        "r",
        "f",
        "q",
        "h",
        "Escape",
        "Shift",
      ].includes(e.key)
    ) {
      e.preventDefault();
      this.keys.add(e.key.toLowerCase());
      if (!e.repeat) {
        if (e.key.toLowerCase() === "e") this.onAction("vehicle");
        if (e.key.toLowerCase() === "r") this.onAction("reload");
        if (e.key.toLowerCase() === "q") this.onAction("arsenal");
        if (e.key.toLowerCase() === "h") this.onAction("holster");
        if (e.key === "Escape") this.onAction("pause");
      }
    }
  };
  private up = (e: KeyboardEvent) => {
    this.keys.delete(e.key.toLowerCase());
  };
  private visibility = () => {
    if (document.hidden) this.clear();
  };
  clear = () => {
    this.keys.clear();
    this.touch = { x: 0, y: 0, gas: 0, fast: false, brake: false, fire: false };
  };
  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.clear();
  }
  read(yaw: number, driving: boolean): Input {
    if (!this.enabled) return { ...emptyInput(), seq: ++this.sequence };
    const key = (...k: string[]) => (k.some((v) => this.keys.has(v)) ? 1 : 0);
    return {
      x: Math.max(
        -1,
        Math.min(
          1,
          this.touch.x + key("d", "arrowright") - key("a", "arrowleft"),
        ),
      ),
      y: Math.max(
        -1,
        Math.min(
          1,
          (driving ? this.touch.gas : this.touch.y) +
            key("w", "arrowup") -
            key("s", "arrowdown"),
        ),
      ),
      yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)),
      fast: this.touch.fast || !!key("shift"),
      brake: this.touch.brake || !!key(" "),
      fire: this.touch.fire || !!key("f"),
      seq: ++this.sequence,
    };
  }
  destroy() {
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.clear);
    document.removeEventListener("visibilitychange", this.visibility);
    this.clear();
  }
}
