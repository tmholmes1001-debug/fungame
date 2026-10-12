// The director. One night, about four and a half minutes, scripted with
// async/await so every beat reads top to bottom like a screenplay.
(() => {
  const $ = id => document.getElementById(id);
  const view = $('view'), subEl = $('sub'), hintEl = $('hint'), phoneEl = $('phone'), notesEl = $('notes');
  Render.init(view);

  const S = {
    t: 0, camX: 60, tx: 240, ty: 135, torch: false, torchOn: false, torchI: 0, userTorch: true,
    door: 0.18, ward: 0, figStage: 0, figFace: 1, figMouth: 0, eyes: 0, figJitter: 0,
    drawingV: 0, photoV: 0, chairV: 0, mirrorFig: 0, windowFace: 0, doorFingers: 0, wardEyes: false,
    hallLight: false, neighbourOff: false, view: 'black', fade: 0, flash: 0, grain: 14,
    phoneGlow: 0, scare: null, sub: null, day: false, dayLight: 1, desat: 0, warm: 0,
    sink: 0, fingers: 0, gapLift: 0, breathRate: 1.2, bedShift: 0, hold: false, fear: 0,
  };
  let name = 'sweetheart', phase = 'title', mx = 0.5, my = 0.5;
  const speed = +(location.hash.match(/speed(\d+)/) || [0, 1])[1];
  let clock = 0, nightStart = 0;
  const elapsed = () => clock - nightStart;

  // ---------------------------------------------------------------- time
  const waiters = [];
  const wait = ms => new Promise(res => waiters.push({ at: clock + ms / 1000, res }));
  const until = (fn, ms = 1e9) => new Promise(res => waiters.push({ at: clock + ms / 1000, fn, res }));
  function tickWaiters() {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (w.fn && w.fn()) { waiters.splice(i, 1); w.res(true); }
      else if (clock >= w.at) { waiters.splice(i, 1); w.res(false); }
    }
  }
  const tweens = [];
  function tween(key, to, ms, ease = x => x) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) tweens.splice(i, 1);
    tweens.push({ key, from: S[key], to, t0: clock, d: Math.max(0.001, ms / 1000), ease });
  }
  function tickTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i], k = Math.min(1, (clock - tw.t0) / tw.d);
      S[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
      if (k >= 1) tweens.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- words
  let subToken = 0, subPrio = 0;
  function say(text, cls = 'thought', ms = 3000, prio = 2) {
    if (prio < subPrio) return Promise.resolve();
    const tok = ++subToken; subPrio = prio;
    subEl.className = cls; subEl.textContent = text;
    void subEl.offsetWidth; subEl.classList.add('on');
    return wait(ms).then(() => {
      if (tok !== subToken) return;
      subEl.classList.remove('on'); subPrio = 0;
      return wait(700);
    });
  }
  const line = (text, cls, ms) => say(text, cls, ms, 2);
  function clearSub() { subToken++; subPrio = 0; subEl.classList.remove('on'); }
  let hintTok = 0;
  function hint(text, ms = 5000) {
    const tok = ++hintTok; hintEl.textContent = text; hintEl.classList.add('on');
    wait(ms).then(() => { if (tok === hintTok) hintEl.classList.remove('on'); });
  }
  // her voice. a whisper synth under subtitles.
  function voice(text, opts = {}, cls = 'voice') {
    const ms = Sound.speak(text.replace(/[‘’']/g, ''), opts);
    return say(text, cls, Math.max(1600, ms + 700), 3);
  }

  // ---------------------------------------------------------------- phone
  let phoneMin = 4, phoneTimer = null;
  function phoneShow(on) { phoneEl.style.opacity = on ? 0.42 : 0; }
  function notify(text, from = 'Mum ♥', { buzz = true } = {}) {
    [...notesEl.children].forEach(n => n.classList.add('old'));
    while (notesEl.children.length > 2) notesEl.firstChild.remove();
    const n = document.createElement('div'); n.className = 'note';
    const b = document.createElement('b'); b.textContent = `${from} · now`; n.append(b, document.createTextNode(text));
    notesEl.append(n);
    phoneEl.style.opacity = 1; S.phoneGlow = 1;
    if (buzz) Sound.buzz(2);
    clearTimeout(phoneTimer);
    phoneTimer = setTimeout(() => { if (phase !== 'end') phoneEl.style.opacity = 0.42; }, 7000 / speed);
  }
  function setClock(txt) { $('clock').textContent = txt; }

  // ---------------------------------------------------------------- fear
  function fear(f) {
    S.fear = f; Sound.dread(f); Sound.drone(0.07 + f * 0.08);
    Sound.setHeart(f > 0.28 ? Math.round(62 + f * 62) : 0, 0.12 + f * 0.45);
  }

  // ---------------------------------------------------------------- input
  function aim(cx, cy) {
    const r = view.getBoundingClientRect();
    mx = Math.max(0, Math.min(1, (cx - r.left) / r.width));
    my = Math.max(0, Math.min(1, (cy - r.top) / r.height));
  }
  window.addEventListener('pointermove', e => aim(e.clientX, e.clientY));
  window.addEventListener('pointerdown', e => {
    if (phase === 'title' || phase === 'end') return;
    if (e.target.id === 'hideBtn') return;
    aim(e.clientX, e.clientY);
    if (e.button === 2) return;
    examine();
  });
  window.addEventListener('contextmenu', e => { if (phase !== 'title') { e.preventDefault(); toggleTorch(); } });
  window.addEventListener('keydown', e => {
    if (phase === 'title' || phase === 'end') return;
    if (e.code === 'Space') { S.hold = true; e.preventDefault(); }
    if (e.code === 'KeyF') toggleTorch();
  });
  window.addEventListener('keyup', e => { if (e.code === 'Space') S.hold = false; });
  window.addEventListener('blur', () => { S.hold = false; });
  const hideBtn = $('hideBtn');
  hideBtn.addEventListener('pointerdown', e => { S.hold = true; e.preventDefault(); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => hideBtn.addEventListener(ev, () => { S.hold = false; }));
  document.addEventListener('visibilitychange', () => {
    if (phase === 'title' || phase === 'end') return;
    document.title = document.hidden ? `${name}?` : 'are you awake?';
  });
  let torchOffAt = -1;
  function toggleTorch() {
    if (!['explore', 'texts', 'stairs', 'watch'].includes(phase)) return;
    S.userTorch = !S.userTorch;
    if (!S.userTorch) torchOffAt = clock;
  }

  // ---------------------------------------------------------------- examine
  const seen = new Set();
  function examine() {
    if (!['explore', 'texts', 'stairs'].includes(phase) || S.view !== 'room' || !S.torchOn) return;
    const spot = Render.spotAt(S);
    if (!spot) return;
    seen.add(spot);
    const L = {
      chair: S.chairV ? ['That’s just the cardigan.', 'That’s just her cardigan.'] : ['Her cardigan.', 'It still smells like her.'],
      drawing: S.drawingV ? ['There are three of us in it now.', 'I didn’t draw the third one.'] : ['Me and Mum. I was six.', 'She wrote along the bottom for me:', 'MONSTERS CAN’T GET YOU UNDER THE BLANKET'],
      photo: S.photoV ? ['She’s facing the wall.'] : ['Her sixtieth. She hated this photo.'],
      door: phase === 'explore' ? ['She always left the hall light on for me.'] : ['It’s darker out there than it should be.'],
      window: S.neighbourOff ? ['The light across the road has gone out.'] : ['Still raining.'],
      mirror: ['I look like her now. Everyone says so.'],
      boxes: ['Her whole life, in two boxes.', 'It should take up more room than that.'],
    }[spot];
    if (!L) return;
    (async () => {
      for (const l of L) { if (subPrio > 1) return; await say(l, 'thought', 2600, 1); }
      if (spot === 'drawing' && !S.drawingV) taughtHide();
    })();
  }
  let hideTaught = false;
  function taughtHide() { if (hideTaught) return; hideTaught = true; hint(matchMedia('(pointer: coarse)').matches ? 'hold the button to hide under the blanket' : 'hold SPACE to hide under the blanket', 6000); }

  // ---------------------------------------------------------------- per frame
  let unlit = 0, advDelay = 2.6, mirrorArmed = false, mirrorSeen = false, mirrorLitT = 0, mirrorUnlitT = 0;
  let windowArmed = false, windowSeen = false, flickerUntil = 0, nextFlicker = 0, stepInDark = 0, reached = false, wasHidden = false;

  function update(dt) {
    // look and aim. the torch lags, and shakes with fear.
    S.camX += ((mx * 120) - S.camX) * Math.min(1, dt * 4);
    const shake = S.fear * 3.2 + (S.pullTo ? 2 : 0);
    let ax = mx * Render.W, ay = my * Render.H;
    if (S.pullTo) { ax += (S.pullTo[0] - S.camX - ax) * S.pull; ay += (S.pullTo[1] - ay) * S.pull; }
    S.tx += (ax - S.tx) * Math.min(1, dt * 9) + (Math.random() - 0.5) * shake;
    S.ty += (ay - S.ty) * Math.min(1, dt * 9) + (Math.random() - 0.5) * shake;

    // the torch: old batteries
    let on = S.torch && S.userTorch;
    if (phase === 'watch' || phase === 'stairs') {
      if (clock > nextFlicker) {
        const len = 0.25 + Math.random() * (phase === 'watch' ? 0.7 : 0.3);
        flickerUntil = clock + len; nextFlicker = clock + 5 + Math.random() * 6;
        // in the dark between flickers, it sometimes takes a step
        if (phase === 'watch' && Render.figLit(S) && Math.random() < 0.45) stepInDark = clock + len * 0.5;
      }
    }
    if (clock < flickerUntil) on = on && Math.random() < 0.25;
    const target = on ? 1 - S.fear * 0.15 + (Math.random() - 0.5) * 0.06 : 0;
    S.torchI += (target - S.torchI) * Math.min(1, dt * (on ? 30 : 40));
    S.torchOn = on;
    S.phoneGlow = Math.max(0, S.phoneGlow - dt * 0.18);

    // hiding under the blanket
    const canHide = ['explore', 'texts', 'stairs', 'watch', 'dark'].includes(phase);
    const hidden = canHide && S.hold;
    if (hidden !== wasHidden) {
      wasHidden = hidden;
      if (phase !== 'blanket') { S.view = hidden ? 'blanket' : 'room'; Sound.muffled(hidden); if (hidden) Sound.setBreath(18, 0.25); else Sound.setBreath(0); }
    }

    // the mirror
    if (mirrorArmed) {
      const ml = Render.lit(S, 'mirror') && S.view === 'room';
      if (!mirrorSeen && !ml && S.mirrorFig !== 1) S.mirrorFig = 1;
      if (S.mirrorFig === 1 && ml) { mirrorLitT += dt; if (mirrorLitT > 0.25 && !mirrorSeen) { mirrorSeen = true; Sound.sting('soft'); } }
      if (mirrorSeen && !ml) { mirrorUnlitT += dt; if (mirrorUnlitT > 0.6) { S.mirrorFig = 0; mirrorArmed = false; } }
    }
    // the window, two floors up
    if (windowArmed && !windowSeen && S.view === 'room' && Render.lit(S, 'window')) {
      windowSeen = true; windowArmed = false; S.windowFace = 1; Sound.sting('sharp', 1.2); S.flash = 0.25;
      wait(380).then(() => { S.windowFace = 0; });
    }

    // the visitor only moves when it is not being looked at
    if (phase === 'watch' && S.figStage > 0 && S.figStage < 5) {
      const seenNow = Render.figLit(S) && S.view === 'room';
      if (stepInDark && clock > stepInDark) { stepInDark = 0; advance(); }
      if (seenNow) { unlit = 0; S.eyes = 0.15; }
      else {
        unlit += dt; S.eyes = 0.8;
        if (unlit > advDelay) { advance(); unlit = 0; }
      }
    }
    S.flash = Math.max(0, S.flash - dt * 2.5);
    if (S.sub && clock > S.sub.until) S.sub = null;
    S.grain = 12 + S.fear * 12;
  }
  function advance() {
    S.figStage++;
    advDelay = Math.max(1.5, advDelay - 0.25);
    if (S.figStage === 2) { tween('door', 1, 500); Sound.doorCreak(0.8); }
    else Sound.step('room', -0.6 + S.figStage * 0.2, 0.9);
    if (S.figStage >= 5) reached = true;
  }
  function subliminal() {
    // one frame, at the edge of the beam
    const a = Math.random() * Math.PI * 2;
    S.sub = { x: Math.max(30, Math.min(450, S.tx + Math.cos(a) * 110)), y: Math.max(30, Math.min(240, S.ty + Math.sin(a) * 70)), until: clock + 0.05 };
    Sound.whoosh(0.05);
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function loop(now) {
    const real = Math.min(0.05, (now - last) / 1000); last = now;
    const dt = real * speed;
    S.t += dt; clock += dt;
    if (phase !== 'title') { update(dt); tickTweens(); }
    tickWaiters();
    if (S.scare) S.scare.k = Math.min(1, (clock - S.scare.t0) / S.scare.d);
    Render.frame(S);
    view.style.transform = S.scare ? `translate(${(Math.random() - 0.5) * 24}px, ${(Math.random() - 0.5) * 24}px) scale(1.04)` : (S.fear > 0.6 ? `translate(${(Math.random() - 0.5) * S.fear}px, 0)` : '');
    requestAnimationFrame(loop);
  }
  function fit() {
    const r = Math.min(innerWidth / 480, innerHeight / 270);
    view.style.width = `${Math.floor(480 * r)}px`; view.style.height = `${Math.floor(270 * r)}px`;
  }
  addEventListener('resize', fit); fit();
  requestAnimationFrame(loop);

  // ================================================================ the night
  async function intro() {
    phase = 'intro'; S.view = 'black'; S.fade = 1;
    await wait(1200);
    await line('They buried her on Tuesday.', 'thought', 3000);
    await line('You said you’d stay on and clear the house.', 'thought', 3200);
    await line('Tonight you’re sleeping in your old room.', 'thought', 3000);
    Sound.startAmbience();
    S.view = 'room'; S.fade = 0; S.torch = true; tween('fade', 1, 3500);
    phoneShow(true);
  }

  async function act1() {
    phase = 'explore';
    await wait(1500);
    hint(matchMedia('(pointer: coarse)').matches ? 'drag to look · tap what you light' : 'move to look · click what you light', 7000);
    const t0 = clock;
    // the house settling. nothing yet. let them breathe.
    (async () => { while (phase === 'explore') { await wait(6000 + Math.random() * 5000); if (phase === 'explore') Sound.creak(Math.random() < 0.5 ? 'hall' : 'room', Math.random() * 1.4 - 0.7, 0.8, 1, 0.3); } })();
    await until(() => (seen.size >= 3 && clock - t0 > 22) || clock - t0 > 34);
    await until(() => subPrio < 1, 4000);
    if (!hideTaught) {
      await line('Mum used to tell me monsters can’t get you under the blanket.', 'thought', 3400);
      taughtHide();
    }
    await wait(1800);
  }

  async function act2() {
    phase = 'texts';
    setClock('3:06');
    notify('are you awake?'); fear(0.15);
    await wait(2400);
    await line('…what?', 'thought', 1600);
    await line('Her phone is downstairs. I put it in the kitchen drawer myself.', 'thought', 3600);
    await wait(1000);
    Sound.kettle(7.5);
    await wait(3200);
    await line('Someone’s in the kitchen.', 'thought', 2400);
    await wait(1600);
    notify('I made tea'); fear(0.25);
    await wait(3200);
    for (let i = 0; i < 5; i++) { Sound.step('down', -0.1 - i * 0.08, 0.8); await wait(720); }
    S.drawingV = 1;
    await wait(900);
    voice(`${name}?`, { where: 'down', whisper: false, pan: -0.3, rate: 0.8 });
    await wait(3400);
    notify(`come down ${name}`);
    await wait(3000);
    // something sits on the end of the bed
    Sound.bedSink(); S.bedShift = 2; tween('bedShift', 0, 1800);
    mirrorArmed = true; mirrorSeen = false; mirrorLitT = 0; mirrorUnlitT = 0;
    await line('The end of the bed just went down.', 'thought', 2400);
    await line('Like someone sat on it.', 'thought', 2600);
    await until(() => mirrorSeen, 7000);
    if (mirrorSeen) { await until(() => !mirrorArmed, 4000); await line('There’s nobody there. There’s nobody there.', 'thought', 2800); }
    else { mirrorArmed = false; S.mirrorFig = 0; }
    fear(0.32);
    Sound.musicBox({ where: 'down', warp: 1.6, beat: 0.5, slowdown: 0.025, vol: 0.7 });
    await wait(1500);
    await line('That’s my music box. That was in the loft.', 'thought', 3400);
    S.photoV = 1; S.chairV = 1;
    await wait(1500);
    notify('your light is on');
    if (!matchMedia('(pointer: coarse)').matches) hint('F · switch the torch off', 4000);
    await until(() => !S.userTorch, 4000);
    if (!S.userTorch) { await wait(1800); notify('don’t hide from me'); await wait(2400); S.userTorch = true; }
    await line('Someone has her phone. That’s all this is.', 'thought', 3200);
    // two floors up
    windowArmed = true; windowSeen = false; Sound.glassTap(0.05);
    await until(() => windowSeen, 5000); windowArmed = false;
    if (windowSeen) { await wait(900); await line('We’re on the second floor.', 'thought', 2600); }
    S.neighbourOff = true;
    subliminal();
    await wait(1200);
    notify('why won’t you come down');
    await wait(3400);
  }

  async function act3() {
    phase = 'stairs';
    Sound.clock(false); Sound.rain(false, 1.5); fear(0.42);
    setClock('3:08');
    await wait(2600);
    await line('The clock’s stopped.', 'thought', 2000);
    await wait(600);
    for (let i = 0; i < 13; i++) {
      Sound.step(i < 9 ? 'stairs' : 'hall', -0.35 - i * 0.03, 0.55 + i * 0.035);
      if (i === 6) subliminal();
      await wait(1000 - i * 25);
    }
    fear(0.6);
    await wait(2600);
    Sound.knock('hall', -0.75, [0, 0.45, 0.62]);
    await wait(1500);
    await voice('it’s only me.', { where: 'hall', pan: -0.7, rate: 0.85 });
    Sound.knock('hall', -0.75, [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8], 1.1);
    await wait(2600);
    // the door
    S.doorFingers = 1; Sound.doorCreak(2.8); tween('door', 0.42, 2800);
    await wait(1600);
    S.doorFingers = 0; S.figStage = 1; S.eyes = 0.8;
    phase = 'watch'; unlit = 0; advDelay = 2.6; reached = false; fear(0.7);
    hint('don’t take your eyes off it', 4500);
    const lures = (async () => {
      await wait(4500); if (phase !== 'watch') return;
      voice('you’ve got so tall.', { where: 'room', pan: -0.6 });
      await wait(5000); if (phase !== 'watch') return;
      Sound.wardrobeCreak(); tween('ward', 0.55, 1600); S.wardEyes = true;
      await wait(5500); if (phase !== 'watch') return;
      notify('look at me');
      await wait(5000); if (phase !== 'watch') return;
      voice('it’s mum. it’s mum. it’s your mum.', { where: 'room', pan: -0.4, rate: 1.4 }, 'near');
      await wait(5500); if (phase !== 'watch') return;
      Sound.glassTap(0.1);
      await wait(4000); if (phase !== 'watch') return;
      S.mirrorFig = 2;
      await wait(3500); if (phase !== 'watch') return;
      Sound.otherBreath('near', 0.7, 2, 0.4);
      voice('why are you scared of me?', { where: 'near', pan: 0.6 }, 'near');
      await wait(5000); if (phase !== 'watch') return;
      notify('I’m right here');
    })();
    // whatever happens, the night ends inside five minutes: act 4 + 5 need ~92s
    const budget = Math.max(18, Math.min(40, 300 - 92 - elapsed()));
    await until(() => reached, budget * 1000);
    void lures;
  }

  async function act4() {
    phase = 'dark'; S.mirrorFig = 0; S.wardEyes = false;
    clearSub(); fear(0.9);
    // the batteries give out. every time the light comes back, it is closer.
    const from = Math.max(1, Math.min(4, S.figStage));
    S.pull = 0.85;
    for (let st = from; st <= 6; st++) {
      S.userTorch = false; await wait(st === from ? 300 : 650 + Math.random() * 300);
      S.figStage = st <= 5 ? st : 0;
      if (st === 2) S.door = 1;
      const pos = Render.STAGES[Math.min(5, st)];
      S.pullTo = [pos.x, pos.fy - pos.h * 0.8];
      S.userTorch = true; S.torchI = 1; Sound.whoosh(0.08 + st * 0.03);
      await wait(st === 5 ? 700 : 380);
    }
    S.userTorch = false; S.pullTo = null; S.pull = 0; S.figStage = 0;
    S.torch = false;
    Sound.drone(0.02, 0.5); Sound.dread(0); Sound.setHeart(0);
    await wait(2600);
    Sound.setHeart(120, 0.55);
    await voice('under the blanket, love. quickly.', { where: 'near', pan: 0.35, rate: 1.1 }, 'real');
    hint(matchMedia('(pointer: coarse)').matches ? 'hold the button' : 'hold SPACE', 6000);
    const hid = await until(() => S.hold, 6500);
    if (!hid) return scare(true);
    phase = 'blanket'; S.view = 'blanket'; Sound.muffled(true); Sound.setBreath(30, 0.4);
    const holding = ms => until(() => !S.hold, ms).then(let_go => !let_go);
    if (!await holding(2500)) return scare(true);
    for (let i = 0; i < 3; i++) { Sound.step('room', 0.1 * i, 0.9); if (!await holding(800)) return scare(true); }
    Sound.bedSink(); tween('sink', 0.7, 900);
    if (!await holding(3000)) return scare(true);
    Sound.setHeart(0); Sound.otherBreath('room', 0.15, 2, 0.6);
    if (!await holding(3200)) return scare(true);
    voice('it’s alright. it’s only me.', { where: 'room', pan: 0.1, rate: 0.85 });
    if (!await holding(3800)) return scare(true);
    voice('let me see your face.', { where: 'room', pan: 0.05, rate: 0.75 });
    tween('fingers', 1, 3200); tween('gapLift', 0.4, 3200);
    if (!await holding(4800)) return scare(true);
    tween('fingers', 0, 1500); tween('gapLift', 0, 1500);
    if (!await holding(1600)) return scare(true);
    // nothing. your own breath stops.
    Sound.setBreath(0); Sound.muffled(true);
    if (!await holding(3200)) return scare(true);
    Sound.speak('monsters cant get you under here', { bus: 'self', pan: 0.95, rate: 0.9, vol: 1.4 });
    say('monsters can’t get you under here.', 'near', 3000, 3);
    await wait(2700);
    return scare(false);
  }

  async function scare(dark) {
    phase = 'scare'; hintEl.classList.remove('on');
    // nothing on screen but the face: kill the words without a fade
    subEl.style.transition = 'none'; clearSub(); void subEl.offsetWidth; subEl.style.transition = '';
    // her phone, ringing, lights the face from below
    Sound.muffled(false); Sound.ring(true, 'self');
    notesEl.textContent = ''; notify('incoming call', 'Mum ♥', { buzz: false }); S.phoneGlow = 1;
    if (S.view === 'blanket') { await wait(120); }
    S.scare = { t0: clock, d: 1.3, size: dark ? 300 : 340, cold: true, k: 0 };
    Sound.scream('self'); S.fear = 1;
    await wait(1300);
    Sound.ring(false); Sound.stopAll(0.02); Sound.killAmbience();
    S.scare = null; S.view = 'black'; phoneShow(false); notesEl.textContent = '';
  }

  async function act5() {
    phase = 'morning'; S.fear = 0; S.view = 'black'; clearSub();
    await wait(3400);
    Sound.restoreMaster(0.9, 3); Sound.birds(true);
    Object.assign(S, { day: true, view: 'room', torch: false, userTorch: false, figStage: 0, door: 0, ward: 0, chairV: 0, photoV: 0, mirrorFig: 0, windowFace: 0, neighbourOff: false, desat: 0.3, warm: 0.6, sink: 0, fingers: 0, fade: 0 });
    tween('fade', 1, 4500);
    setClock('7:42'); $('batt').textContent = '▮▯▯ 9%';
    await wait(3500);
    phoneShow(true);
    notify('saved voicemail · 0:41 · 14 March', 'Mum ♥', { buzz: false });
    await wait(1800);
    Sound.tapeHiss(true); Sound.musicBox({ bus: 'self', beat: 0.62, vol: 0.32 });
    for (const [l, ms] of [['hi love, it’s only me.', 2600], ['nothing important.', 2000], ['I just wanted to hear your voice.', 2800], ['you sounded tired last time. are you sleeping?', 3400], ['…anyway. call me back when you can.', 3000], ['love you. bye. bye. bye bye.', 3400]]) await line(l, 'real', ms);
    Sound.tapeHiss(false);
    await line('saved voicemail · played 214 times', 'label', 3400);
    tween('fade', 0, 3000); Sound.birds(false);
    await wait(3200);
    S.view = 'black';
    await wait(1600);
    // one more thing
    notesEl.textContent = ''; phoneEl.style.opacity = 1;
    const n = document.createElement('div'); n.className = 'note';
    const b = document.createElement('b'); b.textContent = 'Mum ♥'; n.append(b, document.createTextNode('is typing…')); notesEl.append(n);
    await wait(3800);
    phoneEl.style.opacity = 0;
    await wait(1500);
  }

  async function night(from = 0) {
    const acts = [intro, act1, act2, act3, act4, act5];
    for (let i = from; i < acts.length; i++) await acts[i]();
    phase = 'end'; document.body.classList.remove('playing'); hideBtn.hidden = true;
    $('endCard').hidden = false; document.title = 'are you awake?';
  }

  // ---------------------------------------------------------------- start
  async function begin(from = 0) {
    const v = $('nameInput').value.trim().replace(/\s+/g, ' ');
    name = v || 'sweetheart';
    await Sound.init();
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
    $('startCard').hidden = true; document.body.classList.add('playing');
    if (matchMedia('(pointer: coarse)').matches) hideBtn.hidden = false;
    if (from >= 1) { Sound.startAmbience(); S.view = 'room'; S.fade = 1; S.torch = true; phoneShow(true); }
    nightStart = clock;
    night(from);
  }
  $('startBtn').addEventListener('click', () => begin(+(location.hash.match(/act(\d)/) || [0, 0])[1]));
  $('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('startBtn').click(); });
  $('againBtn').addEventListener('click', () => location.reload());

  window.__night = { S, jump: begin, get phase() { return phase; } };
})();
