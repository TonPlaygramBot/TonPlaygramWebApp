import * as THREE from 'three';

export const CUE_SHOT_STATES = Object.freeze({
  IDLE: 'idle',
  DRAGGING: 'dragging',
  STRIKING: 'striking'
});

export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

export class CueShotController {
  constructor({
    idleGap = 0.01,
    contactGap = 0.001,
    pullRange = 0.34,
    strikeDuration = 0.12,
    holdDuration = 0.05,
    contactProgress = 0.9
  } = {}) {
    this.idleGap = idleGap;
    this.contactGap = contactGap;
    this.pullRange = pullRange;
    this.strikeDuration = strikeDuration;
    this.holdDuration = holdDuration;
    this.contactProgress = contactProgress;
    this.reset();
  }

  reset() {
    this.state = CUE_SHOT_STATES.IDLE;
    this.livePower = 0;
    this.shotPower = 0;
    this.strikeTimer = 0;
    this.hitTriggered = false;
    this.zStart = 0;
    this.anchorPosition = null;
    this.anchorYaw = 0;
  }

  onPowerDragStart({ anchorPosition = null, anchorYaw = 0 } = {}) {
    this.anchorPosition = anchorPosition?.clone?.() ?? anchorPosition ?? null;
    this.anchorYaw = Number.isFinite(anchorYaw) ? anchorYaw : 0;
    this.state = CUE_SHOT_STATES.DRAGGING;
  }

  onPowerDrag(power) {
    this.livePower = THREE.MathUtils.clamp(power ?? 0, 0, 1);
    if (this.state !== CUE_SHOT_STATES.STRIKING) {
      this.state = CUE_SHOT_STATES.DRAGGING;
    }
  }

  onPowerRelease(ballRadius) {
    this.shotPower = THREE.MathUtils.clamp(this.livePower ?? 0, 0, 1);
    this.zStart = this.getIdleBack(ballRadius) + this.getPullDistance(this.shotPower);
    this.strikeTimer = 0;
    this.hitTriggered = false;
    this.state = CUE_SHOT_STATES.STRIKING;
    return this.shotPower;
  }

  getIdleBack(ballRadius) {
    return (ballRadius ?? 0) + this.idleGap;
  }

  getContactBack(ballRadius) {
    return (ballRadius ?? 0) + this.contactGap;
  }

  getPullDistance(power = this.livePower) {
    return this.pullRange * easeOutCubic(THREE.MathUtils.clamp(power ?? 0, 0, 1));
  }

  getLatchedPullDistance() {
    return this.getPullDistance(this.shotPower);
  }

  updateCue(dt, ballRadius) {
    const safeDt = Math.max(0, dt ?? 0);
    const idleBack = this.getIdleBack(ballRadius);
    const contactBack = this.getContactBack(ballRadius);
    if (this.state === CUE_SHOT_STATES.STRIKING) {
      this.strikeTimer += safeDt;
      const strikeT = THREE.MathUtils.clamp(this.strikeTimer / Math.max(this.strikeDuration, 1e-6), 0, 1);
      const eased = easeOutCubic(strikeT);
      const z = THREE.MathUtils.lerp(this.zStart, contactBack, eased);
      const contactNow = !this.hitTriggered && strikeT >= this.contactProgress;
      if (contactNow) this.hitTriggered = true;
      const done = this.strikeTimer >= this.strikeDuration + this.holdDuration;
      if (done) {
        this.state = CUE_SHOT_STATES.IDLE;
        this.livePower = 0;
      }
      return { state: this.state, z, strikeT, contactNow, done };
    }
    if (this.state === CUE_SHOT_STATES.DRAGGING) {
      return {
        state: this.state,
        z: idleBack + this.getPullDistance(this.livePower),
        strikeT: 0,
        contactNow: false,
        done: false
      };
    }
    return { state: this.state, z: idleBack, strikeT: 0, contactNow: false, done: false };
  }
}

