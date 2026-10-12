// All sound is synthesized live with Web Audio. No samples.
// Two buses: "world" (things in the house, muffled when you hide) and "self"
// (your breath, your heart, and anything that is under the blanket with you).
const Sound = (() => {
  let ctx, master, world, self, muffle, verb, verbIn, noiseBuf, comp;
  const amb = {};
  let clockOn = false, clockTimer = null;
  let heartBpm = 0, heartTimer = null, heartGain = 0.5;
  let breathRate = 0, breathTimer = null, breathGain = 0.3;

  const now = () => ctx.currentTime;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function init() {
    if (ctx) return ctx.resume();
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 8;
    comp.attack.value = 0.002; comp.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);

    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 18000; muffle.Q.value = 0.5;
    world = ctx.createGain(); world.connect(muffle).connect(master);
    self = ctx.createGain(); self.connect(master);

    // small hallway reverb from a decaying noise impulse
    verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir; verbIn = ctx.createGain(); verbIn.gain.value = 0.6;
    verbIn.connect(verb).connect(world);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ctx.resume();
  }

  function noise(loop = true) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = loop;
    s.loopStart = Math.random() * 2; return s;
  }
  function osc(type, f) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function filt(type, f, q = 1) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  // Where a sound lives in the house. Distance = less treble, more reverb.
  const PLACES = {
    down:   { lp: 380,   g: 0.55, wet: 0.9 },
    stairs: { lp: 1100,  g: 0.75, wet: 0.6 },
    hall:   { lp: 2600,  g: 0.9,  wet: 0.45 },
    room:   { lp: 9000,  g: 1.0,  wet: 0.15 },
    near:   { lp: 16000, g: 1.15, wet: 0.04 },
  };
  function place(where = 'room', pan = 0, bus) {
    const p = PLACES[where] || PLACES.room;
    const g = gain(p.g), lp = filt('lowpass', p.lp, 0.7), pn = ctx.createStereoPanner();
    pn.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(lp).connect(pn).connect(bus || world);
    if (p.wet > 0.05) { const w = gain(p.wet); pn.connect(w).connect(verbIn); }
    return g;
  }

  // ---------- ambience ----------
  function startAmbience() {
    // rain against the window
    const r = noise(), rh = filt('highpass', 500), rl = filt('lowpass', 5200), rg = gain(0);
    r.connect(rh).connect(rl).connect(rg).connect(place('room', 0.05));
    r.start(); rg.gain.linearRampToValueAtTime(0.05, now() + 4);
    amb.rain = { src: r, g: rg };
    amb.dropTimer = setInterval(() => { if (amb.rainOn !== false && Math.random() < 0.6) drop(); }, 140);

    // the house hum: two sines beating against each other, very low
    const dg = gain(0); dg.connect(world);
    const ds = [osc('sine', 49), osc('sine', 49.8), osc('sine', 98.5)];
    ds.forEach((o, i) => { const g = gain(i === 2 ? 0.25 : 0.5); o.connect(g).connect(dg); o.start(); });
    const rum = noise(), rumf = filt('lowpass', 110, 0.8), rumg = gain(0.6);
    rum.connect(rumf).connect(rumg).connect(dg); rum.start();
    dg.gain.linearRampToValueAtTime(0.07, now() + 6);
    amb.drone = { g: dg };

    // dread layer: a high, sour partial that only fades in as fear rises
    const hg = gain(0); hg.connect(place('room', 0));
    const h1 = osc('sine', 233), h2 = osc('sine', 247.5), lfo = osc('sine', 0.13), lfog = gain(6);
    lfo.connect(lfog).connect(h1.frequency); lfo.start();
    h1.connect(hg); h2.connect(hg); h1.start(); h2.start();
    amb.dread = { g: hg };
    clock(true);
  }
  function drop() {
    const t = now(), s = osc('sine', rnd(2400, 5200)), g = gain(0);
    s.frequency.exponentialRampToValueAtTime(rnd(900, 1600), t + 0.03);
    s.connect(g).connect(place('room', rnd(-0.1, 0.4)));
    env(g, t, 0.001, rnd(0.004, 0.012), 0, 0.03); s.start(t); s.stop(t + 0.06);
  }
  function rain(on, secs = 3) {
    if (!amb.rain) return; amb.rainOn = on;
    amb.rain.g.gain.cancelScheduledValues(now());
    amb.rain.g.gain.setTargetAtTime(on ? 0.05 : 0.0001, now(), secs / 3);
  }
  function drone(level, secs = 3) {
    if (!amb.drone) return; amb.drone.g.gain.setTargetAtTime(level, now(), secs / 3);
  }
  function dread(level, secs = 4) {
    if (!amb.dread) return; amb.dread.g.gain.setTargetAtTime(level * 0.02, now(), secs / 3);
  }
  function clock(on) {
    clockOn = on; clearInterval(clockTimer);
    if (!on) return;
    let tock = false;
    clockTimer = setInterval(() => {
      if (!clockOn) return;
      const t = now(), n = noise(false), b = filt('bandpass', tock ? 2300 : 3100, 9), g = gain(0);
      n.connect(b).connect(g).connect(place('room', -0.35));
      env(g, t, 0.001, 0.22, 0.004, 0.03); n.start(t); n.stop(t + 0.06); tock = !tock;
    }, 1000);
  }
  function muffled(on) {
    muffle.frequency.cancelScheduledValues(now());
    muffle.frequency.setTargetAtTime(on ? 420 : 18000, now(), on ? 0.08 : 0.25);
    world.gain.setTargetAtTime(on ? 0.75 : 1, now(), 0.1);
  }
  function stopAll(secs = 0.05) {
    clock(false); setHeart(0); setBreath(0);
    master.gain.cancelScheduledValues(now());
    master.gain.setValueAtTime(master.gain.value, now());
    master.gain.linearRampToValueAtTime(0.0001, now() + secs);
  }
  function restoreMaster(v = 0.9, secs = 0.5) {
    master.gain.cancelScheduledValues(now());
    master.gain.setValueAtTime(0.0001, now());
    master.gain.linearRampToValueAtTime(v, now() + secs);
  }
  function killAmbience() {
    rain(false, 0.1); drone(0, 0.1); dread(0, 0.1); clock(false);
    clearInterval(amb.dropTimer);
    ['rain'].forEach(k => { try { amb[k].src.stop(now() + 0.5); } catch (e) {} });
    amb.rain = null;
  }

  // ---------- house sounds ----------
  function thump(where, pan, weight = 1, t = now()) {
    const out = place(where, pan);
    const o = osc('sine', 85 * weight), g = gain(0);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.16);
    o.connect(g).connect(out); env(g, t, 0.004, 0.9 * weight, 0.02, 0.18); o.start(t); o.stop(t + 0.3);
    const n = noise(false), f = filt('lowpass', 420), ng = gain(0);
    n.connect(f).connect(ng).connect(out); env(ng, t, 0.002, 0.5 * weight, 0.01, 0.07); n.start(t); n.stop(t + 0.15);
  }
  // wood creak: a stick-slip pulse train ringing two resonances
  function creak(where = 'room', pan = 0, dur = 0.9, pitch = 1, vol = 0.5, t = now()) {
    const out = place(where, pan);
    const src = osc('sawtooth', rnd(28, 45) * pitch), g = gain(0);
    src.frequency.setValueAtTime(src.frequency.value, t);
    src.frequency.linearRampToValueAtTime(src.frequency.value * rnd(1.3, 2.2), t + dur * 0.7);
    src.frequency.linearRampToValueAtTime(src.frequency.value * rnd(0.8, 1.2), t + dur);
    const b1 = filt('bandpass', rnd(420, 620) * pitch, 14), b2 = filt('bandpass', rnd(1100, 1500) * pitch, 18), mix = gain(1);
    src.connect(b1).connect(mix); src.connect(b2).connect(mix); mix.connect(g).connect(out);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.25);
    g.gain.linearRampToValueAtTime(vol * 0.6, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function step(where, pan, weight = 1) {
    thump(where, pan, weight);
    if (Math.random() < 0.7) creak(where, pan, rnd(0.25, 0.6), rnd(0.8, 1.3), 0.35 * weight, now() + 0.03);
  }
  function knock(where = 'hall', pan = -0.7, pattern = [0, 0.55, 0.75], vol = 1) {
    const t0 = now();
    pattern.forEach(dt => {
      const t = t0 + dt, out = place(where, pan);
      const o = osc('sine', 140), g = gain(0);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.08);
      o.connect(g).connect(out); env(g, t, 0.001, 0.9 * vol, 0.005, 0.12); o.start(t); o.stop(t + 0.2);
      const n = noise(false), f = filt('bandpass', 700, 1.4), ng = gain(0);
      n.connect(f).connect(ng).connect(out); env(ng, t, 0.001, 0.7 * vol, 0.004, 0.05); n.start(t); n.stop(t + 0.1);
    });
  }
  function glassTap(pan = 0.05) {
    [0, 0.32, 0.5].forEach(dt => {
      const t = now() + dt, n = noise(false), f = filt('bandpass', 2700, 6), g = gain(0);
      n.connect(f).connect(g).connect(place('room', pan)); env(g, t, 0.001, 0.9, 0.002, 0.05); n.start(t); n.stop(t + 0.1);
      const o = osc('sine', 3800), og = gain(0); o.connect(og).connect(place('room', pan));
      env(og, t, 0.001, 0.08, 0, 0.12); o.start(t); o.stop(t + 0.2);
    });
  }
  function kettle(secs = 7) {
    const t = now(), out = place('down', 0.1);
    const o = osc('sine', 1350), vib = osc('sine', 6.2), vg = gain(18), g = gain(0);
    vib.connect(vg).connect(o.frequency); o.frequency.linearRampToValueAtTime(2050, t + secs * 0.8);
    const br = noise(), bf = filt('bandpass', 1800, 3), bg = gain(0);
    o.connect(g).connect(out); br.connect(bf).connect(bg).connect(out);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + secs * 0.85);
    g.gain.setValueAtTime(0.18, t + secs - 0.05); g.gain.linearRampToValueAtTime(0.0001, t + secs);
    bg.gain.setValueAtTime(0.0001, t); bg.gain.linearRampToValueAtTime(0.25, t + secs * 0.6); bg.gain.linearRampToValueAtTime(0.0001, t + secs);
    [o, vib, br].forEach(s => { s.start(t); s.stop(t + secs + 0.1); });
  }
  function doorCreak(secs = 2.6) {
    creak('room', -0.75, secs, 0.55, 0.55);
    creak('room', -0.75, secs * 0.8, 0.9, 0.25, now() + 0.2);
  }
  function wardrobeCreak() { creak('room', 0.7, 1.6, 0.7, 0.45); }
  function bedSink() {
    const t = now();
    thump('near', 0, 0.8, t);
    creak('near', 0, 1.4, 0.6, 0.6, t + 0.05);
    // a spring, complaining
    const o = osc('triangle', 640), g = gain(0), am = osc('sine', 17), amg = gain(0.5);
    am.connect(amg).connect(g.gain); o.frequency.linearRampToValueAtTime(560, t + 0.9);
    o.connect(g).connect(place('near', 0.1)); env(g, t + 0.05, 0.01, 0.06, 0.2, 0.7);
    o.start(t); am.start(t); o.stop(t + 1.2); am.stop(t + 1.2);
  }

  // ---------- phone ----------
  function buzz(times = 2) {
    for (let i = 0; i < times; i++) {
      const t = now() + i * 0.55, out = place('near', 0.65);
      const o = osc('square', 158), f = filt('lowpass', 520), g = gain(0);
      const am = osc('sine', 31), amg = gain(0.3); am.connect(amg).connect(g.gain);
      o.connect(f).connect(g).connect(out); env(g, t, 0.01, 0.32, 0.3, 0.04);
      const n = noise(false), nf = filt('bandpass', 950, 2), ng = gain(0);
      n.connect(nf).connect(ng).connect(out); env(ng, t, 0.01, 0.12, 0.3, 0.04);
      [o, am, n].forEach(s => { s.start(t); s.stop(t + 0.42); });
    }
  }
  let ringTimer = null;
  function ring(on, bus) {
    clearInterval(ringTimer);
    if (!on) return;
    const play = () => {
      const notes = [988, 1319, 1175, 1568, 1319];
      notes.forEach((f, i) => {
        const t = now() + i * 0.13, o = osc('sine', f), o2 = osc('sine', f * 2.01), g = gain(0);
        o.connect(g); o2.connect(g); g.connect(bus === 'self' ? self : place('near', 0.4));
        env(g, t, 0.003, 0.22, 0.02, 0.18); o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
      });
      buzz(1);
    };
    play(); ringTimer = setInterval(play, 1300);
  }

  // ---------- bodies ----------
  function setHeart(bpm, vol = 0.5) {
    heartBpm = bpm; heartGain = vol; clearTimeout(heartTimer);
    if (!bpm) return;
    const beat = () => {
      if (!heartBpm) return;
      [[0, 1], [0.17, 0.7]].forEach(([dt, v]) => {
        const t = now() + dt, o = osc('sine', 58), g = gain(0);
        o.frequency.exponentialRampToValueAtTime(34, t + 0.12);
        o.connect(g).connect(self); env(g, t, 0.006, heartGain * v, 0.02, 0.14); o.start(t); o.stop(t + 0.25);
      });
      heartTimer = setTimeout(beat, 60000 / heartBpm);
    };
    beat();
  }
  // your own breathing
  function setBreath(rate, vol = 0.3) {
    breathRate = rate; breathGain = vol; clearTimeout(breathTimer);
    if (!rate) return;
    const cycle = () => {
      if (!breathRate) return;
      const per = 60 / breathRate, t = now();
      [[0, per * 0.42, 1300, 1], [per * 0.48, per * 0.48, 800, 0.8]].forEach(([dt, d, f, v]) => {
        const n = noise(false), b = filt('bandpass', f, 0.9), g = gain(0);
        n.connect(b).connect(g).connect(self);
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.linearRampToValueAtTime(breathGain * v * 0.5, t + dt + d * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + dt + d);
        n.start(t + dt); n.stop(t + dt + d + 0.05);
      });
      breathTimer = setTimeout(cycle, per * 1000);
    };
    cycle();
  }
  // breathing that is not yours
  function otherBreath(where = 'near', pan = 0.2, count = 3, vol = 0.5) {
    for (let i = 0; i < count; i++) {
      const t = now() + i * 2.6, n = noise(false), b = filt('bandpass', 520, 1.2), g = gain(0);
      n.connect(b).connect(g).connect(place(where, pan));
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(vol, t + 1.1);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
      g.gain.linearRampToValueAtTime(vol * 0.8, t + 1.9);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.5);
      n.start(t); n.stop(t + 2.6);
    }
  }

  // ---------- voice ----------
  // A tiny formant synth. Letters steer three resonant filters over a noise
  // source (whisper) or a buzzing source (voice). Close enough to speech to
  // make the brain fill in the rest, and wrong enough to feel wrong.
  const V = { a: [800, 1500, 2700], e: [560, 1900, 2650], i: [330, 2550, 3200], o: [520, 900, 2500], u: [380, 950, 2400], y: [360, 2350, 3000] };
  function speak(text, { where = 'near', pan = 0, whisper = true, rate = 1, pitch = 1, vol = 1, bus } = {}) {
    const out = bus === 'self' ? (() => { const g = gain(1), pn = ctx.createStereoPanner(); pn.pan.value = pan; g.connect(pn).connect(self); return g; })() : place(where, pan);
    const t0 = now() + 0.02, stepT = 0.078 / rate;
    let src, vib;
    if (whisper) src = noise();
    else {
      src = osc('sawtooth', 205 * pitch);
      vib = osc('sine', 5.5); const vg = gain(3); vib.connect(vg).connect(src.frequency); vib.start(t0);
    }
    const fs = [0, 1, 2].map(k => filt('bandpass', V.a[k], whisper ? [7, 10, 12][k] : [5, 8, 10][k]));
    const fg = [1, 0.75, 0.4].map(v => gain(v * (whisper ? 1.6 : 0.35)));
    const vEnv = gain(0); vEnv.gain.setValueAtTime(0.0001, t0);
    fs.forEach((f, k) => { src.connect(f).connect(fg[k]).connect(vEnv); });
    vEnv.connect(out);
    // sibilants and plosives ride a separate bright branch
    const hiss = noise(), hf = filt('highpass', 4200, 0.7), hEnv = gain(0); hEnv.gain.setValueAtTime(0.0001, t0);
    hiss.connect(hf).connect(hEnv).connect(out);
    let t = t0;
    const s = text.toLowerCase();
    for (let i = 0; i < s.length; i++) {
      const c = s[i], nx = s[i + 1] || '';
      if (V[c]) {
        V[c].forEach((f, k) => fs[k].frequency.linearRampToValueAtTime(f * (whisper ? 1 : 1) * rnd(0.97, 1.03), t + 0.02));
        vEnv.gain.linearRampToValueAtTime(0.5 * vol, t + 0.025);
        vEnv.gain.setValueAtTime(0.5 * vol, t + stepT * 1.3);
        if (!whisper) src.frequency.linearRampToValueAtTime(205 * pitch * rnd(0.93, 1.06), t + stepT);
        t += stepT * 1.5;
      } else if ('szcx'.includes(c) || (c === 's' && nx === 'h')) {
        vEnv.gain.linearRampToValueAtTime(0.06 * vol, t + 0.02);
        hEnv.gain.linearRampToValueAtTime(0.32 * vol, t + 0.02); hEnv.gain.linearRampToValueAtTime(0.0001, t + stepT * 1.4);
        t += stepT * 1.3;
      } else if ('tkpdgbq'.includes(c)) {
        vEnv.gain.linearRampToValueAtTime(0.0001, t + 0.012);
        hEnv.gain.setValueAtTime(0.2 * vol, t + 0.03); hEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
        t += stepT * 0.9;
      } else if ('fvh'.includes(c)) {
        vEnv.gain.linearRampToValueAtTime(0.08 * vol, t + 0.02);
        hEnv.gain.linearRampToValueAtTime(0.12 * vol, t + 0.02); hEnv.gain.linearRampToValueAtTime(0.0001, t + stepT);
        t += stepT;
      } else if ('mnlrwj'.includes(c)) {
        [300, 1250, 2500].forEach((f, k) => fs[k].frequency.linearRampToValueAtTime(f, t + 0.02));
        vEnv.gain.linearRampToValueAtTime(0.22 * vol, t + 0.03);
        t += stepT;
      } else if (c === ' ') {
        vEnv.gain.linearRampToValueAtTime(0.03 * vol, t + 0.03); t += stepT * 0.8;
      } else if ('.,?!…'.includes(c)) {
        vEnv.gain.linearRampToValueAtTime(0.0001, t + 0.06);
        if (c === '?' && !whisper) src.frequency.linearRampToValueAtTime(260 * pitch, t);
        t += 0.32;
      } else t += stepT * 0.5;
    }
    vEnv.gain.linearRampToValueAtTime(0.0001, t + 0.12);
    src.start(t0); src.stop(t + 0.3); hiss.start(t0); hiss.stop(t + 0.3);
    if (vib) vib.stop(t + 0.3);
    return (t - t0) * 1000;
  }

  // ---------- stingers ----------
  function sting(kind = 'soft', vol = 1) {
    const t = now(), out = place('near', 0);
    if (kind === 'soft') {
      const g = gain(0), lp = filt('lowpass', 400, 2);
      lp.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
      lp.frequency.exponentialRampToValueAtTime(500, t + 2.6);
      [233.1, 246.9, 261.6, 466.2, 493.9].forEach(f => {
        const o = osc('sawtooth', f), vib = osc('sine', rnd(5, 7)), vg = gain(f * 0.012);
        vib.connect(vg).connect(o.frequency); o.connect(g); o.start(t); vib.start(t); o.stop(t + 3); vib.stop(t + 3);
      });
      g.connect(lp).connect(out); env(g, t, 0.06, 0.13 * vol, 0.3, 2.4);
      thump('near', 0, 0.9, t);
    } else {
      const g = gain(0);
      [1396, 1480, 1568, 2093].forEach(f => {
        const o = osc('sawtooth', f), vib = osc('sine', rnd(9, 13)), vg = gain(f * 0.025);
        vib.connect(vg).connect(o.frequency); o.connect(g); o.start(t); vib.start(t); o.stop(t + 1.6); vib.stop(t + 1.6);
      });
      const hp = filt('highpass', 900); g.connect(hp).connect(out); env(g, t, 0.01, 0.12 * vol, 0.25, 1.1);
    }
  }
  function scream(bus) {
    const t = now(), out = bus === 'self' ? self : place('near', 0);
    const shaper = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
    shaper.curve = curve;
    const g = gain(0); shaper.connect(g).connect(out);
    // shriek
    [620, 655, 940, 1310].forEach((f, i) => {
      const o = osc('sawtooth', f), vib = osc('sine', rnd(11, 17)), vg = gain(f * 0.05);
      vib.connect(vg).connect(o.frequency);
      o.frequency.setValueAtTime(f * 1.2, t); o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 1.3);
      const og = gain(i < 2 ? 0.35 : 0.2); o.connect(og).connect(shaper);
      o.start(t); vib.start(t); o.stop(t + 1.5); vib.stop(t + 1.5);
    });
    // breath of the scream
    const n = noise(false), nb = filt('bandpass', 2200, 0.9), ng = gain(0.9);
    nb.frequency.exponentialRampToValueAtTime(700, t + 1.3);
    n.connect(nb).connect(ng).connect(shaper); n.start(t); n.stop(t + 1.5);
    env(g, t, 0.004, 0.55, 0.9, 0.45);
    // the floor drops out
    const b = osc('sine', 72), bg = gain(0); b.frequency.exponentialRampToValueAtTime(26, t + 1);
    b.connect(bg).connect(out); env(bg, t, 0.002, 1.2, 0.2, 0.9); b.start(t); b.stop(t + 1.3);
    const c = noise(false), cf = filt('lowpass', 1600), cg = gain(0);
    c.connect(cf).connect(cg).connect(out); env(cg, t, 0.001, 1.4, 0.03, 0.25); c.start(t); c.stop(t + 0.4);
  }
  function whoosh(vol = 0.15) {
    const t = now(), n = noise(false), f = filt('bandpass', 300, 1.5), g = gain(0);
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.25);
    n.connect(f).connect(g).connect(place('near', rnd(-0.5, 0.5))); env(g, t, 0.02, vol, 0.05, 0.2);
    n.start(t); n.stop(t + 0.4);
  }

  // ---------- music box ----------
  // An original lullaby in A minor, 3/4. The same tune plays twice:
  // once wrong, from downstairs; once right, at the end.
  const TUNE = [
    [76, 1], [72, 1], [69, 1], [71, 2], [72, 1], [74, 2], [71, 1], [67, 3],
    [76, 1], [72, 1], [69, 1], [71, 1], [72, 1], [74, 1], [72, 2], [71, 1], [69, 3],
  ];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function musicBox({ where = 'down', pan = 0, beat = 0.42, warp = 0, vol = 0.5, slowdown = 0, bus } = {}) {
    let t = now() + 0.1, b = beat;
    const out = bus === 'self' ? self : place(where, pan);
    TUNE.forEach(([m, d], i) => {
      const f = mtof(m) * (1 + (warp ? Math.sin(i * 1.7) * 0.012 * warp + rnd(-0.008, 0.008) * warp : 0));
      [[1, 1], [3.01, 0.18], [5.43, 0.05]].forEach(([r, a]) => {
        const o = osc('sine', f * r), g = gain(0); o.connect(g).connect(out);
        if (warp) o.detune.linearRampToValueAtTime(-35 * warp, t + 1.6);
        env(g, t, 0.003, a * vol * 0.4, 0, 1.6 / r);
        o.start(t); o.stop(t + 1.8);
      });
      t += d * b; b *= 1 + slowdown;
    });
    return (t - now()) * 1000;
  }
  function birds(on) {
    clearInterval(amb.birdTimer);
    if (!on) return;
    amb.birdTimer = setInterval(() => {
      if (Math.random() < 0.55) return;
      const n = 2 + Math.floor(Math.random() * 4), base = rnd(2600, 4200), pan = rnd(-0.3, 0.6);
      for (let i = 0; i < n; i++) {
        const t = now() + i * rnd(0.09, 0.16), o = osc('sine', base), g = gain(0);
        o.frequency.setValueAtTime(base * rnd(0.9, 1.1), t); o.frequency.exponentialRampToValueAtTime(base * rnd(1.2, 1.6), t + 0.06);
        o.connect(g).connect(place('hall', pan)); env(g, t, 0.005, 0.05, 0.03, 0.05); o.start(t); o.stop(t + 0.15);
      }
    }, 650);
  }
  function tapeHiss(on) {
    if (on && !amb.hiss) {
      const n = noise(), f = filt('highpass', 2500), g = gain(0); n.connect(f).connect(g).connect(self); n.start();
      g.gain.linearRampToValueAtTime(0.012, now() + 1); amb.hiss = { n, g };
    } else if (!on && amb.hiss) { amb.hiss.g.gain.setTargetAtTime(0.0001, now(), 0.3); amb.hiss.n.stop(now() + 1.5); amb.hiss = null; }
  }

  return {
    init, startAmbience, rain, drone, dread, clock, muffled, stopAll, restoreMaster, killAmbience,
    step, creak, knock, glassTap, kettle, doorCreak, wardrobeCreak, bedSink, buzz, ring,
    setHeart, setBreath, otherBreath, speak, sting, scream, whoosh, musicBox, birds, tapeHiss,
    get ready() { return !!ctx; },
  };
})();
