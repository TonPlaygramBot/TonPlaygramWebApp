/** Diagnostic only; this observer cannot influence simulation, frame pacing,
 * automatic quality or the renderer. Use wall time, never the clamped game dt. */
export class GameplayFrameStats {
  #intervals = new Float64Array(240);
  #start = 0;
  #count = 0;
  #total = 0;
  #last;
  #publishAt;

  suspend() {
    this.#start = 0;
    this.#count = 0;
    this.#total = 0;
    this.#last = undefined;
    this.#publishAt = undefined;
  }

  #dropOldest() {
    this.#total -= this.#intervals[this.#start];
    this.#start = (this.#start + 1) % this.#intervals.length;
    this.#count--;
  }

  record(now, active) {
    if (!active || !Number.isFinite(now)) { this.suspend(); return null; }
    const previous = this.#last;
    this.#last = now;
    if (previous === undefined || now <= previous) return null;
    const elapsed = now - previous;
    const size = this.#intervals.length;
    if (this.#count === size) this.#dropOldest();
    this.#intervals[(this.#start + this.#count) % size] = elapsed;
    this.#count++;
    this.#total += elapsed;
    // Keep the most recent ~2s, rounded up by one indivisible interval.
    // A single lengthy frame is still retained in full.
    while (this.#count > 1 && this.#total - this.#intervals[this.#start] >= 2000) this.#dropOldest();
    if (this.#publishAt !== undefined && now - this.#publishAt < 500) return null;
    this.#publishAt = now;

    const sorted = Array.from({length: this.#count},
      (_, index) => this.#intervals[(this.#start + index) % size]).sort((a, b) => a - b);
    const fps = this.#count * 1000 / this.#total;
    return {
      fps: fps < 10 ? Math.round(fps * 10) / 10 : Math.round(fps),
      p95: Math.round(sorted[Math.ceil(this.#count * .95) - 1]),
      longestMs: Math.round(sorted[this.#count - 1]),
      samples: this.#count
    };
  }
}
