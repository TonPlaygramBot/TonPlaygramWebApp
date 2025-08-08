export function createRollStateMachine({ apiRoll, animate, apply }) {
  const state = { phase: 'IDLE' };

  async function roll(roomId) {
    if (state.phase !== 'IDLE') return false;
    state.phase = 'ROLL_REQUESTED';
    const nonce = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    let res;
    try {
      res = await apiRoll(roomId, nonce);
    } catch (err) {
      state.phase = 'IDLE';
      throw err;
    }
    if (!res || typeof res.value !== 'number' || !res.sig) {
      state.phase = 'IDLE';
      throw new Error('Malformed roll result');
    }
    state.phase = 'ANIMATING';
    await animate(res.value);
    apply(res.value);
    state.phase = 'APPLIED';
    // microtask before returning to IDLE to allow observers to read APPLIED
    await Promise.resolve();
    state.phase = 'IDLE';
    return res.value;
  }

  return {
    roll,
    get phase() {
      return state.phase;
    }
  };
}
