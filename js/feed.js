// forU: the feed. Normal videos first; past "you're all caught up" it
// slides into the farlands, the end of the algorithm, where the videos
// stop being for you and start being about you.
const Feed = (() => {
  let cv, g, W = 360, H = 640, faceImg = () => null;
  let list = [], idx = 0, slideFrom = null, slideT = 1, farStart = 0;
  const R = (a, b) => a + Math.random() * (b - a);
  const font = (px, w = 700, fam = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif') => `${w} ${px}px ${fam}`;
  function wrap(text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; } else line = test;
    }
    g.fillText(line, x, y); return y;
  }
  function grad(c0, c1, vertical = true) { const gr = vertical ? g.createLinearGradient(0, 0, 0, H) : g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  function vhs(t, amt = 1) {
    for (let i = 0; i < 3; i++) { const y = (t * 120 + i * 230) % (H + 40) - 20; g.fillStyle = `rgba(255,255,255,${0.05 * amt})`; g.fillRect(0, y, W, 3 + i * 2); }
    for (let i = 0; i < 300 * amt; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
  }

  // ------------------------------------------------------------ normal
  const NORMAL = [
    { id: 'cat', user: '@biscuit.the.cat', caption: 'when he finally falls asleep on you and now you live here 😭', likes: '482K', comments: '3,104', audio: 'soft', bright: 0.45, draw(t) {
      grad('#4a3526', '#1c130d');
      g.fillStyle = '#6b4b6e'; g.beginPath(); g.ellipse(W / 2, H * 0.62, 170, 120, 0, 0, 7); g.fill();
      const br = 1 + Math.sin(t * 1.7) * 0.025;
      g.fillStyle = '#d18a3f'; g.beginPath(); g.ellipse(W / 2, H * 0.6, 95 * br, 62 * br, -0.15, 0, 7); g.fill();
      g.beginPath(); g.arc(W / 2 - 70, H * 0.55, 42, 0, 7); g.fill();
      g.beginPath(); g.moveTo(W / 2 - 100, H * 0.52); g.lineTo(W / 2 - 92, H * 0.47); g.lineTo(W / 2 - 80, H * 0.51); g.moveTo(W / 2 - 60, H * 0.5); g.lineTo(W / 2 - 48, H * 0.46); g.lineTo(W / 2 - 42, H * 0.51); g.fill();
      g.strokeStyle = '#8a5524'; g.lineWidth = 6; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(W / 2 + 10 + k * 18, H * 0.6, 40, -0.6, 0.3); g.stroke(); }
      g.strokeStyle = '#3a2412'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2 - 82, H * 0.55, 6, 0.2, 2.9); g.arc(W / 2 - 60, H * 0.55, 6, 0.2, 2.9); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.font = font(26); g.fillText('z', W / 2 - 40 + Math.sin(t) * 4, H * 0.42 - (t * 20 % 60));
    } },
    { id: 'pov', user: '@low.battery.club', caption: 'pov: it’s 3am and you’ve been “about to sleep” for two hours #relatable', likes: '1.2M', comments: '8,902', audio: 'lofi', bright: 0.7, draw(t) {
      grad('#2b1055', '#7597de');
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(34, 800);
      g.save(); g.translate(W / 2, H * 0.42); g.scale(1 + Math.sin(t * 2) * 0.02, 1 + Math.sin(t * 2) * 0.02);
      g.fillText('pov: it’s 3am', 0, 0); g.font = font(24, 600); g.fillText('and you’re still', 0, 44); g.fillText('scrolling 🫠', 0, 78); g.restore(); g.textAlign = 'left';
    } },
    { id: 'rain', user: '@sleep.sounds', caption: 'rain on a window, 10 hours. close your eyes 🌧️ #sleep #asmr', likes: '96K', comments: '412', audio: 'rain', bright: 0.25, draw(t) {
      grad('#0d1626', '#1c2a40');
      for (let i = 0; i < 14; i++) { const x = (i * 71) % W, y = (i * 113) % H; const r = g.createRadialGradient(x, y, 1, x, y, 40); r.addColorStop(0, 'rgba(255,170,80,.35)'); r.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = r; g.fillRect(x - 40, y - 40, 80, 80); }
      g.strokeStyle = 'rgba(190,210,240,.45)'; g.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) { const x = (i * 37.3) % W, y = (i * 91.7 + t * (40 + i % 7 * 12)) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y + 14); g.stroke(); }
    } },
    { id: 'toast', user: '@crumbs.and.co', caption: 'midnight toast but make it ✨aesthetic✨', likes: '211K', comments: '1,877', audio: 'lofi', bright: 0.55, draw(t) {
      grad('#20160f', '#0c0806');
      g.fillStyle = '#111'; g.beginPath(); g.arc(W / 2, H / 2, 140, 0, 7); g.fill();
      g.fillStyle = '#c98a3e'; g.save(); g.translate(W / 2, H / 2); g.rotate(0.1); g.fillRect(-80, -80, 160, 160);
      g.fillStyle = '#e5b26a'; g.fillRect(-70, -70, 140, 140);
      const s = Math.max(10, 40 - t * 3 % 30); g.fillStyle = '#f7e08a'; g.fillRect(-s / 2, -s / 2, s, s);
      g.fillStyle = 'rgba(247,224,138,.6)'; g.beginPath(); g.ellipse(0, 0, 60 - s, 50 - s * 0.8, 0.4, 0, 7); g.fill(); g.restore();
    } },
    { id: 'grief', user: '@soft.hours', caption: 'if you lost your mum this year, this one’s for you 🤍 #grief', likes: '2.4M', comments: '61K', audio: 'soft', bright: 0.2, draw(t) {
      g.fillStyle = '#050403'; g.fillRect(0, 0, W, H);
      const fl = 1 + Math.sin(t * 13) * 0.06 + Math.sin(t * 7.1) * 0.05;
      const r = g.createRadialGradient(W / 2, H * 0.55, 2, W / 2, H * 0.55, 180 * fl); r.addColorStop(0, 'rgba(255,190,110,.55)'); r.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
      g.fillStyle = '#efe6d6'; g.fillRect(W / 2 - 22, H * 0.58, 44, 120);
      g.fillStyle = '#ffcf7a'; g.beginPath(); g.ellipse(W / 2, H * 0.55, 9 * fl, 22 * fl, Math.sin(t * 3) * 0.08, 0, 7); g.fill();
      g.fillStyle = `rgba(255,255,255,${Math.min(1, t / 2)})`; g.textAlign = 'center'; g.font = font(20, 500, 'Georgia, serif');
      g.fillText('she would want you to sleep.', W / 2, H * 0.28);
      if (t > 3) { g.fillStyle = `rgba(255,255,255,${Math.min(1, (t - 3) / 2)})`; g.fillText('she is not angry with you.', W / 2, H * 0.33); }
      g.textAlign = 'left';
    } },
    { id: 'sand', user: '@sandy.asmr', caption: 'the last slice 🤤 #satisfying #kineticsand', likes: '740K', comments: '2,220', audio: 'lofi', bright: 0.75, draw(t) {
      grad('#f4d9e8', '#d6e6f7');
      const k = (t * 0.6) % 1, n = Math.floor(t * 0.6) % 6;
      ['#f29bbd', '#9bd0f2', '#c8f29b', '#f2e29b'].forEach((c, i) => { g.fillStyle = c; g.fillRect(70, 220 + i * 40, 220 - n * 20, 40); });
      g.fillStyle = '#ccc'; g.fillRect(290 - n * 20 - 10, 120 + k * 120, 6, 200);
      g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(60, 380, 250, 12);
    } },
    { id: 'fact', user: '@did.you.know.daily', caption: 'you won’t unsee this 👀 #facts #fyp', likes: '88K', comments: '5,019', audio: 'lofi', bright: 0.6, draw(t) {
      grad('#0b3d91', '#061a3d');
      g.fillStyle = '#ffd84d'; g.font = font(22, 800); g.fillText('DID YOU KNOW', 28, 150);
      g.fillStyle = '#fff'; g.font = font(25, 700);
      const y = wrap('your phone screen is the brightest thing in your room right now.', 28, 200, 300, 34);
      if (t > 2.5) { g.fillStyle = `rgba(255,255,255,${Math.min(1, (t - 2.5) / 1.5)})`; wrap('anything standing in the dark can see your face perfectly.', 28, y + 60, 300, 34); }
    } },
    { id: 'lofi', user: '@lo.fi.nights', caption: 'lofi for the ones who can’t sleep tonight 🌙', likes: '305K', comments: '980', audio: 'lofi', bright: 0.35, draw(t) {
      grad('#1b1f3a', '#3d2c4f');
      g.fillStyle = '#0e1024'; g.fillRect(40, 120, 280, 220); g.fillStyle = '#e8e2c8'; g.beginPath(); g.arc(250, 180, 26, 0, 7); g.fill();
      g.strokeStyle = '#2a2240'; g.lineWidth = 8; g.strokeRect(40, 120, 280, 220); g.beginPath(); g.moveTo(180, 120); g.lineTo(180, 340); g.stroke();
      g.fillStyle = '#ffb35c'; g.beginPath(); g.moveTo(70, 470); g.lineTo(110, 410); g.lineTo(150, 470); g.fill();
      const r = g.createRadialGradient(110, 450, 4, 110, 450, 160); r.addColorStop(0, 'rgba(255,180,90,.35)'); r.addColorStop(1, 'rgba(255,180,90,0)'); g.fillStyle = r; g.fillRect(0, 300, W, 340);
      g.fillStyle = '#2b2440'; g.fillRect(0, 470, W, 170);
      for (let i = 0; i < 5; i++) { const h = 10 + Math.abs(Math.sin(t * 3 + i)) * 30; g.fillStyle = '#c9a7ff'; g.fillRect(200 + i * 18, 560 - h, 10, h); }
    } },
  ];

  // ------------------------------------------------------------ farlands
  const FAR = [
    { id: 'caughtup', user: '', caption: '', likes: '', comments: '', audio: null, bright: 0.15, system: true, draw(t) {
      g.fillStyle = '#0c0c0e'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#6ee7a8'; g.lineWidth = 4; g.beginPath(); g.arc(W / 2, H * 0.4, 34, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(W / 2 - 14, H * 0.4); g.lineTo(W / 2 - 3, H * 0.4 + 11); g.lineTo(W / 2 + 16, H * 0.4 - 12); g.stroke();
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(22, 700); g.fillText('You’re all caught up', W / 2, H * 0.52);
      g.fillStyle = '#9a9aa4'; g.font = font(15, 400); g.fillText('You’ve seen every new video.', W / 2, H * 0.56);
      g.fillStyle = `rgba(154,154,164,${0.5 + Math.sin(t * 3) * 0.3})`; g.fillText('keep scrolling ↓', W / 2, H * 0.8); g.textAlign = 'left';
    } },
    { id: 'farlands', user: '@▓▓▓▓▓▓', caption: 'you went past the end of it', likes: '0', comments: '0', audio: 'drone', bright: 0.4, draw(t) {
      grad('#7fa6d9', '#b8cde8');
      // the far lands: the world, glitched into walls
      for (let x = 0; x < W; x += 8) {
        const h = 200 + ((Math.floor(x / 8) * 37) % 13) * 22 + Math.sin(x * 0.4 + t) * 4;
        g.fillStyle = '#5b8f3a'; g.fillRect(x, H - h, 8, 8);
        g.fillStyle = '#7a5a3a'; g.fillRect(x, H - h + 8, 8, h);
        for (let y = H - h + 20; y < H; y += 26) { g.fillStyle = (x / 8 + y / 26) % 3 < 1 ? '#5f5f5f' : '#6c4c30'; g.fillRect(x, y, 8, 12); }
      }
      g.fillStyle = '#fff'; g.font = font(20, 700, 'Courier New, monospace'); g.fillText('you have reached', 30 + Math.random() * 2, 120); g.fillText('the far lands', 30, 148 + Math.random() * 2);
    } },
    { id: 'bee', user: '@b.e.e', caption: '🐝🎻 he plays for the ones who are still awake', likes: '13', comments: '2', audio: 'bee', bright: 0.6, draw(t) {
      grad('#9fd3f5', '#e9f6ff');
      g.save(); g.translate(W / 2, H * 0.5 + Math.sin(t * 2.4) * 12); g.rotate(Math.sin(t * 1.2) * 0.08);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-30, -78, 30, 44 + Math.sin(t * 40) * 8, -0.5, 0, 7); g.ellipse(30, -78, 30, 44 + Math.sin(t * 40) * 8, 0.5, 0, 7); g.fill();
      g.fillStyle = '#f5c518'; g.beginPath(); g.ellipse(0, 0, 100, 90, 0, 0, 7); g.fill();
      g.fillStyle = '#1a1a1a'; g.fillRect(-100, -20, 200, 22); g.fillRect(-92, 25, 184, 22);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-34, -40, 13, 0, 7); g.arc(34, -40, 13, 0, 7); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(-34, -38, 6, 0, 7); g.arc(34, -38, 6, 0, 7); g.fill();
      g.fillStyle = '#8a4b1f'; g.save(); g.rotate(-0.6); g.beginPath(); g.ellipse(60, 40, 24, 50, 0, 0, 7); g.fill(); g.fillRect(55, -60, 10, 70); g.restore();
      g.strokeStyle = '#ddd'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60 + Math.sin(t * 5) * 30, 60); g.lineTo(110 + Math.sin(t * 5) * 30, 0); g.stroke();
      g.restore();
    } },
    { id: 'face', user: '@user00000003', caption: 'she looks just like her doesn’t she 🤍', likes: '3', comments: '1', audio: 'drone', bright: 0.25, draw(t) {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const img = faceImg();
      if (img) {
        const z = 1.2 + t * 0.03, s = W * z;
        g.save(); g.globalAlpha = 0.95; g.drawImage(img, W / 2 - s / 2 + Math.sin(t * 9) * 1.5, H * 0.45 - s / 2, s, s);
        if (Math.sin(t * 2.3) > 0.97) { g.globalCompositeOperation = 'difference'; g.drawImage(img, W / 2 - s / 2 + 6, H * 0.45 - s / 2, s, s); }
        g.restore();
      }
      vhs(t, 0.7);
    } },
    { id: 'rules', user: '@public.information.films', caption: 'PIF #13 (1987). nobody remembers this being on tv', likes: '41', comments: '9', audio: 'vhs', bright: 0.45, rules: true, draw(t) {
      g.fillStyle = '#16169c'; g.fillRect(0, 0, W, H);
      const slides = [
        ['PUBLIC', 'INFORMATION', 'FILM'],
        ['IF SOMEONE YOU', 'HAVE LOST', 'CONTACTS YOU', 'AFTER 3 A.M.'],
        ['1. DO NOT ANSWER IT.', '', 'IT LEARNS HER', 'FROM YOUR ANSWERS.'],
        ['2. DO NOT LET IT', 'HEAR YOUR PHONE.', '', 'SILENCE IT.'],
        ['3. WHEN IT IS IN', 'THE ROOM, GO DARK.', '', 'SCREEN OFF.', 'LIGHTS OFF.'],
        ['4. DO NOT LOOK', 'AT IT.', '', 'NOT WITH YOUR EYES.', 'NOT WITH YOUR CAMERA.'],
        ['5. AT 3:33', 'IT MUST LEAVE.'],
        ['IT IS ONLY HER', 'IF SHE IS', 'STILL ALIVE.'],
      ];
      const i = Math.floor(t / 2.8) % slides.length;
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(25, 700, 'Courier New, monospace');
      slides[i].forEach((l, k) => g.fillText(l, W / 2 + (Math.random() < 0.05 ? 3 : 0), H * 0.32 + k * 38));
      g.textAlign = 'left'; g.font = font(14, 700, 'Courier New, monospace'); g.fillText('PLAY ▶', 18, 40); g.fillText('OCT 09 1987', W - 120, H - 40);
      vhs(t, 1);
    } },
    { id: 'hall', user: '@liminal.archive', caption: 'who left the light on', likes: '7', comments: '0', audio: 'drone', bright: 0.3, draw(t) {
      g.fillStyle = '#2b2a22'; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#4a473a'; g.lineWidth = 2;
      for (let i = 0; i < 10; i++) { const k = i / 10, x0 = k * 140, y0 = k * 260; g.strokeRect(x0, y0, W - x0 * 2, H - y0 * 2); }
      g.fillStyle = '#0b0a08'; g.fillRect(W / 2 - 28, H / 2 - 50, 56, 90);
      g.fillStyle = '#ffd38a'; g.fillRect(W / 2 - 28, H / 2 + 38, 56, 2);
      g.fillStyle = '#b6ff3b'; g.font = font(22, 700, 'Comic Sans MS, cursive'); g.fillText('WHO LEFT', 30 + Math.sin(t) * 3, 120); g.fillText('THE LIGHT ON', 60, 150 + Math.cos(t) * 3);
    } },
    { id: 'eyes', user: '@▓▓▓', caption: 'they are all awake too', likes: '1', comments: '0', audio: 'static', bright: 0.15, draw(t) {
      g.fillStyle = '#050505'; g.fillRect(0, 0, W, H);
      for (let i = 0; i < 24; i++) {
        const x = 40 + (i % 4) * 92, y = 80 + Math.floor(i / 4) * 92, open = Math.max(0, Math.sin(t * 0.8 + i * 1.7)) ;
        g.fillStyle = '#d8d2c6'; g.beginPath(); g.ellipse(x, y, 30, 14 * open, 0, 0, 7); g.fill();
        if (open > 0.2) { g.fillStyle = '#111'; g.beginPath(); g.arc(x + Math.sin(i) * 4, y, 7, 0, 7); g.fill(); }
      }
    } },
    { id: 'static', user: '@', caption: 'it’s only me', likes: '0', comments: '0', audio: 'static', bright: 0.5, draw(t) {
      const img = g.createImageData(W / 4, H / 4);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      const c = document.createElement('canvas'); c.width = W / 4; c.height = H / 4; c.getContext('2d').putImageData(img, 0, 0);
      g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, W, H);
      if (Math.sin(t * 5) > 0.3) { g.fillStyle = '#000'; g.fillRect(40, H / 2 - 30, W - 80, 50); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = font(24, 700, 'Courier New, monospace'); g.fillText('it’s only me', W / 2, H / 2 + 4); g.textAlign = 'left'; }
    } },
  ];

  // ------------------------------------------------------------ her posts
  const MUM = {
    mum_kitchen: { id: 'mum_kitchen', user: '@mum_♥', caption: 'made you a tea x', likes: '1', comments: '0', ago: '2m', audio: 'drone', bright: 0.2, draw(t) {
      const wob = Math.sin(t * 1.3) * 3;
      g.save(); g.translate(wob, Math.cos(t * 1.1) * 2);
      g.fillStyle = '#0d0f12'; g.fillRect(-10, -10, W + 20, H + 20);
      g.fillStyle = '#16202e'; g.fillRect(60, 80, 240, 170); g.strokeStyle = '#2a2c30'; g.lineWidth = 6; g.strokeRect(60, 80, 240, 170);
      g.fillStyle = '#2b2620'; g.fillRect(-10, 380, W + 20, 300); g.fillStyle = '#3a342b'; g.fillRect(-10, 370, W + 20, 14);
      for (const x of [130, 220]) {
        g.fillStyle = '#d8d0c0'; g.fillRect(x - 24, 320, 48, 52); g.strokeStyle = '#d8d0c0'; g.lineWidth = 6; g.beginPath(); g.arc(x + 26, 344, 12, -1.2, 1.2); g.stroke();
        g.strokeStyle = 'rgba(220,220,220,.25)'; g.lineWidth = 3;
        for (let k = 0; k < 3; k++) { g.beginPath(); const y0 = 315, ph = t * 1.5 + k * 2; g.moveTo(x - 8 + k * 8, y0); g.bezierCurveTo(x - 20 + Math.sin(ph) * 10, y0 - 40, x + 20 + Math.cos(ph) * 10, y0 - 80, x + Math.sin(ph) * 15, y0 - 120); g.stroke(); }
      }
      // a hand on the counter. the fingers are too long.
      g.fillStyle = '#a69e92'; g.beginPath(); g.ellipse(300, 400, 40, 18, 0.1, 0, 7); g.fill();
      for (let k = 0; k < 4; k++) { g.save(); g.translate(270 + k * 4, 392 + k * 8); g.rotate(-1.75 + k * 0.08); g.fillRect(0, -3, 95 + (k === 1 || k === 2 ? 15 : 0), 6); g.restore(); }
      g.restore(); vhs(t, 0.4);
    } },
    mum_stairs: { id: 'mum_stairs', user: '@mum_♥', caption: 'almost there 🌙', likes: '1', comments: '0', ago: 'now', audio: 'drone', bright: 0.15, draw(t) {
      const up = Math.min(1, t / 9);
      g.fillStyle = '#08080a'; g.fillRect(0, 0, W, H);
      g.save(); g.translate(Math.sin(t * 2.2) * 3, up * 120 + Math.abs(Math.sin(t * 2.2)) * 6);
      for (let i = 0; i < 13; i++) { const k = i / 13, w = 300 - k * 220, y = 600 - k * 520; g.fillStyle = i % 2 ? '#1a1612' : '#221d17'; g.fillRect(W / 2 - w / 2, y - 40 * (1 - k), w, 40 * (1 - k) + 2); }
      g.fillStyle = '#0d0c0b'; g.fillRect(W / 2 - 40, -40, 80, 110);
      g.fillStyle = '#9fb8ff'; g.fillRect(W / 2 - 40, 68, 80, 2); // the light under your door
      g.restore(); vhs(t, 0.5);
    } },
    mum_door: { id: 'mum_door', user: '@mum_♥', caption: 'knock knock', likes: '1', comments: '0', ago: 'now', audio: 'drone', bright: 0.15, draw(t) {
      g.fillStyle = '#121310'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#2b2a24'; g.fillRect(60, 0, 240, H);
      g.fillStyle = '#5a5240'; g.save(); g.translate(250, 330); g.rotate(-Math.min(0.9, t * 0.15)); g.fillRect(-50, -8, 60, 16); g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill(); g.restore();
      g.fillStyle = '#9fb8ff'; g.fillRect(60, H - 30, 240, 3);
      vhs(t, 0.6);
    } },
    mum_live: { id: 'mum_live', user: '@mum_♥', caption: 'can’t sleep x', likes: '1', comments: '', ago: 'LIVE', audio: null, bright: 0.2, live: true, draw() { g.clearRect(0, 0, W, H); } },
  };

  // ------------------------------------------------------------ control
  function init(canvas, getFace) {
    cv = canvas; g = cv.getContext('2d'); W = cv.width; H = cv.height; faceImg = getFace;
    list = NORMAL.slice(); farStart = list.length;
    list.push(FAR[0]);
    for (let i = 1; i < 40; i++) list.push(FAR[1 + ((i - 1) % (FAR.length - 1))]);
    idx = 0; t0 = performance.now();
  }
  let t0 = 0;
  const cur = () => list[idx];
  function go(d) {
    const n = Math.max(0, Math.min(list.length - 1, idx + d));
    if (n === idx) return false;
    slideFrom = { v: list[idx], dir: d }; slideT = 0; idx = n; t0 = performance.now();
    return true;
  }
  function inject(id, jump) {
    const v = MUM[id] || FAR.find(f => f.id === id); if (!v) return;
    const at = list.indexOf(v);
    if (at > idx) list.splice(at, 1);
    if (list[idx] !== v) list.splice(idx + 1, 0, v);
    if (jump) go(1);
  }
  function draw(dt) {
    const t = (performance.now() - t0) / 1000;
    slideT = Math.min(1, slideT + dt * 4);
    const v = cur();
    if (slideT < 1 && slideFrom) {
      const e = 1 - Math.pow(1 - slideT, 3), off = (slideFrom.dir > 0 ? -1 : 1) * e * H;
      g.save(); g.translate(0, off); g.beginPath(); g.rect(0, 0, W, H); g.clip(); slideFrom.v.draw(5); g.restore();
      g.save(); g.translate(0, off + (slideFrom.dir > 0 ? H : -H)); g.beginPath(); g.rect(0, 0, W, H); g.clip(); v.live ? (g.fillStyle = '#000', g.fillRect(0, 0, W, H)) : v.draw(t); g.restore();
    } else { g.save(); v.draw(t); g.restore(); }
  }

  return {
    init, draw, inject, next: () => go(1), prev: () => go(-1),
    get current() { return cur(); }, get depth() { return idx; }, get inFarlands() { return idx >= farStart; },
    get sliding() { return slideT < 1; }, seen: id => list.slice(0, idx + 1).some(v => v.id === id),
  };
})();
