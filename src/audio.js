// Sound effects synthesised with WebAudio (no audio files).
let ctx = null, master = null, noiseBuf = null, vol = 0.7;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = vol;
  master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { vol = v; if (master) master.gain.value = v; }

function noise(dur, freq, gain, type = 'lowpass') {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
  const g = ctx.createGain(); const t = ctx.currentTime;
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}
function tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
  const o = ctx.createOscillator(); o.type = type;
  const g = ctx.createGain(); const t = ctx.currentTime + delay;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}

const S = {
  pistol() { noise(0.12, 2600, 0.5); tone(220, 60, 0.1, 0.35, 'square'); },
  smg() { noise(0.08, 3200, 0.4); tone(260, 80, 0.07, 0.25, 'square'); },
  ar() { noise(0.12, 2200, 0.5); tone(180, 50, 0.1, 0.35, 'square'); },
  lmg() { noise(0.14, 1800, 0.55); tone(150, 45, 0.12, 0.4, 'square'); },
  shotgun() { noise(0.3, 1400, 0.8); tone(120, 35, 0.22, 0.5, 'square'); },
  sniper() { noise(0.45, 1700, 0.9); tone(140, 30, 0.3, 0.5, 'sawtooth'); },
  energy() { tone(1400, 120, 0.3, 0.3, 'sawtooth'); tone(700, 60, 0.35, 0.25, 'square'); noise(0.2, 5000, 0.2, 'highpass'); },
  empty() { tone(900, 700, 0.03, 0.15, 'square'); },
  reload() { noise(0.05, 4000, 0.2, 'highpass'); tone(500, 300, 0.05, 0.1, 'square', 0.12); },
  knife() { noise(0.12, 6000, 0.3, 'highpass'); },
  hit() { tone(1200, 900, 0.04, 0.08, 'square'); },
  kill() { tone(300, 80, 0.18, 0.2, 'sawtooth'); },
  hurt() { tone(90, 40, 0.25, 0.6, 'sine'); noise(0.15, 500, 0.4); },
  buy() { tone(660, 660, 0.09, 0.2, 'triangle'); tone(990, 990, 0.14, 0.2, 'triangle', 0.09); },
  deny() { tone(160, 120, 0.15, 0.2, 'square'); },
  groan() { const f = 60 + Math.random() * 50; tone(f, f * 0.7, 0.7, 0.12, 'sawtooth'); },
  round() { [220, 261, 311, 415].forEach((f, i) => tone(f, f, 0.9, 0.16, 'triangle', i * 0.22)); },
  roundEnd() { [415, 311, 261, 196].forEach((f, i) => tone(f, f, 0.7, 0.14, 'triangle', i * 0.18)); },
  crate() { for (let i = 0; i < 10; i++) tone(500 + i * 90, 500 + i * 90, 0.12, 0.1, 'triangle', i * 0.3); },
  down() { tone(200, 30, 1.2, 0.5, 'sawtooth'); },
  click() { tone(800, 600, 0.04, 0.1, 'triangle'); },
};

export function sfx(name) {
  if (!ctx || ctx.state !== 'running') return;
  try { (S[name] || S.click)(); } catch (e) { /* ignore */ }
}
