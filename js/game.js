// The director. 3:03 to 3:33 a.m., about four minutes.
// Something with her number is in the house. It finds you by your phone:
// the light of the screen, the sound of the ringer, your replies, your eyes.
(() => {
  const $ = s => document.querySelector(s);
  const subEl = $('#sub'), hintEl = $('#hint');
  const coarse = matchMedia('(pointer: coarse)').matches;
  let speed = +(location.hash.match(/speed(\d+)/) || [0, 1])[1];

  // render state read by World
  const S = { t: 0, door: 0.06, doorSpeed: 1.2, hallLight: 1.6, hallFlicker: 0, phoneLight: 0.2, phoneColor: 0xcfe0ff, torch: false, flash: 0, fig: null, scare: null, exposure: 0.6, grain: 0.05, blur: 1.2, glitch: 0, aberr: 0, fade: 0 };
  // the visitor
  const V = { at: 'kitchen', attn: 0, peak: 0, said: {}, cause: 'light' };
  const ORDER = ['kitchen', 'hall', 'stairs', 'landing', 'door', 'doorway', 'foot', 'side', 'gone'];
  const near = (...ats) => ats.includes(V.at);
  let phase = 'title', clock = 0, battery = 31, battT = 0, rulesT = 0, mumReplies = 0;

  // ------------------------------------------------------------ time
  const waiters = [];
  const wait = ms => new Promise(res => waiters.push({ at: clock + ms / 1000, res }));
  const until = (fn, ms = 1e9) => new Promise(res => waiters.push({ at: clock + ms / 1000, fn, res }));
  // the night's script simply stops when the night is over
  const at = sec => until(() => false, Math.max(0, (sec - clock) * 1000)).then(() => alive() ? true : new Promise(() => {}));
  function tickWaiters() {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (w.fn && w.fn()) { waiters.splice(i, 1); w.res(true); } else if (clock >= w.at) { waiters.splice(i, 1); w.res(false); }
    }
  }
  const tweens = [];
  function tween(key, to, ms) { for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].key === key) tweens.splice(i, 1); tweens.push({ key, from: S[key], to, t0: clock, d: Math.max(0.001, ms / 1000) }); }
  function tickTweens() { for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i], k = Math.min(1, (clock - w.t0) / w.d); S[w.key] = w.from + (w.to - w.from) * k; if (k >= 1) tweens.splice(i, 1); } }
  const alive = () => phase === 'night';

  // ------------------------------------------------------------ words
  let subTok = 0;
  function think(text, ms = 3200) {
    const tok = ++subTok; subEl.textContent = text; subEl.classList.add('on');
    return wait(ms).then(() => { if (tok === subTok) subEl.classList.remove('on'); return wait(500); });
  }
  let hintTok = 0;
  function hint(text, ms = 6000) { const tok = ++hintTok; hintEl.textContent = text; hintEl.classList.add('on'); wait(ms).then(() => { if (tok === hintTok) hintEl.classList.remove('on'); }); }
  function clockText() { const m = Math.min(33, 3 + Math.floor(clock / 7.05)); return `3:${String(m).padStart(2, '0')}`; }

  // ------------------------------------------------------------ her messages
  let order = 0;
  const msg = (thread, m, notify = true) => Phone.addMsg(thread, Object.assign({ order: ++order, time: clockText() }, m), { notify });
  async function mumSays(text, typeMs = 1600) {
    if (!alive()) return;
    Phone.typing('mum', true); await wait(typeMs); if (!alive()) return;
    msg('mum', { from: 'in', text, date: 'Today' });
  }
  function seedHistory() {
    const h = (thread, date, from, text, time, vn) => Phone.addMsg(thread, { order: ++order, from, text, date, time, vn, seen: true }, { notify: false });
    h('carol', 'Monday', 'in', 'So sorry for your loss darling. She was so proud of you. Call me any time xx', 'Mon');
    h('sam', 'Monday', 'in', 'Take all the time you need. Thinking of you.', 'Mon');
    h('mum', '14 March', 'in', null, '18:02', { id: 'vm_real', dur: '0:11' });
    h('mum', '6 September', 'in', 'are you coming sunday? I’ll do a roast x', '11:40');
    h('mum', '6 September', 'out', 'yes!! can’t wait', '11:52');
    h('mum', '6 September', 'in', 'bring a coat it’s turned cold', '11:53');
    h('mum', '28 September', 'in', 'hospital say I might come home tuesday 🙂', '16:20');
    h('mum', '28 September', 'out', 'that’s amazing mum ❤️', '16:31');
    h('mum', '28 September', 'in', 'love you. don’t worry about me x', '16:33');
    h('mum', '2 October', 'in', 'are you awake? can’t sleep in here x', '03:12');
    h('mum', '2 October', 'out', 'sorry mum, was asleep! love you, see you tomorrow x', '07:40');
    h('danny', 'Tuesday', 'in', 'funeral’s at 11. I’ll pick you up at 10 x', 'Tue');
    h('danny', 'Tuesday', 'in', 'you did so well today. she’d be proud', 'Tue');
    Phone.recents('<small style="color:#e5484d;padding:1em;display:block">Mum ♥ · missed call · 2 Oct</small>');
  }

  // ------------------------------------------------------------ attention
  // Everything the phone does is something it can notice.
  function notice(amount, cause) {
    if (!alive() || near('kitchen', 'gone')) return;
    const scale = { hall: 0.3, stairs: 0.5, landing: 0.8, door: 1, doorway: 1.4, foot: 1.8, side: 2 }[V.at] || 0;
    V.attn = Math.min(100, V.attn + amount * scale); V.cause = cause;
  }
  function onAction(type, d) {
    if (!alive()) return;
    if (type === 'reply') return reply(d);
    if (type === 'ping' && !d.muted) notice(4, 'sound');
    if (type === 'vn') notice(8, 'sound');
    if (type === 'dial') return dial(d);
    if (type === 'shutter') { if (d.flash) { S.flash = 1; notice(30, 'light'); } if (near('foot', 'side')) notice(10, 'look'); }
    if (type === 'feed' && Feed.current.id === 'mum_live') liveComments();
  }
  function reply({ thread, text }) {
    msg(thread, { from: 'out', text, date: 'Today' }, false);
    if (thread === 'danny') {
      if (/mum’s phone|mum's phone/.test(text)) { dannyWarned = true; }
      else wait(4000).then(() => alive() && msg('danny', { from: 'in', text: 'same. try and get some sleep x', date: 'Today' }));
      return;
    }
    // rule 1: it learns her from your answers
    mumReplies++; notice(14, 'answer'); V.attn = Math.max(V.attn, mumReplies * 8);
    const lines = ['it’s me love. it’s mum x', 'who else would it be', 'I knew you were awake', 'you always were a light sleeper', 'come down. please.'];
    mumSays(lines[Math.min(lines.length - 1, mumReplies - 1)], 2200).then(() => {
      if (alive() && mumReplies < 4) Phone.offer('mum', mumReplies === 1 ? ['mum??', 'this isn’t funny'] : mumReplies === 2 ? ['I’m not coming down', 'please stop'] : ['leave me alone']);
    });
  }
  async function dial(who) {
    if (who === 'danny') {
      Phone.inCall('Danny', 'danny', 'calling…', () => {});
      await wait(2600); Phone.setCallSub('voicemail');
      const ms = Sound.voice('danny_vm', { where: 'ear' }); await wait(ms + 400); if (Phone.st.call) Phone.endCall();
    } else if (who === '999') {
      Phone.inCall('Emergency', '999', 'calling…', () => {});
      await wait(1800); Phone.setCallSub('00:01');
      const ms = Sound.voice('op_999', { where: 'ear' }); notice(10, 'sound'); await wait(ms + 300); if (Phone.st.call) Phone.endCall();
      think('That was her voice.');
    } else if (who === 'mum') {
      Phone.inCall('Mum ♥', 'mum', 'calling…', () => {}); notice(10, 'answer');
      await wait(2400); Phone.setCallSub('00:01');
      Sound.otherBreath('near', 0, 1, 0.5); await wait(2800);
      const ms = Sound.voice('w_iknow', { where: 'ear', vol: 1.3 }); await wait(ms); if (Phone.st.call) Phone.endCall();
    }
  }
  let liveTimer = null;
  function liveComments() {
    clearInterval(liveTimer);
    const lines = [['user8812', 'she’s awake'], ['▓▓▓', 'her light is on'], ['mum_♥', 'hello love x'], ['user0003', 'she can’t see you'], ['user8812', 'look up'], ['▓▓▓', 'behind the phone'], ['user0003', 'she’s holding her breath'], ['▓▓', 'go in']];
    let i = 0;
    liveTimer = setInterval(() => {
      if (!alive() || Feed.current.id !== 'mum_live' || Phone.st.app !== 'feed') return clearInterval(liveTimer);
      Phone.liveComment(...lines[i++ % lines.length]);
    }, 1400);
  }

  // escalation: whispers, then yelling, then fists on the door
  const ESC = [
    [22, () => Sound.chorus(['w_iknow', 'w_awake', 'w_onlyme'], { count: 4, where: inRoom() ? 'room' : 'hall', spread: inRoom() ? 1 : 0.5 })],
    [42, () => { Sound.voice('y_see', { where: inRoom() ? 'room' : 'hall', pan: inRoom() ? 0 : -0.55, vol: 1.1 }); if (!inRoom()) Sound.bang(3, 1); }],
    [62, () => { Sound.voice(inRoom() ? 'y_hiding' : 'y_door', { where: inRoom() ? 'near' : 'hall', pan: inRoom() ? 0.3 : -0.55, vol: 1.2 }); if (!inRoom()) Sound.bang(5, 1.3); S.glitch = 0.5; mumSays('WHY ARE YOU HIDING FROM ME', 300); }],
    [82, () => { Sound.voice('y_mother', { where: inRoom() ? 'near' : 'hall', pan: inRoom() ? -0.3 : -0.55, vol: 1.3 }); Sound.chorus(['w_look', 'w_here', 'w_hiding'], { count: 5, where: 'near', vol: 0.5 }); if (!inRoom()) Sound.bang(7, 1.5); S.glitch = 0.9; }],
  ];
  const inRoom = () => near('doorway', 'foot', 'side');
  function escalate() {
    if (ORDER.indexOf(V.at) < 3) return;
    for (const [lvl, fn] of ESC) {
      if (V.attn >= lvl && !V.said[lvl]) { V.said[lvl] = true; fn(); }
      if (V.attn < lvl - 18) V.said[lvl] = false;
    }
    if (V.attn >= 100) {
      if (inRoom()) return caught();
      // it will not wait at the door any longer
      V.attn = 70; Sound.bang(3, 1.6); Sound.doorCreak(0.6); S.doorSpeed = 6; S.door = 1.55; setAt('doorway');
      Sound.voice('y_look', { where: 'room', pan: -0.5, vol: 1.3 });
    }
  }
  function setAt(a) {
    V.at = a; World.liveFrom(a);
    S.fig = { door: S.door > 0.2 ? 'gap' : null, doorway: 'doorway', foot: 'foot', side: 'side' }[a] || null;
  }

  // ------------------------------------------------------------ per frame
  let adapt = 0.6;
  function update(dt) {
    const ps = Phone.st, bright = Phone.brightness();
    const raised = ps.raised, torch = ps.torch;
    const light = bright * (raised ? 1 : 0.35);
    // the screen lights the room; held up, it also blinds you to it
    S.phoneLight = bright * (raised ? 0.45 : 0.08);
    S.torch = torch;
    const target = torch ? 1.1 : (bright > 0 && raised) ? 0.9 + (1 - bright) * 0.6 : bright > 0 ? 4.8 : 7;
    adapt += (target - adapt) * Math.min(1, dt * (target > adapt ? 0.55 : 3.5));
    S.exposure = adapt; S.blur = raised ? 1.3 : 0.2;
    S.flash = Math.max(0, S.flash - dt * 3); S.glitch = Math.max(0, S.glitch - dt * 0.8); S.aberr = S.glitch * 2 + V.attn / 160;
    S.grain = 0.045 + V.attn / 1800;
    if (alive()) {
      // light under the door, light in the room
      const k = { landing: 2.4, door: 3, doorway: 7, foot: 13, side: 15 }[V.at] || 0;
      if (k) {
        V.attn += light * k * dt;
        if (torch) { if (near('foot', 'side')) { V.cause = 'torch'; return caught(); } V.attn += (near('doorway') ? 40 : 12) * dt; V.cause = 'light'; }
        else if (light > 0.05) V.cause = 'light';
        // feed audio through the speaker
        if (ps.app === 'feed' && ps.on && !ps.locked && !ps.muted && Feed.current.audio) { V.attn += (inRoom() ? 4 : 1.5) * dt; V.cause = 'sound'; }
        // a ringing phone
        if (ps.call && ps.call.state === 'ringing' && !ps.muted) { V.attn += (inRoom() ? 22 : 7) * dt; V.cause = 'sound'; }
        // rule 4: do not look at it
        const looking = (!raised && adapt > 2.5) || (ps.app === 'cam' && ps.on && !ps.locked);
        if (looking && near('foot', 'side', 'doorway')) { V.attn += (near('doorway') ? 5 : 11) * dt; V.cause = 'look'; }
        // dark and quiet: it loses you
        if (light < 0.04 && !torch && !(ps.call && !ps.muted)) V.attn = Math.max(0, V.attn - 2 * dt);
      }
      V.peak = Math.max(V.peak, V.attn);
      escalate();
      Sound.setDread(Math.min(1, V.attn / 100 + (ORDER.indexOf(V.at) >= 3 ? 0.2 : 0)));
      // the rules video counts once you have actually watched it
      if (ps.app === 'feed' && Feed.current.rules && ps.on && !ps.locked) rulesT += dt;
      // battery
      battT += dt * (ps.on ? 1 : 0.3) * (torch ? 3 : 1);
      if (battT > 8.5) { battT = 0; battery = Math.max(4, battery - 1); Phone.setBattery(battery); }
      Phone.setTime(clockText());
    }
  }
  let heartAt = 0;
  function heart() {
    if (!alive()) return;
    const bpm = ORDER.indexOf(V.at) >= 2 ? Math.round(64 + V.attn * 0.8 + (inRoom() ? 14 : 0)) : 0;
    if (Math.abs(bpm - heartAt) > 6 || (!bpm && heartAt)) { heartAt = bpm; Sound.setHeart(bpm, 0.18 + V.attn / 250); }
  }

  // ------------------------------------------------------------ loop
  const canvas = $('#world');
  World.init(canvas);
  Phone.init({ onAction, faceImage: () => World.faceImage });
  addEventListener('resize', () => World.resize());
  let last = performance.now();
  function loop(now) {
    const real = Math.min(speed > 1 ? 0.25 : 0.05, (now - last) / 1000); last = now;
    const dt = real * speed;
    S.t += dt;
    if (phase !== 'title') { clock += dt; update(dt); tickTweens(); Phone.update(dt); }
    tickWaiters();
    if (S.scare) S.scare.k = Math.min(1, (clock - S.scare.t0) / S.scare.d);
    $('#screen').classList.toggle('see', Phone.views().length > 0);
    // nothing to see behind the title and end cards
    if (phase !== 'title' && phase !== 'end') World.render(S, dt, Phone.views());
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  setInterval(heart, 1000);

  // ------------------------------------------------------------ input
  addEventListener('keydown', e => {
    if (phase !== 'night') return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) Phone.setRaised(!Phone.st.raised); }
    if (e.code === 'KeyL') Phone.power();
    if (e.code === 'KeyM') Phone.toggleMute();
    if (e.code === 'ArrowDown' || e.code === 'KeyS') Phone.st.app === 'feed' && Phone.scrollFeed(1);
    if (e.code === 'ArrowUp' || e.code === 'KeyW') Phone.st.app === 'feed' && Phone.scrollFeed(-1);
    if (e.code === 'Escape' || e.code === 'Backspace') Phone.open('home');
  });
  $('#lowerBtn').addEventListener('click', () => { if (phase !== 'night') return; Phone.setRaised(!Phone.st.raised); $('#lowerBtn').textContent = Phone.st.raised ? 'lower phone' : 'raise phone'; });
  $('#offBtn').addEventListener('click', () => { if (phase === 'night') Phone.power(); });
  $('#silentBtn').addEventListener('click', () => { if (phase !== 'night') return; Phone.toggleMute(); $('#silentBtn').classList.toggle('on', Phone.st.muted); });
  $('#screen').addEventListener('click', e => { if (e.target.classList.contains('off') && phase === 'night') Phone.power(); });
  document.addEventListener('visibilitychange', () => { if (phase === 'night') document.title = document.hidden ? 'are you awake?' : 'are you awake?'; });

  // ================================================================ the night
  let dannyWarned = false;
  async function intro() {
    phase = 'intro'; S.fade = 0;
    for (const l of ['They buried her on Tuesday.', 'You’re sleeping in your old room tonight.', 'It’s 3:03. You can’t sleep.']) await think(l, 2600);
    phase = 'night'; clock = 0;
    Sound.startAmbience(); tween('fade', 1, 2500);
  }

  async function night() {
    hint(coarse ? 'swipe the feed · tap the phone' : 'scroll the feed · click the phone', 6000);
    await at(9);  msg('danny', { from: 'in', text: 'you up?', date: 'Today' });
    await at(12); msg('danny', { from: 'in', text: 'can’t sleep either. it’s so weird being in the house without her', date: 'Today' });
    Phone.offer('danny', ['same. can’t sleep x', 'yeah. miss her']);
    await at(21); hint(coarse ? 'lower phone · top left · to see the room' : 'SPACE · lower your phone to see the room', 6000);

    await at(28); mumSays('are you awake?', 10);
    Phone.offer('mum', ['mum?', 'who is this?']);
    await at(31); think('That’s Mum’s number.');
    await at(36); V.at = 'kitchen'; Sound.kettle(7);
    await at(39); think('…someone’s downstairs.');
    await at(45); Sound.mugs(); mumSays('I made you a tea x');
    await at(51); msg('mum', { from: 'in', vn: { id: 'vn1', dur: '0:06' }, date: 'Today' });
    Phone.offer('danny', ['someone’s texting me from mum’s phone']);
    await at(58); setAt('hall'); for (let i = 0; i < 4; i++) { Sound.step('down', -0.1 - i * 0.1, 0.8); await wait(650); }
    Sound.voice('s_sweet', { where: 'down', pan: -0.2 });
    await at(62); think('That’s her voice.');

    // she calls
    await at(66); hint(coarse ? 'decline it · tap silent' : 'decline it · M for silent', 5000);
    const r1 = await Phone.incoming('Mum ♥', 'mum', 8000);
    if (r1 === 'accept') {
      Phone.inCall('Mum ♥', 'mum', '00:01', () => {}); notice(16, 'answer');
      const ms = Sound.voice('call1', { where: 'ear', vol: 1.2 }); await wait(ms + 200); if (Phone.st.call) Phone.endCall();
      V.attn = Math.max(V.attn, 15);
    } else if (r1 === 'decline') { mumSays('why did you hang up on me', 2000); }
    else { msg('mum', { from: 'in', text: 'missed call', date: 'Today' }, false); if (!Phone.st.muted) mumSays('I can hear your phone x', 1800); }

    await at(80); msg('danny', { from: 'in', vn: { id: 'danny_vn', dur: '0:08' }, date: 'Today' });
    await at(84); msg('danny', { from: 'in', text: dannyWarned ? 'it’s here. her phone is HERE. I’m looking at it' : 'why is mum’s phone saying it’s online?? it’s in my drawer. switched off', date: 'Today' });
    await at(88); think('Then who has her phone?');
    await at(92); Feed.inject('mum_kitchen'); Phone.notify({ title: 'forU', body: 'mum_♥ posted a video', app: 'feed', video: 'mum_kitchen' });
    await at(97); msg('danny', { from: 'in', text: 'ok this is messed up. my fyp keeps showing me this. watch it', date: 'Today' });
    Feed.inject('rules'); Phone.notify({ title: 'forU', body: 'Danny sent you a video', app: 'feed', video: 'rules', silent: true });
    await at(101); Sound.voice('s_comedown', { where: 'down', pan: -0.2, vol: 1.1 });

    // the stairs
    await at(108); setAt('stairs'); Feed.inject('mum_stairs'); Phone.notify({ title: 'forU', body: 'mum_♥ posted a video', app: 'feed', video: 'mum_stairs' });
    for (let i = 0; i < 13; i++) { Sound.step(i < 9 ? 'stairs' : 'hall', -0.25 - i * 0.025, 0.55 + i * 0.035); await wait(880 - i * 15); }
    await at(121); setAt('landing'); S.hallFlicker = 1; Sound.creak('hall', -0.55, 1.2, 0.8, 0.5);
    Sound.voice('w_awake', { where: 'hall', pan: -0.55, vol: 1.1 });
    think('She’s outside the door.');
    await at(126); hint(coarse ? 'tap screen off' : 'L · turn your screen off', 6000);
    mumSays(Phone.brightness() > 0 ? 'your light is on' : 'I know you’re in there', 900);
    await at(131); tween('hallLight', 0.3, 600); S.hallFlicker = 0;

    // the door
    await at(134); setAt('door'); Sound.knock([0, 0.45, 0.62], 0.9);
    await at(136); Sound.voice('w_onlyme', { where: 'hall', pan: -0.55, vol: 1.2 });
    await at(140); mumSays('let me in', 600);
    await at(144); Sound.voice('w_letmein', { where: 'hall', pan: -0.55, vol: 1.2 }); Sound.knock([0, 0.3, 0.6, 0.9, 1.2], 1);
    await at(148);
    const r2 = await Phone.incoming('Mum ♥', 'mum', 7000);
    if (r2 === 'accept') { Phone.inCall('Mum ♥', 'mum', '00:01', () => {}); notice(20, 'answer'); Sound.voice('w_iknow', { where: 'ear', vol: 1.3 }); Sound.voice('w_iknow', { where: 'hall', pan: -0.55, delay: 0.05 }); await wait(2200); if (Phone.st.call) Phone.endCall(); }

    // she has run out of patience with the door
    await at(153); Sound.knock([0, 0.18, 0.36, 0.54, 0.72, 0.9, 1.08], 1.2);
    await at(155); Sound.voice('y_door', { where: 'hall', pan: -0.55, vol: 1.25 }); Sound.bang(4, 1.3); S.glitch = 0.4;
    await at(157); Feed.inject('mum_live'); World.liveFrom('door'); Phone.notify({ title: 'forU', body: 'mum_♥ started a LIVE video', app: 'feed', video: 'mum_live' });
    await at(159.5); Sound.voice('y_see', { where: 'hall', pan: -0.55, vol: 1.3 }); Sound.bang(6, 1.5); S.glitch = 0.6;
    // then nothing at all. then it opens the door
    await at(163.5); Sound.silence(0.05);
    await at(166); Sound.clock(false); S.doorSpeed = 0.6; S.door = 0.55; Sound.doorCreak(3.2);
    await wait(1200); setAt('doorway');
    await at(169); think('Don’t look at it.');
    await at(172); Sound.voice('w_hiding', { where: 'room', pan: -0.4, vol: 1.1 });
    await at(178); Sound.voice('y_hiding', { where: 'room', pan: -0.35, vol: 1.2 }); S.glitch = 0.5;
    await at(175); mumSays('I can see you', 500);

    // in the room. behind the phone.
    await at(181); for (let i = 0; i < 4; i++) { Sound.step('room', -0.4 + i * 0.12, 0.7); await wait(700); } setAt('foot');
    think('It’s at the end of the bed. Right behind the phone.', 3600);
    const barrage = ['look at me', 'look at me', 'LOOK AT ME', 'it’s mum', 'it’s your mum', 'why won’t you look at me', 'look at me'];
    for (let i = 0; i < 5 && alive(); i++) { await wait(3300); if (!alive()) return; msg('mum', { from: 'in', text: barrage[i], date: 'Today' }); if (i === 2) Sound.voice('w_look', { where: 'room', pan: 0, vol: 1.2 }); }
    await at(193); Sound.chorus(['w_look', 'w_here', 'w_iknow', 'w_awake'], { count: 6, where: 'near', spread: 1, vol: 0.6 });
    await at(201); if (!alive()) return;
    setAt('side'); Sound.bedSink(); Sound.otherBreath('near', 0.75, 3, 0.5);
    await wait(1500); Sound.voice('w_here', { where: 'near', pan: 0.85, vol: 1.3 });
    for (let i = 5; i < 7 && alive(); i++) { await wait(2600); if (!alive()) return; msg('mum', { from: 'in', text: barrage[i], date: 'Today' }); }
    // right next to your ear
    await at(208.5); Sound.voice('y_look', { where: 'near', pan: 0.7, vol: 1.45 }); S.glitch = 0.9; S.flash = 0.15;
    await at(212.4);
    if (alive()) await survived();
  }

  // ------------------------------------------------------------ endings
  async function caught() {
    if (phase !== 'night') return;
    phase = 'caught';
    const when = clockText();
    Sound.silence(0.1); Sound.stopFeed(); Sound.ring(false); Sound.setHeart(0);
    // a breath of nothing, then the phone is knocked out of your hands
    await wait(350);
    if (!Phone.st.on) Phone.wake(3);
    $('#phone').classList.add('drop'); S.blur = 0; $('#keys').hidden = true; subEl.classList.remove('on'); hintEl.classList.remove('on');
    S.scare = { t0: clock, d: 1.7, k: 0 }; S.fig = null; S.exposure = 1.6;
    Sound.voice('y_look', { where: 'near', vol: 1.4 }); Sound.voice('scream', { where: 'ear', vol: 1.2, delay: 0.35 }); Sound.shriek(1);
    for (let i = 0; i < 17; i++) { S.glitch = 0.4 + Math.random() * 0.8; S.flash = Math.random() < 0.15 ? 0.4 : 0; document.body.style.transform = `translate(${(Math.random() - 0.5) * 22}px, ${(Math.random() - 0.5) * 22}px)`; await wait(100); }
    Sound.stopAll(0.02); S.scare = null; S.fade = 0; document.body.style.transform = '';
    await wait(1600);
    const why = { light: 'It saw your light.', sound: 'It heard your phone.', answer: 'You answered her.', look: 'You looked.', torch: 'You turned the light on.' }[V.cause] || 'It found you.';
    end(`${when} a.m.`, why, 'She has your number now.');
  }
  async function survived() {
    phase = 'survived';
    Phone.setTime('3:33'); Sound.silence(0.2); Sound.setHeart(0); setAt('gone'); S.fig = null;
    await wait(4200);
    msg('danny', { from: 'in', text: 'I’m downstairs. let myself in with mum’s key. her phone is in my pocket. switched off. where are you?', date: 'Today' });
    if (!Phone.st.on) Phone.wake(5);
    await wait(5200);
    // 1%
    Phone.setBattery(1); await wait(1400);
    Phone.sleep(); $('#phone').classList.add('down'); S.phoneLight = 0; tween('fade', 0.5, 2000);
    await wait(4200);
    Sound.restore(0.1);
    Sound.voice('w_night', { where: 'ear', vol: 1.4 });
    await wait(2600);
    Sound.stopAll(0.05); S.fade = 0;
    await wait(1400);
    end('3:33 a.m.', 'You didn’t look.', 'She’ll text again tomorrow night.');
  }
  function end(time, title, text) {
    phase = 'end'; document.body.classList.remove('playing');
    $('#endTime').textContent = time; $('#endTitle').textContent = title; $('#endText').textContent = text;
    $('#endCard').hidden = false; $('#phone').hidden = true; $('#keys').hidden = true; $('#touch').hidden = true;
  }

  // ------------------------------------------------------------ start
  async function begin() {
    $('#startBtn').disabled = true; $('#startBtn').textContent = 'loading…';
    await Sound.init();
    try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); } catch (e) {}
    $('#startCard').hidden = true; document.body.classList.add('playing');
    if (coarse) { $('#touch').hidden = false; $('#keys').hidden = true; }
    seedHistory(); Phone.feedChanged();
    await intro();
    await night();
  }
  $('#startBtn').addEventListener('click', begin);
  $('#againBtn').addEventListener('click', () => location.reload());
  window.__night = { setSpeed: v => { speed = v; }, S, V, get phase() { return phase; }, get clock() { return clock; }, Phone, Feed };
})();
