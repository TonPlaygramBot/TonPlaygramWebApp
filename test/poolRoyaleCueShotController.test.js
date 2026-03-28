import { CueShotController, CUE_SHOT_STATES } from '../webapp/src/pages/Games/poolRoyaleCueShotController.js';

describe('Pool Royale cue shot controller', () => {
  it('follows idle -> dragging -> striking -> idle order with latched power', () => {
    const ctl = new CueShotController();
    expect(ctl.state).toBe(CUE_SHOT_STATES.IDLE);
    ctl.onPowerDragStart({ anchorPosition: { x: 0, y: 0, z: 0 }, anchorYaw: 0 });
    ctl.onPowerDrag(0.75);
    expect(ctl.state).toBe(CUE_SHOT_STATES.DRAGGING);
    const shotPower = ctl.onPowerRelease(0.028575);
    expect(shotPower).toBeCloseTo(0.75, 5);
    expect(ctl.state).toBe(CUE_SHOT_STATES.STRIKING);
    ctl.onPowerDrag(0.1);
    expect(ctl.shotPower).toBeCloseTo(0.75, 5);
    let hitCount = 0;
    for (let i = 0; i < 60; i += 1) {
      const sample = ctl.updateCue(1 / 240, 0.028575);
      if (sample.contactNow) hitCount += 1;
    }
    expect(hitCount).toBe(1);
    while (ctl.state !== CUE_SHOT_STATES.IDLE) {
      ctl.updateCue(1 / 120, 0.028575);
    }
    expect(ctl.state).toBe(CUE_SHOT_STATES.IDLE);
  });
});

