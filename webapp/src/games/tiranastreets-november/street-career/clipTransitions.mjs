// Cross-fade from the weights actually visible now, not 0/1. Three's native
// fadeIn/fadeOut restarts can briefly erase or double a pose after quick input.
export class ClipTransitions {
  constructor(duration = .16) {
    this.duration = duration;
    this.actions = [];
    this.origin = [];
    this.active = null;
    this.elapsed = duration;
  }

  reset(actions) {
    this.actions = actions;
    this.origin = new Array(actions.length).fill(0);
    this.active = null;
    this.elapsed = this.duration;
  }

  select(action, initialPhase = 0) {
    const target = action ?? null;
    if (this.active === target) return;
    let haveVisibleClip = false;
    for (let i = 0; i < this.actions.length; i++) {
      const current = this.actions[i];
      const weight = current.isRunning() ? current.getEffectiveWeight() : 0;
      this.origin[i] = weight;
      haveVisibleClip ||= weight > 0;
    }
    this.active = target;
    if (target && !target.isRunning()) {
      target.reset();
      target.time = ((initialPhase % 1 + 1) % 1) * target.getClip().duration;
      target.setEffectiveWeight(haveVisibleClip ? 0 : 1).play();
    }
    this.elapsed = haveVisibleClip ? 0 : this.duration;
  }

  update(dt) {
    if (this.elapsed >= this.duration) return;
    this.elapsed = Math.min(this.duration, this.elapsed + Math.max(0, dt));
    const t = this.elapsed / this.duration;
    const alpha = t * t * (3 - 2 * t);
    for (let i = 0; i < this.actions.length; i++) {
      const action = this.actions[i];
      const target = Number(action === this.active);
      const weight = this.origin[i] + (target - this.origin[i]) * alpha;
      if (!action.isRunning()) continue;
      if (t === 1 && target === 0) action.stop();
      else action.setEffectiveWeight(weight);
    }
  }
}
