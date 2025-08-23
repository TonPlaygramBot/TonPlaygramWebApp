export class PowerSlider {
  constructor(opts = {}) {
    const {
      mount,
      value = 0,
      min = 0,
      max = 100,
      step = 1,
      cueSrc = '',
      onChange,
      onCommit,
      theme = 'default',
      labels = false
    } = opts;

    if (!mount) throw new Error('mount required');

    this.min = min;
    this.max = max;
    this.step = step;
    this.onChange = onChange;
    this.onCommit = onCommit;
    this.locked = false;

    this.el = document.createElement('div');
    this.el.className = `ps ps-theme-${theme}`;
    this.el.tabIndex = 0;
    this.el.setAttribute('role', 'slider');
    this.el.setAttribute('aria-orientation', 'vertical');
    this.el.setAttribute('aria-valuemin', String(this.min));
    this.el.setAttribute('aria-valuemax', String(this.max));

    this.track = document.createElement('div');
    this.track.className = 'ps-track';
    this.trackFill = document.createElement('div');
    this.trackFill.className = 'ps-track-fill';
    this.track.appendChild(this.trackFill);
    this.el.appendChild(this.track);

    this.handle = document.createElement('div');
    this.handle.className = 'ps-handle';
    this.handleText = document.createElement('span');
    this.handleText.className = 'ps-handle-text';
    this.handleText.textContent = 'Pull';
    this.handle.append(this.handleText);

    this.cueImg = document.createElement('img');
    this.cueImg.className = 'ps-cue-img';
    this.cueImg.alt = '';
    if (cueSrc) this.cueImg.src = cueSrc;
    this.handle.append(this.cueImg);

    this.el.appendChild(this.handle);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'ps-tooltip';
    this.el.appendChild(this.tooltip);

    if (labels) {
      const wrap = document.createElement('div');
      const l0 = document.createElement('span');
      l0.className = 'ps-label ps-label-0';
      l0.textContent = '0';
      const l50 = document.createElement('span');
      l50.className = 'ps-label ps-label-50';
      l50.textContent = '50';
      const l100 = document.createElement('span');
      l100.className = 'ps-label ps-label-100';
      l100.textContent = '100';
      wrap.append(l0, l50, l100);
      this.el.appendChild(wrap);
    }

    mount.appendChild(this.el);

    this._onPointerDown = this._pointerDown.bind(this);
    this._onPointerMove = this._pointerMove.bind(this);
    this._onPointerUp = this._pointerUp.bind(this);
    this._onWheel = this._wheel.bind(this);
    this._onKeyDown = this._keyDown.bind(this);
    this._onResize = () => this._update(false);

    this.el.addEventListener('pointerdown', this._onPointerDown);
    this.el.addEventListener('wheel', this._onWheel, { passive: false });
    this.el.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('resize', this._onResize);

    this.cueImg.addEventListener('load', () => this._update(false));

    this.set(value);
  }

  get() {
    return this.value;
  }

  set(v, { animate = false } = {}) {
    const value = this._clamp(this._step(v));
    this.value = value;
    if (!animate) this.el.classList.add('ps-no-animate');
    else this.el.classList.remove('ps-no-animate');
    this._update(animate);
    if (!animate)
      requestAnimationFrame(() => this.el.classList.remove('ps-no-animate'));
    if (typeof this.onChange === 'function') this.onChange(value);
  }

  lock() {
    this.locked = true;
    this.el.classList.add('ps-locked');
    this.el.tabIndex = -1;
    this.el.setAttribute('aria-disabled', 'true');
  }

  unlock() {
    this.locked = false;
    this.el.classList.remove('ps-locked');
    this.el.tabIndex = 0;
    this.el.setAttribute('aria-disabled', 'false');
  }

  destroy() {
    this.el.removeEventListener('pointerdown', this._onPointerDown);
    this.el.removeEventListener('wheel', this._onWheel);
    this.el.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('resize', this._onResize);
    this.el.remove();
  }

  /* internal methods */
  _clamp(v) {
    return Math.min(this.max, Math.max(this.min, v));
  }

  _step(v) {
    const s = this.step;
    return Math.round((v - this.min) / s) * s + this.min;
  }

  _update(animate = true) {
    const range = this.max - this.min || 1;
    const ratio = (this.value - this.min) / range;
    const trackH = this.el.clientHeight;
    const handleH = this.handle.offsetHeight;
    const y = ratio * (trackH - handleH);
    this.handle.style.transform = `translate(0, ${y}px)`;
    const ttH = this.tooltip.offsetHeight;
    this.tooltip.style.transform = `translate(0, ${y - ttH - 8}px)`;
    this.trackFill.style.height = `${ratio * 100}%`;
    this.track.style.opacity = ratio > 0 ? 1 : 0;
    this._updateHandleColor(ratio);
    this.tooltip.textContent = `${Math.round(this.value)}%`;
    this.el.setAttribute('aria-valuenow', String(Math.round(this.value)));
    if (ratio >= 0.9) this.el.classList.add('ps-hot');
    else this.el.classList.remove('ps-hot');
  }

  _updateHandleColor(ratio) {
    const low = { r: 255, g: 224, b: 102 }; // #ffe066
    const high = { r: 255, g: 0, b: 51 }; // #ff0033
    const r = Math.round(low.r + (high.r - low.r) * ratio);
    const g = Math.round(low.g + (high.g - low.g) * ratio);
    const b = Math.round(low.b + (high.b - low.b) * ratio);
    const color = `rgb(${r},${g},${b})`;
    this.handle.style.background = color;
  }

  _updateFromClientY(y) {
    const rect = this.el.getBoundingClientRect();
    const pos = (y - rect.top) / rect.height; // 0 at top, 1 at bottom
    const ratio = Math.min(Math.max(pos, 0), 1);
    const value = this.min + ratio * (this.max - this.min);
    this.set(value);
  }

  _pointerDown(e) {
    if (this.locked) return;
    e.preventDefault();
    this.dragging = true;
    this.el.classList.add('ps-no-animate');
    this.el.setPointerCapture(e.pointerId);
    this._updateFromClientY(e.clientY);
    this.el.addEventListener('pointermove', this._onPointerMove);
    this.el.addEventListener('pointerup', this._onPointerUp);
  }

  _pointerMove(e) {
    if (!this.dragging) return;
    this._updateFromClientY(e.clientY);
  }

  _pointerUp(e) {
    if (!this.dragging) return;
    this.dragging = false;
    this.el.releasePointerCapture(e.pointerId);
    this.el.removeEventListener('pointermove', this._onPointerMove);
    this.el.removeEventListener('pointerup', this._onPointerUp);
    this.el.classList.remove('ps-no-animate');
    if (typeof this.onCommit === 'function') this.onCommit(this.value);
  }

  _wheel(e) {
    if (this.locked) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    this.set(this.value + dir * this.step, { animate: true });
    if (typeof this.onCommit === 'function') this.onCommit(this.value);
  }

  _keyDown(e) {
    if (this.locked) return;
    let handled = false;
    let inc = e.shiftKey ? this.step * 5 : this.step;
    if (e.key === 'ArrowDown') {
      this.set(this.value + inc);
      handled = true;
    } else if (e.key === 'ArrowUp') {
      this.set(this.value - inc);
      handled = true;
    } else if (e.key === 'Enter') {
      if (typeof this.onCommit === 'function') this.onCommit(this.value);
      handled = true;
    }
    if (handled) e.preventDefault();
  }
}
