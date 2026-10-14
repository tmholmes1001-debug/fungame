// Sound. The house and the phone are synthesized live with Web Audio; her
// voice is real speech (generated offline, see voices.js) placed in space:
// downstairs, on the stairs, behind the door, in the room, in your ear.
const Sound = (() => {
  let ctx, master, world, self, verbIn, noiseBuf, comp;
  const buffers = {};
  const amb = {};
  let clockTimer = null, heartTimer = null, breathTimer = null, ringTimer = null;
  let heartBpm = 0, heartVol = 0.4, breathRate = 0, breathVol = 0.25;

  const now = () => ctx.currentTime;
  const rnd = (a, b) => a + Math.random() * (b - a);

  async function init() {
    if (ctx) { await ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -8; comp.knee.value = 6; comp.ratio.value = 10; comp.attack.value = 0.002; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ctx.destination);
    world = ctx.createGain(); world.connect(master);
    self = ctx.createGain(); self.connect(master);
    const verb = ctx.createConvolver(), len = ctx.sampleRate * 2.4, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.connect(verb).connect(world);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    await ctx.resume();
    // decode her voice
    await Promise.all(Object.entries(VOICES).map(async ([k, b64]) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      try { buffers[k] = await ctx.decodeAudioData(u.buffer); } catch (e) { /* a missing line stays silent */ }
    }));
  }

  const noise = (loop = true) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop; return s; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const gain = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 1) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold); g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  // where a sound is in the house
  const PLACES = {
    down:   { lp: 420,   g: 0.6,  wet: 0.9 },
    stairs: { lp: 1300,  g: 0.8,  wet: 0.6 },
    hall:   { lp: 2400,  g: 0.95, wet: 0.45 },
    room:   { lp: 9000,  g: 1.0,  wet: 0.18 },
    near:   { lp: 16000, g: 1.2,  wet: 0.03 },
    phone:  { lp: 7000,  g: 0.9,  wet: 0.05 },
  };
  function place(where = 'room', pan = 0, bus) {
    const p = PLACES[where] || PLACES.room;
    const g = gain(p.g), lp = filt('lowpass', p.lp, 0.7), pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(lp).connect(pn).connect(bus || world);
    if (p.wet > 0.05) { const w = gain(p.wet); pn.connect(w).connect(verbIn); }
    return g;
  }

  // ------------------------------------------------------------ voice
  function voice(id, { where = 'room', pan = 0, vol = 1, rate = 1, delay = 0, bus } = {}) {
    const b = ctx && buffers[id]; if (!b) return 0;
    const s = ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = gain(vol); s.connect(g).connect(where === 'ear' ? self : place(where, pan, bus));
    s.start(now() + delay);
    return (b.duration / rate + delay) * 1000;
  }
  // many of her, all around you, not quite in time
  function chorus(ids, { count = 5, where = 'room', spread = 1, vol = 0.55 } = {}) {
    let longest = 0;
    for (let i = 0; i < count; i++) {
      const id = ids[i % ids.length];
      longest = Math.max(longest, voice(id, { where, pan: (Math.random() * 2 - 1) * spread, vol: vol * rnd(0.6, 1), rate: rnd(0.86, 1.04), delay: i * rnd(0.12, 0.45) }));
    }
    return longest;
  }

  // ------------------------------------------------------------ ambience
  function startAmbience() {
    // the house hum: two sines beating, low
    const dg = gain(0); dg.connect(world);
    [49, 49.7, 98.4].forEach((f, i) => { const o = osc('sine', f), g = gain(i === 2 ? 0.2 : 0.5); o.connect(g).connect(dg); o.start(); });
    const rum = noise(), rf = filt('lowpass', 120, 0.7), rg = gain(0.5); rum.connect(rf).connect(rg).connect(dg); rum.start();
    dg.gain.linearRampToValueAtTime(0.06, now() + 4); amb.drone = dg;
    // fridge downstairs, faint
    const fr = osc('sawtooth', 60), ff = filt('lowpass', 180), fg = gain(0.012); fr.connect(ff).connect(fg).connect(place('down', 0)); fr.start(); amb.fridge = fg;
    // wind against the window
    const w = noise(), wf = filt('bandpass', 400, 0.6), wg = gain(0); w.connect(wf).connect(wg).connect(place('room', 0.7)); w.start();
    const lfo = osc('sine', 0.07), lg = gain(220); lfo.connect(lg).connect(wf.frequency); lfo.start();
    wg.gain.linearRampToValueAtTime(0.025, now() + 5); amb.wind = wg;
    // dread: a sour high partial that rises with her attention
    const hg = gain(0); hg.connect(place('room', 0));
    const h1 = osc('sine', 233), h2 = osc('sine', 246.9), v = osc('sine', 0.13), vg = gain(5);
    v.connect(vg).connect(h1.frequency); [h1, h2, v].forEach(o => o.start()); h1.connect(hg); h2.connect(hg); amb.dread = hg;
    const sub = osc('sine', 31), sg = gain(0); sub.connect(sg).connect(world); sub.start(); amb.sub = sg;
    clock(true);
  }
  function setDread(x) {
    if (!amb.dread) return;
    amb.dread.gain.setTargetAtTime(x * 0.018, now(), 0.8);
    amb.sub.gain.setTargetAtTime(x * 0.25, now(), 1.2);
    amb.drone.gain.setTargetAtTime(0.06 + x * 0.06, now(), 1);
  }
  function clock(on) {
    clearInterval(clockTimer); if (!on) return;
    let tock = false;
    clockTimer = setInterval(() => {
      const t = now(), n = noise(false), b = filt('bandpass', tock ? 2300 : 3100, 9), g = gain(0);
      n.connect(b).connect(g).connect(place('room', -0.55)); env(g, t, 0.001, 0.2, 0.004, 0.03); n.start(t); n.stop(t + 0.06); tock = !tock;
    }, 1000);
  }
  function silence(secs = 0.4) {
    clock(false);
    ['drone', 'fridge', 'wind', 'dread', 'sub'].forEach(k => amb[k] && amb[k].gain.setTargetAtTime(0.0001, now(), secs / 3));
  }
  function stopAll(secs = 0.03) {
    clock(false); setHeart(0); setBreath(0); ring(false); stopFeed();
    master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(master.gain.value, now());
    master.gain.linearRampToValueAtTime(0.0001, now() + secs);
  }
  function restore(secs = 0.5) { master.gain.cancelScheduledValues(now()); master.gain.setValueAtTime(0.0001, now()); master.gain.linearRampToValueAtTime(0.9, now() + secs); }

  // ------------------------------------------------------------ the house
  function thump(where, pan, w = 1, t = now()) {
    const out = place(where, pan), o = osc('sine', 85 * w), g = gain(0);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.16); o.connect(g).connect(out); env(g, t, 0.004, 0.9 * w, 0.02, 0.18); o.start(t); o.stop(t + 0.3);
    const n = noise(false), f = filt('lowpass', 420), ng = gain(0); n.connect(f).connect(ng).connect(out); env(ng, t, 0.002, 0.5 * w, 0.01, 0.07); n.start(t); n.stop(t + 0.15);
  }
  function creak(where = 'room', pan = 0, dur = 0.9, pitch = 1, vol = 0.45, t = now()) {
    const out = place(where, pan), src = osc('sawtooth', rnd(28, 45) * pitch), g = gain(0);
    src.frequency.setValueAtTime(src.frequency.value, t);
    src.frequency.linearRampToValueAtTime(src.frequency.value * rnd(1.3, 2.2), t + dur * 0.7);
    const b1 = filt('bandpass', rnd(420, 620) * pitch, 14), b2 = filt('bandpass', rnd(1100, 1500) * pitch, 18), mix = gain(1);
    src.connect(b1).connect(mix); src.connect(b2).connect(mix); mix.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.25); g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function step(where, pan, w = 1) { thump(where, pan, w); if (Math.random() < 0.7) creak(where, pan, rnd(0.25, 0.6), rnd(0.8, 1.3), 0.3 * w, now() + 0.03); }
  function knock(pattern = [0, 0.45, 0.62], vol = 1, where = 'hall', pan = -0.55) {
    const t0 = now();
    pattern.forEach(dt => {
      const t = t0 + dt, out = place(where, pan), o = osc('sine', 140), g = gain(0);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.08); o.connect(g).connect(out); env(g, t, 0.001, 0.9 * vol, 0.005, 0.12); o.start(t); o.stop(t + 0.2);
      const n = noise(false), f = filt('bandpass', 700, 1.4), ng = gain(0); n.connect(f).connect(ng).connect(out); env(ng, t, 0.001, 0.7 * vol, 0.004, 0.05); n.start(t); n.stop(t + 0.1);
    });
  }
  // fists on the door: heavy, rattling the frame
  function bang(times = 4, vol = 1.2) {
    for (let i = 0; i < times; i++) {
      const t = now() + i * rnd(0.22, 0.34), out = place('hall', -0.55);
      const o = osc('sine', 70), g = gain(0); o.frequency.exponentialRampToValueAtTime(30, t + 0.25); o.connect(g).connect(out); env(g, t, 0.002, 1.3 * vol, 0.03, 0.3); o.start(t); o.stop(t + 0.4);
      const n = noise(false), f = filt('lowpass', 900), ng = gain(0); n.connect(f).connect(ng).connect(out); env(ng, t, 0.001, 1.1 * vol, 0.02, 0.12); n.start(t); n.stop(t + 0.2);
      const r = noise(false), rf = filt('bandpass', 2600, 6), rg = gain(0); r.connect(rf).connect(rg).connect(out); env(rg, t + 0.01, 0.002, 0.25 * vol, 0.05, 0.2); r.start(t); r.stop(t + 0.35);
    }
  }
  function kettle(secs = 7) {
    const t = now(), out = place('down', 0.1), o = osc('sine', 1350), vib = osc('sine', 6.2), vg = gain(18), g = gain(0);
    vib.connect(vg).connect(o.frequency); o.frequency.linearRampToValueAtTime(2050, t + secs * 0.8); o.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + secs * 0.85); g.gain.setValueAtTime(0.2, t + secs - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + secs);
    [o, vib].forEach(s => { s.start(t); s.stop(t + secs + 0.1); });
  }
  function mugs() { [0, 0.25].forEach(dt => { const t = now() + dt, o = osc('sine', 2200 + dt * 600), g = gain(0); o.connect(g).connect(place('down', 0.1)); env(g, t, 0.001, 0.15, 0, 0.4); o.start(t); o.stop(t + 0.5); }); }
  function doorCreak(secs = 2.6) { creak('room', -0.55, secs, 0.55, 0.55); creak('room', -0.55, secs * 0.8, 0.9, 0.25, now() + 0.2); }
  function bedSink() { thump('near', 0, 0.8); creak('near', 0.1, 1.4, 0.6, 0.6, now() + 0.05); }
  function otherBreath(where = 'near', pan = 0.6, count = 2, vol = 0.45) {
    for (let i = 0; i < count; i++) {
      const t = now() + i * 2.6, n = noise(false), b = filt('bandpass', 520, 1.2), g = gain(0);
      n.connect(b).connect(g).connect(place(where, pan));
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 1.1); g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
      g.gain.linearRampToValueAtTime(vol * 0.8, t + 1.9); g.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      n.start(t); n.stop(t + 2.6);
    }
  }

  // ------------------------------------------------------------ the phone
  function ping() {
    [[1568, 0], [2093, 0.09]].forEach(([f, dt]) => {
      const t = now() + dt, o = osc('sine', f), o2 = osc('sine', f * 2), g = gain(0);
      o.connect(g); o2.connect(g); g.connect(place('phone', 0.05)); env(g, t, 0.003, 0.35, 0.02, 0.35);
      o.start(t); o2.start(t); o.stop(t + 0.5); o2.stop(t + 0.5);
    });
  }
  function buzz(times = 2) {
    for (let i = 0; i < times; i++) {
      const t = now() + i * 0.5, out = place('near', 0.05), o = osc('square', 158), f = filt('lowpass', 480), g = gain(0);
      o.connect(f).connect(g).connect(out); env(g, t, 0.01, 0.16, 0.28, 0.04); o.start(t); o.stop(t + 0.4);
    }
  }
  function ring(on, muted) {
    clearInterval(ringTimer); if (!on) return;
    const play = () => {
      if (!muted()) [988, 1319, 1175, 1568, 1319, 1760].forEach((f, i) => {
        const t = now() + i * 0.12, o = osc('triangle', f), o2 = osc('sine', f * 2.01), g = gain(0);
        o.connect(g); o2.connect(g); g.connect(place('phone', 0.05)); env(g, t, 0.003, 0.5, 0.03, 0.16);
        o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
      });
      buzz(1);
    };
    play(); ringTimer = setInterval(play, 1200);
  }
  function click(vol = 0.25) { const t = now(), n = noise(false), f = filt('bandpass', 3500, 3), g = gain(0); n.connect(f).connect(g).connect(self); env(g, t, 0.001, vol, 0.003, 0.02); n.start(t); n.stop(t + 0.05); }
  function shutter() { click(0.6); setTimeout(() => click(0.4), 70); }

  // feed audio: each video has a little loop, quiet, from the phone speaker
  let feedNodes = [];
  function stopFeed() { if (!ctx) return; feedNodes.forEach(n => { try { n.stop(); } catch (e) {} }); feedNodes = []; }
  function feed(kind, muted) {
    if (!ctx) return;
    stopFeed(); if (muted || !kind) return;
    const out = gain(0.55); out.connect(place('phone', 0.05)); const add = n => { feedNodes.push(n); n.start(); return n; };
    if (kind === 'lofi' || kind === 'soft') {
      const notes = kind === 'soft' ? [220, 277.2, 329.6] : [174.6, 220, 261.6, 329.6];
      notes.forEach(f => { const o = add(osc('triangle', f)), g = gain(0.03), lp = filt('lowpass', 900); o.connect(lp).connect(g).connect(out); });
      const n = add(noise()), f = filt('highpass', 5000), g = gain(0.008); n.connect(f).connect(g).connect(out);
    } else if (kind === 'rain') {
      const n = add(noise()), f = filt('bandpass', 2500, 0.4), g = gain(0.05); n.connect(f).connect(g).connect(out);
    } else if (kind === 'bee') {
      const o = add(osc('sawtooth', 660)), v = add(osc('sine', 6)), vg = gain(14), lp = filt('lowpass', 2200), g = gain(0.03);
      v.connect(vg).connect(o.frequency); o.connect(lp).connect(g).connect(out);
      const lfo = add(osc('sine', 0.5)), lg = gain(180); lfo.connect(lg).connect(o.frequency);
    } else if (kind === 'vhs') {
      const o = add(osc('sine', 1000)), g = gain(0.012); o.connect(g).connect(out);
      const n = add(noise()), f = filt('bandpass', 4000, 0.5), ng = gain(0.03); n.connect(f).connect(ng).connect(out);
      const h = add(osc('sawtooth', 50)), hf = filt('lowpass', 200), hg = gain(0.04); h.connect(hf).connect(hg).connect(out);
    } else if (kind === 'static') {
      const n = add(noise()), g = gain(0.06); n.connect(g).connect(out);
    } else if (kind === 'drone') {
      [55, 58.3, 82.4].forEach(f => { const o = add(osc('sawtooth', f)), lp = filt('lowpass', 300), g = gain(0.05); o.connect(lp).connect(g).connect(out); });
    }
  }

  // ------------------------------------------------------------ bodies
  function setHeart(bpm, vol = 0.4) {
    heartBpm = bpm; heartVol = vol; clearTimeout(heartTimer); if (!bpm) return;
    const beat = () => {
      if (!heartBpm) return;
      [[0, 1], [0.17, 0.7]].forEach(([dt, v]) => {
        const t = now() + dt, o = osc('sine', 58), g = gain(0); o.frequency.exponentialRampToValueAtTime(34, t + 0.12);
        o.connect(g).connect(self); env(g, t, 0.006, heartVol * v, 0.02, 0.14); o.start(t); o.stop(t + 0.25);
      });
      heartTimer = setTimeout(beat, 60000 / heartBpm);
    };
    beat();
  }
  function setBreath(rate, vol = 0.25) {
    breathRate = rate; breathVol = vol; clearTimeout(breathTimer); if (!rate) return;
    const cycle = () => {
      if (!breathRate) return;
      const per = 60 / breathRate, t = now();
      [[0, per * 0.42, 1300, 1], [per * 0.48, per * 0.48, 800, 0.8]].forEach(([dt, d, f, v]) => {
        const n = noise(false), b = filt('bandpass', f, 0.9), g = gain(0); n.connect(b).connect(g).connect(self);
        g.gain.setValueAtTime(0.0001, t + dt); g.gain.linearRampToValueAtTime(breathVol * v * 0.5, t + dt + d * 0.35); g.gain.linearRampToValueAtTime(0.0001, t + dt + d);
        n.start(t + dt); n.stop(t + dt + d + 0.05);
      });
      breathTimer = setTimeout(cycle, per * 1000);
    };
    cycle();
  }

  // ------------------------------------------------------------ stingers
  function sting(vol = 1) {
    const t = now(), out = place('near', 0), g = gain(0), lp = filt('lowpass', 400, 2);
    lp.frequency.exponentialRampToValueAtTime(3200, t + 0.25); lp.frequency.exponentialRampToValueAtTime(500, t + 2.6);
    [233.1, 246.9, 261.6, 466.2, 493.9].forEach(f => { const o = osc('sawtooth', f), v = osc('sine', rnd(5, 7)), vg = gain(f * 0.012); v.connect(vg).connect(o.frequency); o.connect(g); o.start(t); v.start(t); o.stop(t + 3); v.stop(t + 3); });
    g.connect(lp).connect(out); env(g, t, 0.05, 0.13 * vol, 0.3, 2.4); thump('near', 0, 0.9, t);
  }
  function shriek(vol = 1) {
    const t = now(), out = self, sh = ctx.createWaveShaper(), cv = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) cv[i] = Math.tanh((i / 512 - 1) * 6); sh.curve = cv;
    const g = gain(0); sh.connect(g).connect(out);
    [620, 655, 940, 1310].forEach((f, i) => {
      const o = osc('sawtooth', f), v = osc('sine', rnd(11, 17)), vg = gain(f * 0.05); v.connect(vg).connect(o.frequency);
      o.frequency.setValueAtTime(f * 1.2, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 1.6);
      const og = gain(i < 2 ? 0.3 : 0.18); o.connect(og).connect(sh); o.start(t); v.start(t); o.stop(t + 1.8); v.stop(t + 1.8);
    });
    env(g, t, 0.004, 0.45 * vol, 1.1, 0.5);
    const b = osc('sine', 72), bg = gain(0); b.frequency.exponentialRampToValueAtTime(24, t + 1.1); b.connect(bg).connect(out); env(bg, t, 0.002, 1.3, 0.3, 0.9); b.start(t); b.stop(t + 1.5);
  }

  return {
    init, voice, chorus, startAmbience, setDread, clock, silence, stopAll, restore,
    step, creak, knock, bang, kettle, mugs, doorCreak, bedSink, otherBreath,
    ping, buzz, ring, click, shutter, feed, stopFeed, setHeart, setBreath, sting, shriek,
    dur: id => (buffers[id] ? buffers[id].duration * 1000 : 0),
  };
})();
