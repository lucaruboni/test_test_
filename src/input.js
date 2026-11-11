// Unified input: touch (virtual stick + drag look), controller (Gamepad API), keyboard/mouse.
export class Input {
  constructor() {
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.move = { x: 0, y: 0 };      // x right, y forward
    this.look = { x: 0, y: 0 };      // radians accumulated per frame
    this.fire = false; this.ads = false; this.sprint = false;
    this.pressed = new Set();
    this.active = false;             // true only during a match
    this.sens = 1; this.lefty = false;
    this.gamepadName = null;
    this.keys = {};
    this.t = { mx: 0, my: 0, fire: false, ads: false, sprint: false, joyId: null, jx: 0, jy: 0, look: new Map(), btn: new Map() };
    this.m = { fire: false, ads: false, dx: 0, dy: 0 };
    this.tdx = 0; this.tdy = 0;
    this.gpPrev = [];
    this.gp = { fire: false, ads: false, sprint: false, mx: 0, my: 0 };
    this.bindKeys(); this.bindTouch();
    window.addEventListener('gamepadconnected', e => { this.gamepadName = e.gamepad.id; this.onPad && this.onPad(true, e.gamepad.id); });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadName = null; this.onPad && this.onPad(false); });
  }

  consume(a) { if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; }
  reset() {
    this.pressed.clear(); this.keys = {}; this.fire = this.ads = this.sprint = false;
    const t = this.t; t.mx = t.my = 0; t.fire = t.ads = t.sprint = false; t.joyId = null; t.look.clear(); t.btn.clear();
    this.m.fire = this.m.ads = false; this.m.dx = this.m.dy = 0; this.tdx = this.tdy = 0;
    document.querySelectorAll('[data-btn].on').forEach(e => e.classList.remove('on'));
    const s = document.getElementById('stick'); if (s) s.style.display = 'none';
  }

  bindKeys() {
    const map = { KeyR: 'reload', KeyF: 'use', KeyE: 'use', KeyQ: 'swap', Digit1: 'swap', KeyV: 'knife', Space: 'jump', Escape: 'pause', KeyP: 'pause' };
    window.addEventListener('keydown', e => {
      if (!this.active) return;
      if (!e.repeat && map[e.code]) this.pressed.add(map[e.code]);
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    const cv = document.getElementById('view');
    cv.addEventListener('mousedown', e => {
      if (!this.active || this.isTouchRecent) return;
      if (document.pointerLockElement !== cv && cv.requestPointerLock) { try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* ignore */ } }
      if (e.button === 0) this.m.fire = true;
      if (e.button === 2) this.m.ads = true;
    });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.m.fire = false; if (e.button === 2) this.m.ads = false; });
    window.addEventListener('mousemove', e => {
      if (!this.active || document.pointerLockElement !== cv) return;
      this.m.dx += e.movementX; this.m.dy += e.movementY;
    });
    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  btnDown(b) {
    if (b === 'fire') this.t.fire = true;
    else if (b === 'ads') this.t.ads = !this.t.ads;
    else if (b === 'sprint') this.t.sprint = !this.t.sprint;
    else this.pressed.add(b);
  }

  bindTouch() {
    const zone = document.getElementById('touch');
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    const R = 56;
    const start = e => {
      e.preventDefault(); this.isTouchRecent = true;
      if (!this.active) return;
      for (const t of e.changedTouches) {
        const el = t.target.closest && t.target.closest('[data-btn]');
        if (el) {
          const b = el.dataset.btn;
          this.t.btn.set(t.identifier, el);
          if (b !== 'ads' && b !== 'sprint') el.classList.add('on');
          this.btnDown(b);
          el.classList.toggle('on', b === 'ads' ? this.t.ads : b === 'sprint' ? this.t.sprint : true);
          if (b === 'fire') this.t.look.set(t.identifier, { x: t.clientX, y: t.clientY });
          continue;
        }
        const leftSide = t.clientX < innerWidth * 0.42;
        const joySide = this.lefty ? t.clientX > innerWidth * 0.58 : leftSide;
        if (joySide && this.t.joyId === null) {
          this.t.joyId = t.identifier; this.t.jx = t.clientX; this.t.jy = t.clientY;
          stick.style.display = 'block'; stick.style.left = t.clientX + 'px'; stick.style.top = t.clientY + 'px';
          knob.style.transform = 'translate(-50%,-50%)';
        } else {
          this.t.look.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
    };
    const moveH = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.t.joyId) {
          let dx = t.clientX - this.t.jx, dy = t.clientY - this.t.jy;
          const d = Math.hypot(dx, dy);
          if (d > R) { dx *= R / d; dy *= R / d; }
          this.t.mx = dx / R; this.t.my = -dy / R;
          knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        } else {
          const l = this.t.look.get(t.identifier);
          if (l) { this.tdx += t.clientX - l.x; this.tdy += t.clientY - l.y; l.x = t.clientX; l.y = t.clientY; }
        }
      }
    };
    const end = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.t.joyId) {
          this.t.joyId = null; this.t.mx = this.t.my = 0; stick.style.display = 'none';
          if (this.t.sprint) { this.t.sprint = false; const sb = document.querySelector('[data-btn="sprint"]'); if (sb) sb.classList.remove('on'); }
        }
        this.t.look.delete(t.identifier);
        const el = this.t.btn.get(t.identifier);
        if (el) {
          const b = el.dataset.btn;
          if (b === 'fire') this.t.fire = false;
          if (b !== 'ads' && b !== 'sprint') el.classList.remove('on');
          this.t.btn.delete(t.identifier);
        }
      }
    };
    zone.addEventListener('touchstart', start, { passive: false });
    zone.addEventListener('touchmove', moveH, { passive: false });
    zone.addEventListener('touchend', end, { passive: false });
    zone.addEventListener('touchcancel', end, { passive: false });
  }

  pad() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const g of list) if (g && g.connected) return g;
    return null;
  }

  // Button pressed this frame (for menus)
  padEdge(g, i) { const now = !!(g.buttons[i] && g.buttons[i].pressed); return now && !this.gpPrev[i]; }
  padCommit(g) { this.gpPrev = g.buttons.map(b => b.pressed); }

  poll(dt) {
    // keyboard
    const k = this.keys;
    let mx = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), my = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0);
    let sprint = !!(k.ShiftLeft || k.ShiftRight);
    let lx = this.m.dx * 0.0022 + this.tdx * 0.0052, ly = this.m.dy * 0.0022 + this.tdy * 0.0052;
    this.m.dx = this.m.dy = this.tdx = this.tdy = 0;
    // touch
    if (this.t.joyId !== null) {
      mx = this.t.mx; my = this.t.my;
      if (my > 0.93 || this.t.sprint) sprint = true;
    }
    let fire = this.m.fire || this.t.fire, ads = this.m.ads || this.t.ads;
    // gamepad
    const g = this.pad();
    if (g) {
      const dz = v => Math.abs(v) < 0.16 ? 0 : (v - Math.sign(v) * 0.16) / 0.84;
      const ax = dz(g.axes[0] || 0), ay = dz(g.axes[1] || 0), rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0);
      if (ax || ay) { mx = ax; my = -ay; }
      const curve = v => v * Math.abs(v);
      const B = i => !!(g.buttons[i] && (g.buttons[i].pressed || g.buttons[i].value > 0.4));
      const slow = B(6) ? 0.55 : 1;
      lx += curve(rx) * 3.2 * dt * slow; ly += curve(ry) * 2.2 * dt * slow;
      if (B(7)) fire = true;
      if (B(6)) ads = true;
      if (this.padEdge(g, 10)) this.gp.sprint = true;
      if (!(ax || ay) || my < 0.3) this.gp.sprint = false;
      if (this.gp.sprint) sprint = true;
      if (this.active) {
        if (this.padEdge(g, 2)) this.pressed.add('usereload');
        if (this.padEdge(g, 3)) this.pressed.add('swap');
        if (this.padEdge(g, 0)) this.pressed.add('jump');
        if (this.padEdge(g, 1) || this.padEdge(g, 11)) this.pressed.add('knife');
        if (this.padEdge(g, 5)) this.pressed.add('reload');
        if (this.padEdge(g, 9)) this.pressed.add('pause');
        this.padCommit(g);
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    this.move.x = mx; this.move.y = my;
    this.look.x = lx * this.sens; this.look.y = ly * this.sens;
    this.fire = fire; this.ads = ads; this.sprint = sprint;
  }
}
