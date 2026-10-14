// The phone in your hand. It is the only light in the room, the only way
// to know what is happening, and the thing that gives you away.
const Phone = (() => {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const st = { on: true, locked: false, app: '', stack: [], muted: false, torch: false, raised: true, idle: 0, wakeT: 0, thread: null, call: null, vnPlaying: null, flash: false };
  let onAction = () => {}, phone, screen, feedCv;
  const threads = {};
  const notes = [];

  // ------------------------------------------------------------ art
  function paint(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); return c.toDataURL(); }
  const WALL = paint(360, 760, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#f2a65a'); s.addColorStop(0.45, '#e86f68'); s.addColorStop(0.62, '#5b6ea8'); s.addColorStop(1, '#1d2440'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffd59a'; g.beginPath(); g.arc(w / 2, h * 0.5, 50, 0, 7); g.fill();
    g.fillStyle = '#2a2f55'; g.fillRect(0, h * 0.55, w, h); g.fillStyle = 'rgba(255,200,150,.25)'; for (let i = 0; i < 12; i++) g.fillRect(w / 2 - 60 + Math.random() * 120, h * 0.56 + i * 12, 30 + Math.random() * 40, 2);
    g.fillStyle = '#1a1a26'; const fig = (x, s) => { g.beginPath(); g.arc(x, h * 0.66 - 70 * s, 14 * s, 0, 7); g.fill(); g.fillRect(x - 12 * s, h * 0.66 - 56 * s, 24 * s, 60 * s); g.fillRect(x - 10 * s, h * 0.66, 8 * s, 40 * s); g.fillRect(x + 2 * s, h * 0.66, 8 * s, 40 * s); };
    fig(w / 2 - 30, 1.25); fig(w / 2 + 20, 0.8); g.fillRect(w / 2 - 18, h * 0.66 - 30, 34, 6);
  });
  const MUMPIC = paint(80, 80, (g) => {
    g.fillStyle = '#c9a77c'; g.fillRect(0, 0, 80, 80); g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(40, 40, 24, 28, 0, 0, 7); g.fill(); g.fillRect(16, 40, 48, 40);
    g.fillStyle = '#e0c4a6'; g.beginPath(); g.ellipse(40, 42, 15, 19, 0, 0, 7); g.fill(); g.fillStyle = '#a04848'; g.fillRect(34, 52, 12, 2);
  });
  const AV = { mum: `<img src="${MUMPIC}" alt="">`, danny: 'D', carol: 'C', sam: 'S', '999': '!' };

  // ------------------------------------------------------------ build
  function build() {
    phone = $('#phone'); screen = $('#screen');
    screen.innerHTML = `
      <div class="status"><span class="st-time">3:03</span><span class="island"></span><span class="st-right"><i class="st-mute" hidden>🔕</i> ▂▄▆ <b class="st-batt">31%</b></span></div>
      <section class="app" data-app="lock"><div class="wall" style="background-image:url(${WALL})"></div>
        <div class="lk-date">Friday 9 October</div><div class="lk-time">3:03</div><div class="lk-notes"></div>
        <button class="lk-btn lk-torch" aria-label="Torch">🔦</button><button class="lk-btn lk-cam" aria-label="Camera">📷</button><div class="lk-hint">tap to open</div></section>
      <section class="app" data-app="home"><div class="wall dim" style="background-image:url(${WALL})"></div>
        <div class="grid">
          <button data-open="msgs"><i class="ic ic-msg">💬<em class="badge" hidden></em></i>Messages</button>
          <button data-open="feed"><i class="ic ic-feed">♪</i>forU</button>
          <button data-open="cam"><i class="ic ic-cam">◉</i>Camera</button>
          <button data-open="dial"><i class="ic ic-phone">✆</i>Phone</button>
          <button class="torch-btn"><i class="ic ic-torch">🔦</i>Torch</button>
        </div></section>
      <section class="app" data-app="msgs"><header><b>Messages</b></header><div class="list"></div></section>
      <section class="app" data-app="thread"><header><button class="back">‹</button><span class="av"></span><b class="tname"></b></header><div class="bubbles"></div><div class="replies"></div><div class="compose">Text message</div></section>
      <section class="app" data-app="feed"><canvas width="360" height="760"></canvas>
        <div class="f-top"><span>Following</span><b>For You</b></div><div class="f-live" hidden>LIVE · <span>1</span> watching</div>
        <div class="f-side"><span>♥<small class="f-likes"></small></span><span>💬<small class="f-comments"></small></span><span>↗<small>Share</small></span></div>
        <div class="f-info"><b class="f-user"></b> <small class="f-ago"></small><p class="f-cap"></p></div><div class="f-comments-live"></div><div class="f-hint">scroll ↓</div></section>
      <section class="app" data-app="cam"><div class="c-top"><span class="c-night">☾ NIGHT</span><button class="c-flash">⚡ off</button></div><div class="vf"></div>
        <div class="c-bottom"><span class="c-thumb"></span><button class="shutter" aria-label="Take photo"></button><span></span></div></section>
      <section class="app" data-app="dial"><header><b>Favourites</b></header><div class="list">
        <button data-call="mum"><span class="av">${AV.mum}</span><span><b>Mum ♥</b><small>mobile</small></span><i>✆</i></button>
        <button data-call="danny"><span class="av">D</span><span><b>Danny</b><small>mobile</small></span><i>✆</i></button>
        <button data-call="999"><span class="av">!</span><span><b>Emergency</b><small>999</small></span><i>✆</i></button>
        <p class="recents"></p></div></section>
      <section class="app" data-app="call"><div class="cl-name"></div><div class="cl-sub"></div><div class="cl-av"></div><div class="cl-btns"></div></section>
      <div class="banner"></div><button class="homebar" aria-label="Home"></button><div class="off"></div>`;
    feedCv = screen.querySelector('[data-app=feed] canvas');
    // taps
    screen.addEventListener('pointerdown', e => { st.idle = 0; if (!st.on) return; });
    screen.querySelector('[data-app=lock]').addEventListener('click', e => {
      if (e.target.closest('.lk-torch')) return toggleTorch();
      if (e.target.closest('.lk-cam')) { unlock(); return open('cam'); }
      const n = e.target.closest('.lk-note'); unlock();
      if (n && n.dataset.thread) openThread(n.dataset.thread); else if (n && n.dataset.app) openApp(n.dataset.app, n.dataset.video);
    });
    screen.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => open(b.dataset.open)));
    screen.querySelector('.torch-btn').addEventListener('click', toggleTorch);
    screen.querySelector('.homebar').addEventListener('click', () => { if (!st.locked && st.app !== 'call') open('home'); });
    screen.querySelector('[data-app=thread] .back').addEventListener('click', () => open('msgs'));
    screen.querySelector('.c-flash').addEventListener('click', e => { st.flash = !st.flash; e.target.textContent = st.flash ? '⚡ on' : '⚡ off'; });
    screen.querySelector('.shutter').addEventListener('click', () => { Sound.shutter(); onAction('shutter', { flash: st.flash }); });
    screen.querySelectorAll('[data-call]').forEach(b => b.addEventListener('click', () => onAction('dial', b.dataset.call)));
    screen.querySelector('.banner').addEventListener('click', e => { const b = e.currentTarget; b.classList.remove('on'); if (b.dataset.thread) openThread(b.dataset.thread); else if (b.dataset.app) openApp(b.dataset.app, b.dataset.video); });
    // the feed scrolls
    const fs = screen.querySelector('[data-app=feed]');
    let wheelLock = 0, dragY = null;
    fs.addEventListener('wheel', e => { e.preventDefault(); if (performance.now() < wheelLock || Math.abs(e.deltaY) < 8) return; wheelLock = performance.now() + 450; scrollFeed(e.deltaY > 0 ? 1 : -1); }, { passive: false });
    fs.addEventListener('pointerdown', e => { dragY = e.clientY; });
    fs.addEventListener('pointerup', e => { if (dragY == null) return; const d = dragY - e.clientY; dragY = null; if (Math.abs(d) > 30) scrollFeed(d > 0 ? 1 : -1); else if (Math.abs(d) < 6) scrollFeed(1); });
    // side buttons
    $('#pwrBtn').addEventListener('click', power); $('#muteBtn').addEventListener('click', toggleMute);
  }

  // ------------------------------------------------------------ navigation
  function open(app) {
    if (st.locked || !st.on) return;
    if (app === st.app) return;
    st.app = app;
    screen.querySelectorAll('.app').forEach(a => a.classList.toggle('on', a.dataset.app === app));
    if (app === 'msgs') renderList();
    if (app === 'feed') { feedChanged(); screen.querySelector('.f-hint').classList.toggle('gone', Feed.depth > 1); }
    else Sound.stopFeed();
    onAction('open', app);
  }
  function openApp(app, video) { open(app); if (app === 'feed' && video && Feed.current.id !== video) { Feed.inject(video, true); feedChanged(); onAction('feed', video); } }
  function openThread(id) { st.thread = id; threads[id].unread = 0; renderThread(); if (st.app !== 'thread') { st.app = ''; open('thread'); } updateBadge(); }
  function scrollFeed(d) {
    if (Feed.sliding) return;
    if (d > 0 ? Feed.next() : Feed.prev()) { Sound.click(0.08); feedChanged(); onAction('feed', Feed.current.id); screen.querySelector('.f-hint').classList.add('gone'); }
  }
  function feedChanged() {
    const v = Feed.current, q = s => screen.querySelector(s);
    q('.f-user').textContent = v.user || ''; q('.f-cap').textContent = v.caption || ''; q('.f-likes').textContent = v.likes || '';
    q('.f-comments').textContent = v.comments || ''; q('.f-ago').textContent = v.ago ? `· ${v.ago}` : '';
    q('.f-live').hidden = !v.live; q('[data-app=feed]').classList.toggle('live', !!v.live); q('[data-app=feed]').classList.toggle('sys', !!v.system);
    q('.f-comments-live').textContent = '';
    if (st.app === 'feed' && st.on && !st.locked) Sound.feed(v.audio, st.muted);
  }
  function liveComment(name, text) {
    const box = screen.querySelector('.f-comments-live'), c = el('p', null, `<b>${esc(name)}</b> ${esc(text)}`);
    box.append(c); while (box.children.length > 5) box.firstChild.remove();
  }

  // ------------------------------------------------------------ messages
  function thread(id, name) { threads[id] = threads[id] || { id, name, msgs: [], unread: 0, replies: null, typing: false }; return threads[id]; }
  function addMsg(id, m, { notify: n = true } = {}) {
    const t = threads[id]; t.msgs.push(m); t.typing = false;
    if (m.from === 'in' && !m.seen && !(st.app === 'thread' && st.thread === id && st.on && !st.locked)) { t.unread++; if (n) notify({ title: t.name, body: m.vn ? '🎤 Voice message' : m.text, thread: id }); }
    if (st.app === 'thread' && st.thread === id) renderThread(); else if (st.app === 'msgs') renderList();
    updateBadge();
  }
  function typing(id, on) { threads[id].typing = on; if (st.app === 'thread' && st.thread === id) renderThread(); }
  function offer(id, opts) { threads[id].replies = opts; if (st.app === 'thread' && st.thread === id) renderThread(); }
  function updateBadge() { const n = Object.values(threads).reduce((a, t) => a + t.unread, 0), b = screen.querySelector('.ic-msg .badge'); b.hidden = !n; b.textContent = n; }
  function renderList() {
    const list = screen.querySelector('[data-app=msgs] .list'); list.innerHTML = '';
    Object.values(threads).sort((a, b) => (b.msgs.at(-1)?.order || 0) - (a.msgs.at(-1)?.order || 0)).forEach(t => {
      const last = t.msgs.at(-1) || {};
      const row = el('button', 'row' + (t.unread ? ' unread' : ''), `<span class="av">${AV[t.id] || t.name[0]}</span><span><b>${esc(t.name)}</b><small>${esc(last.vn ? '🎤 Voice message' : (last.text || ''))}</small></span><i>${esc(last.time || '')}</i>`);
      row.addEventListener('click', () => openThread(t.id)); list.append(row);
    });
  }
  function renderThread() {
    const t = threads[st.thread], app = screen.querySelector('[data-app=thread]');
    app.querySelector('.tname').textContent = t.name; app.querySelector('.av').innerHTML = AV[t.id] || t.name[0];
    const box = app.querySelector('.bubbles'); box.innerHTML = '';
    let lastDate = '';
    for (const m of t.msgs) {
      if (m.date && m.date !== lastDate) { box.append(el('p', 'date', esc(m.date))); lastDate = m.date; }
      if (m.vn) {
        const b = el('div', `bub ${m.from} vn`, `<button aria-label="Play">▶</button><span class="wave">${'<i></i>'.repeat(22)}</span><small>${m.vn.dur}</small>`);
        b.querySelector('button').addEventListener('click', () => playVN(m, b));
        box.append(b);
      } else box.append(el('div', `bub ${m.from}`, esc(m.text)));
    }
    if (t.typing) box.append(el('div', 'bub in typing', '<i></i><i></i><i></i>'));
    box.scrollTop = box.scrollHeight;
    const rep = app.querySelector('.replies'); rep.innerHTML = '';
    (t.replies || []).forEach((r, i) => { const b = el('button', null, esc(r)); b.addEventListener('click', () => { t.replies = null; onAction('reply', { thread: t.id, text: r, i }); }); rep.append(b); });
  }
  function playVN(m, b) {
    if (st.vnPlaying) return;
    const ms = Sound.voice(m.vn.id, { where: 'phone', pan: 0.05, vol: 1 });
    st.vnPlaying = m; b.classList.add('playing'); onAction('vn', m.vn.id);
    setTimeout(() => { st.vnPlaying = null; b.classList.remove('playing'); }, ms);
  }

  // ------------------------------------------------------------ notifications
  function notify({ title, body, thread: tid, app, video, silent }) {
    if (!silent) { if (st.muted) Sound.buzz(2); else Sound.ping(); onAction('ping', { muted: st.muted }); }
    notes.unshift({ title, body, tid, app, video }); if (notes.length > 4) notes.pop();
    renderLock();
    if (!st.on) wake(4.5);
    else if (!st.locked) {
      const b = screen.querySelector('.banner'); b.innerHTML = `<b>${esc(title)}</b><span>${esc(body)}</span>`;
      b.dataset.thread = tid || ''; b.dataset.app = app || ''; b.dataset.video = video || ''; b.classList.add('on');
      clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('on'), 4200);
    } else st.wakeT = Math.max(st.wakeT, 4.5);
  }
  function renderLock() {
    const box = screen.querySelector('.lk-notes'); box.innerHTML = '';
    notes.forEach(n => { const d = el('div', 'lk-note', `<b>${esc(n.title)}</b><span>${esc(n.body)}</span>`); if (n.tid) d.dataset.thread = n.tid; if (n.app) d.dataset.app = n.app; if (n.video) d.dataset.video = n.video; box.append(d); });
  }

  // ------------------------------------------------------------ calls
  function incoming(name, who, ringMs = 9000) {
    return new Promise(res => {
      if (!st.on) wake(ringMs / 1000);
      st.call = { name, who, state: 'ringing' };
      showCall(name, 'mobile', [['decline', 'Decline'], ['accept', 'Accept']], who);
      Sound.ring(true, () => st.muted);
      const done = r => { if (!st.call || st.call.done) return; st.call.done = true; Sound.ring(false); clearTimeout(timer); res(r); };
      const timer = setTimeout(() => { done('ringout'); endCall(); }, ringMs);
      st.call.resolve = done;
    });
  }
  function showCall(name, sub, btns, who) {
    if (st.app !== 'call') st.stack.push(st.app);
    st.locked = false; st.app = 'call';
    screen.querySelectorAll('.app').forEach(a => a.classList.toggle('on', a.dataset.app === 'call'));
    const c = screen.querySelector('[data-app=call]');
    c.querySelector('.cl-name').textContent = name; c.querySelector('.cl-sub').textContent = sub; c.querySelector('.cl-av').innerHTML = AV[who] || name[0];
    const bx = c.querySelector('.cl-btns'); bx.innerHTML = '';
    btns.forEach(([k, label]) => { const b = el('button', 'cb-' + k, `<i></i>${label}`); b.addEventListener('click', () => onCallBtn(k)); bx.append(b); });
  }
  function onCallBtn(k) {
    const c = st.call; if (!c) return;
    if (c.state === 'ringing') { c.resolve(k === 'accept' ? 'accept' : 'decline'); if (k !== 'accept') endCall(); }
    else if (k === 'end') { c.hangup && c.hangup(); endCall(); }
  }
  function inCall(name, who, sub, onHangup) {
    st.call = st.call || {}; Object.assign(st.call, { name, who, state: 'active', hangup: onHangup });
    showCall(name, sub, [['end', 'End']], who);
  }
  function setCallSub(s) { screen.querySelector('[data-app=call] .cl-sub').textContent = s; }
  function endCall() {
    Sound.ring(false); st.call = null;
    const back = st.stack.pop() || 'home'; st.app = '';
    open(back === 'call' ? 'home' : back);
  }

  // ------------------------------------------------------------ power, silent, torch, hold
  function power() {
    Sound.click(0.3);
    if (st.on) sleep(); else wake(6);
    onAction('power', st.on);
  }
  function sleep() { st.on = false; st.locked = true; st.wakeT = 0; screen.classList.add('dark'); Sound.stopFeed(); if (st.call && st.call.state === 'ringing') { /* the ringer keeps going */ } }
  function wake(secs) {
    st.on = true; screen.classList.remove('dark'); st.wakeT = secs || 6;
    if (st.locked) screen.querySelectorAll('.app').forEach(a => a.classList.toggle('on', a.dataset.app === (st.app === 'call' ? 'call' : 'lock')));
  }
  function unlock() {
    if (!st.locked) return; st.locked = false; st.wakeT = 0;
    const app = st.app || 'feed'; st.app = ''; open(app === 'lock' ? 'home' : app);
  }
  function lockNow() { st.locked = true; }
  function toggleMute() {
    st.muted = !st.muted; Sound.buzz(1); $('#muteBtn').classList.toggle('on', st.muted);
    screen.querySelector('.st-mute').hidden = !st.muted;
    if (st.muted) Sound.stopFeed(); else if (st.app === 'feed' && st.on && !st.locked) Sound.feed(Feed.current.audio, false);
    onAction('mute', st.muted);
  }
  function toggleTorch() { st.torch = !st.torch; Sound.click(0.35); phone.classList.toggle('torch', st.torch); onAction('torch', st.torch); }
  function setRaised(r) { st.raised = r; phone.classList.toggle('down', !r); }

  // ------------------------------------------------------------ per frame
  function update(dt) {
    st.idle += dt;
    if (st.on && st.locked && st.app !== 'call') { st.wakeT -= dt; if (st.wakeT <= 0) sleep(); }
    if (st.app === 'feed' && st.on && !st.locked) Feed.draw(dt);
  }
  function brightness() {
    if (!st.on) return 0;
    const a = st.locked ? 'lock' : st.app;
    const b = { lock: 0.5, home: 0.5, msgs: 0.25, thread: 0.25, feed: Feed.current.bright ?? 0.4, cam: 0.3, dial: 0.25, call: 0.3 }[a] ?? 0.4;
    return b;
  }
  function rectOf(sel) { const n = screen.querySelector(sel); return n ? n.getBoundingClientRect() : null; }
  function views() {
    if (!st.on || st.locked) return [];
    if (st.app === 'cam') return [{ rect: rectOf('.vf'), mode: 'camera' }];
    if (st.app === 'feed' && Feed.current.live && !Feed.sliding) return [{ rect: feedCv.getBoundingClientRect(), mode: 'live', exposure: 10 }];
    return [];
  }

  function init(opts) {
    onAction = opts.onAction; build();
    Feed.init(feedCv, opts.faceImage);
    thread('mum', 'Mum ♥'); thread('danny', 'Danny'); thread('carol', 'Auntie Carol'); thread('sam', 'Sam (work)');
    open('feed');
  }
  function setTime(s) { screen.querySelector('.st-time').textContent = s; screen.querySelector('.lk-time').textContent = s; }
  function setBattery(n) { screen.querySelector('.st-batt').textContent = `${n}%`; screen.querySelector('.st-batt').classList.toggle('low', n <= 10); }
  function recents(html) { screen.querySelector('.recents').innerHTML = html; }

  return {
    init, update, open, openThread, addMsg, typing, offer, notify, incoming, inCall, setCallSub, endCall,
    power, sleep, wake, unlock, lockNow, toggleMute, toggleTorch, setRaised, setTime, setBattery, recents, liveComment, views, brightness,
    scrollFeed, feedChanged, thread,
    get st() { return st; },
  };
})();
