// Everything is drawn procedurally at 480x270, lit by multiplying with a
// light map, then grained and dithered. Low resolution is a feature: the
// eye fills the gaps with whatever it is most afraid of.
const Render = (() => {
  const W = 480, H = 270, WW = 600;
  const VPX = 300, VPY = 112, BX0 = 170, BX1 = 430, BY0 = 40, BY1 = 178;
  const K1 = (VPY - BY0) / (VPX - BX0), K2 = (BY1 - VPY) / (VPX - BX0);
  const ceilL = x => BY0 - (BX0 - x) * K1, floorL = x => BY1 + (BX0 - x) * K2;
  const ceilR = x => BY0 - (x - BX1) * K1, floorR = x => BY1 + (x - BX1) * K2;
  const onL = (x, f) => ceilL(x) + (floorL(x) - ceilL(x)) * f;
  const onR = (x, f) => ceilR(x) + (floorR(x) - ceilR(x)) * f;

  // landmarks in world space (x 0..600)
  const DOOR = { xn: 78, xf: 146, top: 0.22 };
  const WARD = { xf: 452, xm: 504, xn: 560, top: 0.1 };
  const MIRROR = { x0: 512, x1: 552, f0: 0.2, f1: 0.8 };
  const WIN = { x: 262, y: 62, w: 76, h: 80 };
  const SPOTS = {
    door:    { x: 76, y: 42, w: 72, h: 180 },
    chair:   { x: 178, y: 128, w: 54, h: 64 },
    drawing: { x: 192, y: 78, w: 44, h: 40 },
    window:  { x: 256, y: 56, w: 88, h: 94 },
    photo:   { x: 357, y: 75, w: 36, h: 38 },
    boxes:   { x: 376, y: 150, w: 70, h: 54 },
    wardrobe:{ x: 450, y: 40, w: 56, h: 150 },
    mirror:  { x: 508, y: 30, w: 48, h: 155 },
    bedfoot: { x: 240, y: 60, w: 120, h: 150 },
  };
  // where the visitor stands at each stage of its approach
  const STAGES = [
    null,
    { x: 99, fy: 213, h: 166, tilt: 0.42 },
    { x: 112, fy: 208, h: 168, tilt: 0.5 },
    { x: 182, fy: 230, h: 198, tilt: 0.3 },
    { x: 246, fy: 248, h: 230, tilt: -0.25 },
    { x: 300, fy: 285, h: 268, tilt: 0.18, headScale: 1.5, lean: 1 },
  ];

  let cv, g, light, lg, room, duvet, scare, sg, noiseTab, vign, bayer;
  const NT = 1 << 18;

  function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const poly = (c, pts) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); };

  function init(canvas) {
    cv = canvas; g = cv.getContext('2d', { willReadFrequently: true });
    light = mk(W, H); lg = light.getContext('2d');
    scare = mk(W, H); sg = scare.getContext('2d');
    noiseTab = new Float32Array(NT);
    for (let i = 0; i < NT; i++) noiseTab[i] = (Math.random() + Math.random() + Math.random() - 1.5);
    vign = new Float32Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = (x - W / 2) / (W / 2), dy = (y - H / 2) / (H / 2);
      vign[y * W + x] = Math.max(0, 1 - 0.42 * Math.pow(dx * dx * 0.8 + dy * dy, 1.25));
    }
    bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
    buildRoom(); buildDuvet();
  }

  // ---------------------------------------------------------------- room
  function buildRoom() {
    room = mk(WW, H); const c = room.getContext('2d'), R = mulberry(7);
    // ceiling
    let gr = c.createLinearGradient(0, -60, 0, BY0);
    gr.addColorStop(0, '#6f6b63'); gr.addColorStop(1, '#8c877d');
    c.fillStyle = gr; poly(c, [[0, -80], [WW, -80], [WW, ceilR(WW)], [BX1, BY0], [BX0, BY0], [0, ceilL(0)]]); c.fill();
    // a water stain on the ceiling, shaped a little like a face if you want it to be
    c.fillStyle = 'rgba(70,60,40,.18)'; c.beginPath(); c.ellipse(350, 12, 26, 9, 0.1, 0, 7); c.fill();
    c.fillStyle = 'rgba(60,50,35,.2)'; c.beginPath(); c.ellipse(343, 11, 3, 2, 0, 0, 7); c.ellipse(357, 12, 3, 2, 0, 0, 7); c.fill();

    // wallpaper: sage, faded stripes, tiny flowers
    const paper = (x0, x1, top, bot, stripeXs) => {
      for (const x of stripeXs) {
        if (x < x0 || x > x1) continue;
        c.fillStyle = 'rgba(40,55,40,.13)'; c.fillRect(x, top(x), 1.4, bot(x) - top(x));
      }
    };
    c.fillStyle = '#7f8b77'; c.fillRect(BX0, BY0, BX1 - BX0, BY1 - BY0);
    const back = []; for (let x = BX0 + 4; x < BX1; x += 9) back.push(x);
    paper(BX0, BX1, () => BY0, () => BY1, back);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${150 + R() * 40},${110 + R() * 30},${110 + R() * 20},.35)`; c.fillRect(BX0 + R() * (BX1 - BX0), BY0 + R() * (BY1 - BY0), 1, 1); }
    // left + right walls
    gr = c.createLinearGradient(0, 0, BX0, 0); gr.addColorStop(0, '#76826e'); gr.addColorStop(1, '#6d7966');
    c.fillStyle = gr; poly(c, [[0, ceilL(0)], [BX0, BY0], [BX0, BY1], [0, floorL(0)]]); c.fill();
    gr = c.createLinearGradient(BX1, 0, WW, 0); gr.addColorStop(0, '#6d7966'); gr.addColorStop(1, '#78846f');
    c.fillStyle = gr; poly(c, [[BX1, BY0], [WW, ceilR(WW)], [WW, floorR(WW)], [BX1, BY1]]); c.fill();
    const sx = []; for (let i = 1; i < 40; i++) sx.push(BX0 - 4.5 * Math.pow(i, 1.25));
    paper(0, BX0, ceilL, floorL, sx);
    paper(BX1, WW, ceilR, floorR, sx.map(x => 2 * VPX - x));
    for (let i = 0; i < 500; i++) {
      const left = R() < 0.5, x = left ? R() * BX0 : BX1 + R() * (WW - BX1), f = R();
      const y = left ? onL(x, f) : onR(x, f);
      c.fillStyle = `rgba(${150 + R() * 40},${110 + R() * 30},110,.3)`; c.fillRect(x, y, 1.3, 1.3);
    }
    // picture rail
    c.strokeStyle = 'rgba(40,35,30,.35)'; c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(0, onL(0, 0.12)); c.lineTo(BX0, onL(BX0, 0.12)); c.lineTo(BX1, onR(BX1, 0.12)); c.lineTo(WW, onR(WW, 0.12)); c.stroke();

    // floorboards
    c.fillStyle = '#5c4838'; poly(c, [[0, floorL(0)], [BX0, BY1], [BX1, BY1], [WW, floorR(WW)], [WW, H], [0, H]]); c.fill();
    c.strokeStyle = 'rgba(25,15,10,.45)'; c.lineWidth = 0.8;
    for (let xb = -900; xb < 1500; xb += 30) {
      const xt = VPX + (xb - VPX) * (BY1 - VPY) / (H - VPY);
      c.beginPath(); c.moveTo(xt, BY1); c.lineTo(xb, H); c.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const y = BY1 + 3 + R() * (H - BY1), xb = R() * WW;
      c.strokeStyle = 'rgba(20,12,8,.25)'; c.beginPath(); c.moveTo(xb, y); c.lineTo(xb + 6 + (y - BY1) * 0.3, y); c.stroke();
    }
    // skirting
    c.strokeStyle = '#3d3229'; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(0, floorL(0) - 3); c.lineTo(BX0, BY1 - 2); c.lineTo(BX1, BY1 - 2); c.lineTo(WW, floorR(WW) - 3); c.stroke();
    // corners
    c.strokeStyle = 'rgba(30,30,25,.35)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(BX0, BY0); c.lineTo(BX0, BY1); c.moveTo(BX1, BY0); c.lineTo(BX1, BY1); c.stroke();
    // a rag rug, half hidden by the bed
    c.fillStyle = '#6a3f3a'; c.beginPath(); c.ellipse(300, 200, 120, 18, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(200,170,140,.25)'; c.lineWidth = 1;
    for (let k = 1; k < 5; k++) { c.beginPath(); c.ellipse(300, 200, 120 - k * 18, 18 - k * 3, 0, 0, 7); c.stroke(); }

    // boxes of her things
    const box = (x, y, w, h, label) => {
      c.fillStyle = '#9b7a52'; c.fillRect(x, y, w, h);
      c.fillStyle = '#866743'; c.fillRect(x + w, y + 3, 6, h - 3); // side
      c.fillStyle = '#b08d62'; poly(c, [[x, y], [x + w, y], [x + w + 6, y + 3], [x + 6, y + 3]]); c.fill();
      c.fillStyle = 'rgba(210,190,150,.6)'; c.fillRect(x + w / 2 - 2, y, 4, h);
      c.fillStyle = '#1b1612'; c.font = 'bold 7px monospace'; c.textAlign = 'center'; c.fillText(label, x + w / 2 - 9, y + h * 0.62);
    };
    box(380, 166, 46, 34, 'KEEP'); box(392, 140, 36, 27, 'MUM');
  }

  function buildDuvet() {
    duvet = mk(680, H); const c = duvet.getContext('2d'), R = mulberry(3);
    c.save();
    const edge = x => 210 - Math.exp(-Math.pow((x - 315) / 26, 2)) * 15 - Math.exp(-Math.pow((x - 375) / 24, 2)) * 13 + Math.pow((x - 340) / 260, 2) * 8;
    c.beginPath(); c.moveTo(0, H); c.lineTo(40, 240);
    for (let x = 160; x <= 520; x += 4) c.lineTo(x, edge(x));
    c.lineTo(640, 240); c.lineTo(680, H); c.closePath();
    const gr = c.createLinearGradient(0, 200, 0, H); gr.addColorStop(0, '#c9c3b2'); gr.addColorStop(1, '#a8a291');
    c.fillStyle = gr; c.fill(); c.clip();
    // faded forget-me-nots
    for (let i = 0; i < 520; i++) {
      const x = R() * 680, y = 195 + R() * 80;
      c.fillStyle = R() < 0.7 ? 'rgba(95,115,160,.45)' : 'rgba(150,110,120,.4)';
      c.beginPath(); c.arc(x, y, 0.8 + R() * 1.3, 0, 7); c.fill();
    }
    // folds
    c.strokeStyle = 'rgba(60,55,50,.28)'; c.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const x = 120 + R() * 440; c.beginPath(); c.moveTo(x, 215 + R() * 10);
      c.quadraticCurveTo(x + (R() - 0.5) * 60, 240, x + (R() - 0.5) * 100, H); c.stroke();
    }
    // shadow between the feet
    c.fillStyle = 'rgba(40,35,35,.35)'; c.beginPath(); c.ellipse(345, 214, 12, 5, 0, 0, 7); c.fill();
    c.restore();
    // the bed's sides falling away into the dark
    c.fillStyle = 'rgba(20,15,12,.85)';
    poly(c, [[40, 240], [160, edge(160)], [150, edge(160) + 8], [30, 252], [0, H]]); c.fill();
    poly(c, [[640, 240], [520, edge(520)], [530, edge(520) + 8], [650, 252], [680, H]]); c.fill();
  }

  // ---------------------------------------------------------------- pieces
  function drawWindow(c, t, S) {
    const { x, y, w, h } = WIN;
    let gr = c.createLinearGradient(0, y, 0, y + h);
    if (S.day) { gr.addColorStop(0, '#c9d2d6'); gr.addColorStop(1, '#e9e3d4'); }
    else { gr.addColorStop(0, '#0d1424'); gr.addColorStop(0.7, '#1b2538'); gr.addColorStop(1, '#3a3330'); }
    c.fillStyle = gr; c.fillRect(x, y, w, h);
    if (!S.day) {
      // the moon behind cloud
      const mg = c.createRadialGradient(x + w * 0.72, y + 18, 1, x + w * 0.72, y + 18, 26);
      mg.addColorStop(0, 'rgba(220,225,240,.85)'); mg.addColorStop(0.25, 'rgba(150,165,200,.35)'); mg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = mg; c.fillRect(x, y, w, h);
      // a house across the road, one window lit (until it isn't)
      c.fillStyle = '#0a0d14'; poly(c, [[x, y + h], [x, y + 55], [x + 20, y + 42], [x + 42, y + 55], [x + 42, y + h]]); c.fill();
      if (!S.neighbourOff) { c.fillStyle = '#d9a95a'; c.fillRect(x + 26, y + 60, 5, 6); }
      // rain on the glass
      c.strokeStyle = 'rgba(170,185,210,.22)'; c.lineWidth = 0.6;
      for (let i = 0; i < 26; i++) {
        const rx = x + ((i * 37.7 + t * 11) % w), ry = y + ((i * 53.3 + t * (45 + i % 5 * 9)) % h);
        c.beginPath(); c.moveTo(rx, ry); c.lineTo(rx - 0.6, ry + 4); c.stroke();
      }
      if (S.windowFace > 0) windowFace(c, x + w * 0.45, y + h * 0.55, S.windowFace);
    }
    // frame and cross bars
    c.strokeStyle = '#d6cfbf'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
    c.lineWidth = 2; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h * 0.48); c.lineTo(x + w, y + h * 0.48); c.stroke();
    c.fillStyle = '#cfc7b6'; c.fillRect(x - 6, y + h, w + 12, 4);
    // curtains
    const sway = Math.sin(t * 0.7) * 1.5 + (S.curtainPull || 0);
    for (const side of [-1, 1]) {
      const cx0 = side < 0 ? x - 16 : x + w - 6, cw = 22;
      c.fillStyle = '#8a5f63';
      c.beginPath(); c.moveTo(cx0, y - 8); c.lineTo(cx0 + cw, y - 8);
      c.quadraticCurveTo(cx0 + cw + sway * side * 0.5, y + h * 0.6, cx0 + cw + sway, y + h + 10);
      c.lineTo(cx0 + sway * 0.3, y + h + 12); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(40,20,25,.35)'; c.lineWidth = 1.5;
      for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(cx0 + k * 5.5, y - 6); c.lineTo(cx0 + k * 5.5 + sway * 0.6, y + h + 10); c.stroke(); }
    }
    c.fillStyle = '#3b2c22'; c.fillRect(x - 22, y - 10, w + 44, 3);
  }

  function windowFace(c, cx, cy, a) {
    c.save(); c.globalAlpha = Math.min(1, a);
    // hair first, a dark frame
    c.fillStyle = '#07080b'; c.beginPath(); c.ellipse(cx, cy - 2, 13, 19, 0, 0, 7); c.fill();
    c.fillRect(cx - 12, cy, 24, 22);
    const gr = c.createRadialGradient(cx - 1, cy + 2, 1, cx, cy, 12);
    gr.addColorStop(0, '#a8a196'); gr.addColorStop(0.7, '#6c665d'); gr.addColorStop(1, 'rgba(40,38,35,0)');
    c.fillStyle = gr; c.beginPath(); c.ellipse(cx, cy + 1, 7.5, 11, 0, 0, 7); c.fill();
    c.fillStyle = '#050505';
    c.beginPath(); c.ellipse(cx - 2.8, cy - 1.5, 1.6, 1.4, 0, 0, 7); c.ellipse(cx + 2.8, cy - 1.5, 1.6, 1.4, 0, 0, 7); c.fill();
    c.fillStyle = '#e8e2d2'; c.fillRect(cx - 2.9, cy - 1.7, 0.8, 0.8); c.fillRect(cx + 2.7, cy - 1.7, 0.8, 0.8);
    c.fillStyle = '#1a1212'; c.fillRect(cx - 2, cy + 6, 4, 1.4);
    // fingertips flat against the glass, spread
    c.strokeStyle = '#8b847a'; c.lineWidth = 1.3; c.lineCap = 'round';
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const bx = cx + s * (12 + k * 2.2), by = cy + 4;
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + s * (k - 1.5) * 1.2, by - 9 - (k === 1 || k === 2 ? 2 : 0)); c.stroke();
    }
    c.restore();
  }

  function drawDrawing(c, v) {
    const x = 195, y = 82;
    c.save(); c.translate(x + 19, y + 16); c.rotate(-0.04); c.translate(-19, -16);
    c.fillStyle = '#e4dccb'; c.fillRect(0, 0, 38, 32);
    c.fillStyle = 'rgba(200,190,170,.9)'; c.fillRect(15, -2, 8, 3);
    c.lineWidth = 1; c.lineCap = 'round';
    // sun
    c.strokeStyle = '#d8a227'; c.beginPath(); c.arc(32, 5, 2.5, 0, 7); c.stroke();
    // MUM, tall, and ME, small, holding hands
    const stick = (sx, sy, h, col) => {
      c.strokeStyle = col; c.beginPath(); c.arc(sx, sy, h * 0.16, 0, 7);
      c.moveTo(sx, sy + h * 0.16); c.lineTo(sx, sy + h * 0.6); c.lineTo(sx - h * 0.18, sy + h * 0.95);
      c.moveTo(sx, sy + h * 0.6); c.lineTo(sx + h * 0.18, sy + h * 0.95);
      c.moveTo(sx - h * 0.25, sy + h * 0.35); c.lineTo(sx + h * 0.25, sy + h * 0.35); c.stroke();
    };
    stick(10, 8, 17, '#b03a4a'); stick(19, 14, 11, '#2f5fa8');
    c.strokeStyle = '#b03a4a'; c.beginPath(); c.moveTo(14, 13); c.quadraticCurveTo(15, 11, 16, 13); c.stroke(); // heart
    if (v) {
      // a third one. black crayon, pressed hard. it is taller than the paper wants.
      c.strokeStyle = '#111'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(31, 6, 2.4, 0, 7); c.fill();
      c.moveTo(31, 8); c.lineTo(31, 26); c.lineTo(28, 31); c.moveTo(31, 26); c.lineTo(34, 31);
      c.moveTo(31, 12); c.lineTo(25, 24); c.moveTo(31, 12); c.lineTo(37, 24); c.stroke();
      for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(29 + k * 0.8, 4); c.lineTo(28 + k * 0.9, 13); c.stroke(); }
    }
    // the line she wrote along the bottom
    c.fillStyle = '#5a4a40'; for (let k = 0; k < 15; k++) c.fillRect(3 + k * 2.2, 28.5, 1.4, 0.8);
    c.restore();
  }

  function drawPhoto(c, v) {
    const x = 360, y = 78;
    c.fillStyle = '#2b1d15'; c.fillRect(x, y, 30, 32);
    c.fillStyle = '#8c7c68'; c.fillRect(x + 3, y + 3, 24, 26);
    c.fillStyle = '#5b4a3c'; c.fillRect(x + 3, y + 22, 24, 7);
    // her: dark hair, pale face, a birthday hat
    c.fillStyle = '#2a1e18'; c.beginPath(); c.ellipse(x + 15, y + 15, 7, 9, 0, 0, 7); c.fill();
    c.fillRect(x + 8, y + 15, 14, 10);
    if (!v) {
      c.fillStyle = '#d6bfa6'; c.beginPath(); c.ellipse(x + 15, y + 15, 4.5, 6, 0, 0, 7); c.fill();
      c.fillStyle = '#3a2a20'; c.fillRect(x + 13, y + 13, 1, 1); c.fillRect(x + 16, y + 13, 1, 1);
      c.fillStyle = '#9a4a48'; c.fillRect(x + 13.5, y + 17.5, 3, 1);
    }
    c.fillStyle = '#c94b6a'; poly(c, [[x + 12, y + 7], [x + 18, y + 7], [x + 15, y]]); c.fill();
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(x + 3, y + 3, 24, 8);
  }

  function drawChair(c, v, t) {
    const x = 186;
    c.strokeStyle = '#3a291e'; c.lineWidth = 2.2; c.lineCap = 'butt';
    c.beginPath(); c.moveTo(x + 2, 186); c.lineTo(x + 2, 166); c.moveTo(x + 34, 186); c.lineTo(x + 34, 166);
    c.moveTo(x + 8, 180); c.lineTo(x + 8, 163); c.moveTo(x + 30, 180); c.lineTo(x + 30, 163); c.stroke();
    c.fillStyle = '#4a3527'; c.fillRect(x, 163, 37, 4);
    c.fillRect(x + 5, 128, 3, 36); c.fillRect(x + 29, 128, 3, 36); c.fillRect(x + 5, 128, 27, 3); c.fillRect(x + 5, 140, 27, 2);
    // her cardigan
    c.fillStyle = '#7a6177';
    if (!v) {
      c.beginPath(); c.moveTo(x + 3, 128); c.quadraticCurveTo(x + 18, 122, x + 34, 128);
      c.lineTo(x + 36, 152); c.quadraticCurveTo(x + 20, 158, x + 2, 150); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + 32, 135); c.quadraticCurveTo(x + 42, 150, x + 39, 176); c.lineTo(x + 34, 176); c.quadraticCurveTo(x + 36, 152, x + 28, 140); c.fill();
    } else {
      // it is sitting the way a person sits
      c.beginPath(); c.moveTo(x + 4, 140); c.quadraticCurveTo(x + 4, 120, x + 12, 118);
      c.quadraticCurveTo(x + 19, 104 + Math.sin(t * 0.6) * 0.4, x + 26, 118); c.quadraticCurveTo(x + 34, 121, x + 34, 140);
      c.lineTo(x + 36, 165); c.quadraticCurveTo(x + 20, 168, x + 2, 165); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x + 6, 132); c.quadraticCurveTo(x - 2, 150, x + 4, 172); c.lineTo(x + 8, 172); c.quadraticCurveTo(x + 6, 150, x + 10, 135); c.fill();
      c.beginPath(); c.moveTo(x + 32, 132); c.quadraticCurveTo(x + 40, 150, x + 34, 172); c.lineTo(x + 30, 172); c.quadraticCurveTo(x + 32, 150, x + 28, 135); c.fill();
    }
    c.fillStyle = 'rgba(30,20,30,.35)'; for (let k = 0; k < 5; k++) c.fillRect(x + 18, 132 + k * 5, 1.2, 1.2);
  }

  function drawDoor(c, f, S) {
    const { xn, xf, top } = DOOR;
    const p = [[xn, onL(xn, top)], [xf, onL(xf, top)], [xf, floorL(xf)], [xn, floorL(xn)]];
    // frame
    c.strokeStyle = '#cbc4b2'; c.lineWidth = 3.5; poly(c, p); c.stroke();
    // the hall beyond: there should be a light on out there
    c.fillStyle = S.hallLight ? '#6b5a3e' : '#040405'; poly(c, p); c.fill();
    if (S.figStage === 1 || S.figStage === 2) {
      const st = STAGES[S.figStage];
      c.save(); poly(c, p); c.clip();
      figure(c, st.x, st.fy, st.h, { tilt: st.tilt, face: S.figFace, eyes: S.eyes, t: S.t });
      c.restore();
    }
    // door panel, swung open by f
    const xg = xn + (xf - xn) * Math.min(1, f);
    if (f < 0.98) {
      c.fillStyle = '#bdb6a3';
      poly(c, [[xg, onL(xg, top)], [xf, onL(xf, top)], [xf, floorL(xf)], [xg, floorL(xg)]]); c.fill();
      c.strokeStyle = 'rgba(60,55,45,.4)'; c.lineWidth = 1;
      const a = xg + (xf - xg) * 0.18, b = xg + (xf - xg) * 0.82;
      poly(c, [[a, onL(a, top + 0.08)], [b, onL(b, top + 0.08)], [b, onL(b, 0.55)], [a, onL(a, 0.55)]]); c.stroke();
      poly(c, [[a, onL(a, 0.62)], [b, onL(b, 0.62)], [b, onL(b, 0.94)], [a, onL(a, 0.94)]]); c.stroke();
      c.fillStyle = '#8a7b55'; c.fillRect(xg + 3, onL(xg + 3, 0.6), 2, 2);
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(xg, onL(xg, top), 1.5, floorL(xg) - onL(xg, top));
    }
    // four long fingers curled round the edge of the door
    if (S.doorFingers > 0) {
      const fx = xg + 1, fy = onL(xg, 0.47);
      c.fillStyle = '#a49b8d';
      for (let k = 0; k < 4; k++) {
        const len = 6 + S.doorFingers * 4 + (k === 1 || k === 2 ? 2 : 0);
        c.fillRect(fx, fy + k * 4.2, len, 2.2);
        c.fillStyle = '#6d655b'; c.fillRect(fx + len - 1.5, fy + k * 4.2, 1.5, 2.2); c.fillStyle = '#a49b8d';
      }
    }
  }

  function drawWardrobe(c, f, S, t) {
    const { xf, xm, xn, top } = WARD;
    const quad = (a, b, f0, f1) => [[a, onR(a, f0)], [b, onR(b, f0)], [b, onR(b, f1)], [a, onR(a, f1)]];
    c.fillStyle = '#3f2c20'; poly(c, quad(xf - 4, xn + 6, top - 0.03, 1)); c.fill();
    c.fillStyle = '#2b1e16'; poly(c, [[xf - 4, onR(xf - 4, top - 0.03)], [xf - 12, onR(xf - 4, top - 0.03) + 4], [xf - 12, floorR(xf - 4) - 2], [xf - 4, floorR(xf - 4)]]); c.fill();
    // far door: opens a crack
    const gapX = xf + (xm - xf) * f * 0.7;
    c.fillStyle = '#4c3627'; poly(c, quad(gapX, xm - 1, top, 0.97)); c.fill();
    if (f > 0.01) {
      c.fillStyle = '#030303'; poly(c, quad(xf, gapX, top, 0.97)); c.fill();
      if (S.wardEyes && f > 0.3) {
        c.fillStyle = 'rgba(220,210,190,.9)';
        const ey = onR(xf + 6, 0.32);
        c.fillRect(xf + 4, ey, 1.4, 1); c.fillRect(xf + 8, ey + 0.6, 1.4, 1);
      }
    }
    // near door with the mirror
    c.fillStyle = '#4f392a'; poly(c, quad(xm + 1, xn, top, 0.97)); c.fill();
    c.fillStyle = '#9c8a5c'; c.fillRect(xm + 2, onR(xm + 2, 0.55), 1.5, 3); c.fillRect(xm - 4, onR(xm - 4, 0.55), 1.5, 3);
    // mirror: dark glass. it shows the bed, and you in it.
    const { x0, x1, f0, f1 } = MIRROR, mq = quad(x0, x1, f0, f1);
    c.save(); poly(c, mq); c.clip();
    const gr = c.createLinearGradient(x0, 0, x1, 0); gr.addColorStop(0, '#2b3038'); gr.addColorStop(1, '#3c424c');
    c.fillStyle = gr; c.fillRect(x0 - 2, 0, x1 - x0 + 4, H);
    const my0 = onR(x0, f0), my1 = onR(x0, f1);
    // reflected doorway, dark, on the far side of the mirror world
    c.fillStyle = '#15171b'; c.fillRect(x0 + 24, my0 + 30, 10, 70);
    if (S.mirrorFig === 1) figure(c, x0 + 17, my1 + 6, 74, { tilt: -0.5, face: 1, eyes: 1, t });
    if (S.mirrorFig === 2) figure(c, x0 + 9, my1 + 30, 140, { tilt: 0.25, face: 1, eyes: 1, t, headScale: 1.1 });
    // the bed, and the shape of you in it
    c.fillStyle = '#7d786c'; c.beginPath(); c.ellipse(x0 + 20, my1 + 2, 26, 14, -0.1, 0, 7); c.fill();
    c.fillStyle = '#6a6559'; c.beginPath(); c.ellipse(x0 + 30, my1 - 8, 8, 6, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.07)'; poly(c, [[x0 + 4, my0], [x0 + 12, my0], [x0 + 2, my1], [x0 - 6, my1]]); c.fill();
    c.restore();
    c.strokeStyle = '#7d6a48'; c.lineWidth = 1.5; poly(c, mq); c.stroke();
    c.fillStyle = '#5a4130'; poly(c, quad(xf - 6, xn + 8, top - 0.05, top - 0.02)); c.fill();
  }

  // ---------------------------------------------------------------- the visitor
  // Her nightdress. Too tall, too thin, arms that go on past where arms stop.
  // Hair hangs over most of the face: you get one eye and a slack mouth,
  // and your mind does the rest. Returns where its eyes are, for eyeshine.
  function figure(c, x, fy, h, o = {}) {
    const tilt = o.tilt || 0, lean = o.lean || 0, t = o.t || 0, reach = o.reach || 0;
    const sh = fy - h * 0.8 + lean * h * 0.05, hw = h * 0.068;
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    // hair down the back, behind everything
    const hx = x + Math.sin(tilt) * h * 0.05, hy = sh - h * 0.085 + lean * h * 0.09;
    c.fillStyle = '#0c0a0a';
    c.beginPath(); c.moveTo(hx - h * 0.04, hy - h * 0.03); c.quadraticCurveTo(x - hw * 1.5, sh + h * 0.1, x - hw * 0.9, sh + h * 0.3);
    c.lineTo(x + hw * 0.9, sh + h * 0.3); c.quadraticCurveTo(x + hw * 1.5, sh + h * 0.1, hx + h * 0.04, hy - h * 0.03); c.fill();
    // nightdress, grey with age
    c.fillStyle = '#6c675d';
    c.beginPath(); c.moveTo(x - hw, sh + h * 0.012);
    c.bezierCurveTo(x - hw * 0.8, sh + h * 0.25, x - hw * 1.45, fy - h * 0.22, x - hw * 1.7, fy + 4);
    c.lineTo(x + hw * 1.55, fy + 4);
    c.bezierCurveTo(x + hw * 1.35, fy - h * 0.22, x + hw * 0.8, sh + h * 0.25, x + hw, sh - h * 0.012);
    c.quadraticCurveTo(x, sh - h * 0.03, x - hw, sh + h * 0.012); c.fill();
    c.strokeStyle = 'rgba(25,22,20,.5)'; c.lineWidth = Math.max(1, h * 0.012);
    for (const k of [-0.7, -0.15, 0.45]) { c.beginPath(); c.moveTo(x + k * hw * 0.5, sh + h * 0.18); c.quadraticCurveTo(x + k * hw * 0.9, fy - h * 0.3, x + k * hw * 1.6, fy); c.stroke(); }
    c.fillStyle = 'rgba(20,16,14,.55)'; c.beginPath(); c.ellipse(x - hw * 0.2, sh + h * 0.08, hw * 0.6, h * 0.05, 0, 0, 7); c.fill();
    // arms: bare, long, hanging past the knee, hands slightly open
    for (const s of [-1, 1]) {
      const ax = x + s * hw * 0.95, ay = sh + (s < 0 ? 1 : -1) * h * 0.012;
      const ex = x + s * hw * 1.45, ey = sh + h * 0.27, wx = x + s * (hw * 1.3 + reach), wy = sh + h * 0.55;
      c.strokeStyle = '#857e72'; c.lineWidth = Math.max(1.3, h * 0.02);
      c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(ex, ey - h * 0.05, ex, ey); c.quadraticCurveTo(ex, ey + h * 0.12, wx, wy); c.stroke();
      c.strokeStyle = '#47423b'; c.lineWidth = Math.max(0.6, h * 0.006);
      c.beginPath(); c.moveTo(ex - s * h * 0.006, ey - h * 0.02); c.lineTo(ex - s * h * 0.004, ey + h * 0.02); c.stroke();
      c.strokeStyle = '#8f887b'; c.lineWidth = Math.max(0.7, h * 0.0075);
      for (let k = 0; k < 4; k++) {
        const fx = wx + (k - 1.5) * h * 0.005, len = h * (0.055 + (k === 1 || k === 2 ? 0.015 : 0));
        c.beginPath(); c.moveTo(fx, wy); c.quadraticCurveTo(fx + s * h * 0.006, wy + len * 0.6, fx + s * h * 0.002 + Math.sin(t * 0.9 + k) * 0.3, wy + len); c.stroke();
      }
    }
    // neck, a little too long
    c.strokeStyle = '#7a7368'; c.lineWidth = h * 0.02;
    c.beginPath(); c.moveTo(x, sh + 1); c.quadraticCurveTo(x, hy + h * 0.04, hx, hy + h * 0.02); c.stroke();
    // head
    const hs = o.headScale || 1, rx = h * 0.036 * hs, ry = h * 0.05 * hs;
    c.translate(hx, hy); c.rotate(tilt);
    c.fillStyle = '#0c0a0a'; c.beginPath(); c.ellipse(0, -ry * 0.15, rx * 1.3, ry * 1.15, 0, 0, 7); c.fill();
    const face = o.face == null ? 1 : o.face;
    if (face > 0) {
      c.globalAlpha = face;
      const fg = c.createRadialGradient(-rx * 0.2, ry * 0.1, 0, 0, 0, ry * 1.05);
      fg.addColorStop(0, '#a9a194'); fg.addColorStop(0.6, '#7c7468'); fg.addColorStop(1, '#2a2622');
      c.fillStyle = fg; c.beginPath(); c.ellipse(0, ry * 0.08, rx * 0.82, ry * 0.95, 0, 0, 7); c.fill();
      // one eye: a socket, deep
      c.fillStyle = '#0a0808'; c.beginPath(); c.ellipse(-rx * 0.36, -ry * 0.1, rx * 0.25, ry * 0.15, -0.15, 0, 7); c.fill();
      // mouth: open, slack, as if it forgot it was holding it shut
      c.beginPath(); c.ellipse(-rx * 0.05, ry * 0.55 + (o.mouth ? ry * 0.1 : 0), rx * 0.17, ry * (o.mouth ? 0.32 : 0.18), 0, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
    // the hair that falls in front: most of the face is behind it
    c.fillStyle = '#0c0a0a';
    c.beginPath(); c.moveTo(-rx * 0.15, -ry * 1.1);
    c.quadraticCurveTo(rx * 1.1, -ry * 0.9, rx * 1.25, ry * 0.2);
    c.quadraticCurveTo(rx * 1.3, ry * (1.6 + lean * 1.2), rx * 0.9, ry * (2.6 + lean * 1.5));
    c.lineTo(rx * 0.05, ry * (2.3 + lean * 1.5));
    c.quadraticCurveTo(rx * 0.15, ry * 0.6, -rx * 0.12, -ry * 0.35);
    c.quadraticCurveTo(-rx * 0.2, -ry * 0.8, -rx * 0.15, -ry * 1.1); c.fill();
    c.beginPath(); c.moveTo(-rx * 0.3, -ry * 1.05); c.quadraticCurveTo(-rx * 1.3, -ry * 0.6, -rx * 1.15, ry * 0.5);
    c.quadraticCurveTo(-rx * 1.2, ry * 1.7, -rx * 0.95, ry * 2.4); c.lineTo(-rx * 0.7, ry * 2.2);
    c.quadraticCurveTo(-rx * 0.75, ry * 0.6, -rx * 0.62, ry * 0.1); c.quadraticCurveTo(-rx * 0.5, -ry * 0.6, -rx * 0.3, -ry * 1.05); c.fill();
    c.strokeStyle = 'rgba(12,10,10,.85)'; c.lineWidth = Math.max(0.6, rx * 0.08);
    for (let k = 0; k < 4; k++) {
      const sx = -rx * (0.1 + k * 0.12);
      c.beginPath(); c.moveTo(sx, -ry * 0.9); c.quadraticCurveTo(sx - rx * 0.05, ry * 0.5, sx + Math.sin(t * 0.7 + k) * rx * 0.05, ry * (1.4 + k * 0.2)); c.stroke();
    }
    c.restore();
    return eyesOf(x, fy, h, tilt, o.headScale || 1, lean);
  }
  function eyesOf(x, fy, h, tilt, scale, lean = 0) {
    const sh = fy - h * 0.8 + lean * h * 0.05, nx = x + Math.sin(tilt) * h * 0.05, ny = sh - h * 0.085 + lean * h * 0.09;
    const rx = h * scale * 0.036, ry = h * scale * 0.05, ca = Math.cos(tilt), sa = Math.sin(tilt);
    return [[-0.36, -0.1], [0.36, -0.1]].map(([u, v]) => [nx + u * rx * ca - v * ry * sa, ny + u * rx * sa + v * ry * ca]);
  }

  // ---------------------------------------------------------------- faces
  // The face you are not allowed to look at for long. Lit from below by a
  // phone screen. Eyes wide open, mouth open further than a jaw allows.
  function face(c, cx, cy, s, o = {}) {
    const t = o.t || 0, rx = s * 0.3, ry = s * 0.46, mo = o.mouth == null ? 1 : o.mouth;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.save(); c.lineCap = 'round';
    // hair mass behind
    c.fillStyle = '#0a0808'; c.beginPath(); c.ellipse(cx, cy - ry * 0.15, rx * 1.55, ry * 1.15, 0, 0, 7); c.fill();
    // skin, under-lit: bright jaw, dark brow
    const sk = c.createLinearGradient(0, cy + ry, 0, cy - ry);
    sk.addColorStop(0, o.cold ? '#c4ced8' : '#d4c9b6'); sk.addColorStop(0.35, o.cold ? '#8d96a0' : '#9a8f80');
    sk.addColorStop(0.7, '#3c3a3a'); sk.addColorStop(1, '#0d0c0c');
    c.fillStyle = sk;
    c.beginPath(); c.ellipse(cx, cy - ry * 0.05, rx, ry * 0.9, 0, 0, 7); c.fill();
    // jaw, stretched long and slightly off-centre
    c.beginPath(); c.ellipse(cx + rx * 0.04, cy + ry * 0.42, rx * 0.72, ry * (0.5 + mo * 0.1), 0.04, 0, 7); c.fill();
    // hollows under the cheekbones
    for (const sd of [-1, 1]) {
      const hg = c.createRadialGradient(cx + sd * rx * 0.62, cy + ry * 0.28, 0, cx + sd * rx * 0.62, cy + ry * 0.28, rx * 0.4);
      hg.addColorStop(0, 'rgba(10,10,12,.7)'); hg.addColorStop(1, 'rgba(10,10,12,0)');
      c.fillStyle = hg; c.fillRect(0, 0, W, H);
    }
    const R = mulberry(11);
    for (let i = 0; i < 60; i++) {
      c.fillStyle = `rgba(30,25,28,${0.04 + R() * 0.1})`;
      c.beginPath(); c.ellipse(cx + (R() - 0.5) * rx * 1.6, cy + (R() - 0.5) * ry * 1.6, R() * s * 0.04, R() * s * 0.03, R() * 3, 0, 7); c.fill();
    }
    // eyes: wide, too much white, pupils pinned on you. one of them a little wrong.
    for (const sd of [-1, 1]) {
      const ex = cx + sd * rx * 0.4, ey = cy - ry * 0.2;
      const so = c.createRadialGradient(ex, ey, 0, ex, ey, rx * 0.4);
      so.addColorStop(0, 'rgba(5,4,4,.95)'); so.addColorStop(0.7, 'rgba(10,8,8,.6)'); so.addColorStop(1, 'rgba(10,8,8,0)');
      c.fillStyle = so; c.beginPath(); c.ellipse(ex, ey, rx * 0.4, ry * 0.2, 0, 0, 7); c.fill();
      c.fillStyle = '#cfc8b6'; c.beginPath(); c.ellipse(ex, ey + ry * 0.01, rx * 0.2, ry * 0.075, sd * 0.06, 0, 7); c.fill();
      c.strokeStyle = 'rgba(120,40,40,.7)'; c.lineWidth = Math.max(1, s * 0.004); c.stroke();
      const ix = ex + (sd > 0 ? rx * 0.035 : -rx * 0.01), iy = ey + ry * 0.012;
      c.fillStyle = '#070505'; c.beginPath(); c.arc(ix, iy, ry * 0.04, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.fillRect(ix - 1, iy - ry * 0.025, 1.5, 1.5);
    }
    // nostrils, lit from beneath
    c.fillStyle = '#120d0d';
    c.beginPath(); c.ellipse(cx - rx * 0.1, cy + ry * 0.1, rx * 0.05, ry * 0.025, 0.4, 0, 7); c.ellipse(cx + rx * 0.1, cy + ry * 0.1, rx * 0.05, ry * 0.025, -0.4, 0, 7); c.fill();
    // the mouth
    const my = cy + ry * (0.42 + mo * 0.06), mh = ry * (0.12 + mo * 0.24), mw = rx * (0.28 + mo * 0.05);
    c.fillStyle = '#5a4848'; c.beginPath(); c.ellipse(cx + rx * 0.03, my, mw * 1.15, mh * 1.1, 0.05, 0, 7); c.fill();
    c.fillStyle = '#030202'; c.beginPath(); c.ellipse(cx + rx * 0.03, my, mw, mh, 0.05, 0, 7); c.fill();
    c.fillStyle = '#a69d88';
    for (let k = -3; k <= 3; k++) {
      const tx = cx + rx * 0.03 + k * mw * 0.24, th = mh * (0.16 + R() * 0.1);
      c.fillRect(tx - mw * 0.08, my - mh * 0.97, mw * 0.16, th);
      if (Math.abs(k) < 3) c.fillRect(tx - mw * 0.07, my + mh * 0.97 - th * 0.8, mw * 0.14, th * 0.8);
    }
    // wet hair across the forehead and down over one cheek
    c.strokeStyle = '#090707';
    for (let k = 0; k < 26; k++) {
      const sd = k % 3 === 0 ? 1 : -1, sx = cx + sd * rx * (0.15 + (k % 7) * 0.12);
      c.lineWidth = s * (0.006 + (k % 4) * 0.004);
      c.beginPath(); c.moveTo(sx, cy - ry * 0.95);
      c.quadraticCurveTo(sx + sd * rx * 0.25, cy - ry * 0.2, sx + sd * rx * (0.35 + (k % 5) * 0.12) + Math.sin(t * 4 + k) * 2, cy + ry * (0.5 + (k % 4) * 0.2)); c.stroke();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- blanket
  function blanket(c, S, t) {
    c.fillStyle = '#040506'; c.fillRect(0, 0, W, H);
    const br = Math.sin(t * (S.breathRate || 1.2) * 2) * 2.5;
    const dome = c.createRadialGradient(240, 80 + br, 10, 240, 130, 300);
    dome.addColorStop(0, '#1e2129'); dome.addColorStop(0.55, '#111319'); dome.addColorStop(1, '#030304');
    c.fillStyle = dome; c.fillRect(0, 0, W, H);
    // soft folds: wide faint strokes stacked
    const fold = (x0, y0, cx1, cy1, x1, y1, col) => {
      for (const [w, a] of [[22, 0.035], [12, 0.045], [5, 0.05]]) {
        c.strokeStyle = `rgba(${col},${a})`; c.lineWidth = w;
        c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx1, cy1, x1, y1); c.stroke();
      }
    };
    const pull = S.sink * 40;
    fold(30, -10, 130 + br, 120, 170 + pull, 275, '90,96,115');
    fold(150, -20, 190, 100 + br, 215 + pull * 0.5, 275, '0,0,0');
    fold(340, -10, 300 - br, 130, 280 - pull * 0.5, 275, '90,96,115');
    fold(460, 10, 380, 150, 320 - pull, 275, '0,0,0');
    fold(-20, 120, 120, 170 + br, 160, 275, '0,0,0');
    fold(500, 110, 370, 200, 330, 275, '90,96,115');
    const R = mulberry(5);
    for (let i = 0; i < 110; i++) { c.fillStyle = 'rgba(70,85,120,.13)'; c.beginPath(); c.arc(R() * W, R() * H * 0.9 + br, 1.2 + R(), 0, 7); c.fill(); }
    // the gap at the bottom, where the room is
    const gw = 150 * (1 - S.sink * 0.5), gh = 12 * (1 - S.sink * 0.5) + S.gapLift * 34;
    c.fillStyle = '#0f121a'; c.beginPath(); c.ellipse(232, 274, gw, gh, 0, Math.PI, 0); c.fill();
    if (S.fingers > 0) {
      // a hand coming in under the edge. long fingers, feeling for you.
      c.fillStyle = '#2e2b27'; c.beginPath(); c.ellipse(215, 284, 42 * Math.min(1, S.fingers * 1.5), 16, -0.05, 0, 7); c.fill();
      const base = [[196, 0.85, -0.32], [212, 1.05, -0.12], [229, 1.0, 0.05], [245, 0.8, 0.22], [178, 0.45, -0.75]];
      base.forEach(([bx, lenK, ang], k) => {
        const len = S.fingers * 68 * lenK, wob = Math.sin(t * 3 + k) * 1.5;
        const tipx = bx + Math.sin(ang) * len + wob, tipy = 276 - Math.cos(ang) * len;
        const midx = bx + Math.sin(ang * 0.6) * len * 0.55, midy = 276 - Math.cos(ang * 0.6) * len * 0.55;
        c.strokeStyle = '#1d1b19'; c.lineWidth = 8; c.beginPath(); c.moveTo(bx, 278); c.quadraticCurveTo(midx, midy, tipx, tipy); c.stroke();
        c.strokeStyle = '#47433d'; c.lineWidth = 5.5; c.beginPath(); c.moveTo(bx, 278); c.quadraticCurveTo(midx, midy, tipx, tipy); c.stroke();
        c.strokeStyle = 'rgba(110,104,95,.55)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(bx - 1.5, 278); c.quadraticCurveTo(midx - 1.5, midy, tipx - 1, tipy + 2); c.stroke();
        // knuckle creases and a long nail
        c.strokeStyle = 'rgba(20,18,16,.6)'; c.lineWidth = 1;
        for (const f of [0.68]) {
          const px = bx + (tipx - bx) * f, py = 278 + (tipy - 278) * f;
          c.beginPath(); c.moveTo(px - 3, py + 0.5); c.lineTo(px + 3, py - 0.5); c.stroke();
        }
        c.fillStyle = '#5e574c'; c.beginPath(); c.ellipse(tipx, tipy + 1.5, 2, 3, ang, 0, 7); c.fill();
      });
    }
    if (S.phoneGlow > 0) {
      const pg = c.createRadialGradient(400, 250, 2, 400, 250, 260);
      pg.addColorStop(0, `rgba(150,185,255,${0.75 * S.phoneGlow})`); pg.addColorStop(0.4, `rgba(80,110,190,${0.25 * S.phoneGlow})`); pg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalCompositeOperation = 'lighter'; c.fillStyle = pg; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
      c.fillStyle = `rgba(200,220,255,${S.phoneGlow})`; c.fillRect(392, 236, 22, 34);
    }
  }

  // ---------------------------------------------------------------- frame
  let lastEyes = null;
  function frame(S) {
    const t = S.t;
    if (S.scare) return drawScare(S);
    if (S.view === 'black') { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return post(S); }
    if (S.view === 'blanket') { blanket(g, S, t); return post(S); }

    const ox = S.camX; // 0..120
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(room, -ox, 0);
    g.setTransform(1, 0, 0, 1, -ox, 0);
    drawWindow(g, t, S);
    drawDrawing(g, S.drawingV);
    drawPhoto(g, S.photoV);
    drawDoor(g, S.door, S);
    drawWardrobe(g, S.ward, S, t);
    drawChair(g, S.chairV, t);
    lastEyes = null;
    if (S.figStage >= 3) {
      const st = STAGES[S.figStage];
      lastEyes = figure(g, st.x + (S.figJitter || 0), st.fy, st.h, { tilt: st.tilt, face: S.figFace, t, headScale: st.headScale, lean: st.lean, mouth: S.figMouth || st.lean, reach: S.figStage === 5 ? 8 : 0 });
    } else if (S.figStage === 1 || S.figStage === 2) {
      const st = STAGES[S.figStage];
      lastEyes = eyesOf(st.x, st.fy, st.h, st.tilt, 1);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    // the bed, closest to you, moves a little more
    g.drawImage(duvet, -100 - (ox - 60) * 1.25, S.bedShift || 0);

    // ---- light
    lg.globalCompositeOperation = 'source-over';
    const amb = S.day ? `rgb(${190 * S.dayLight | 0},${178 * S.dayLight | 0},${160 * S.dayLight | 0})` : 'rgb(22,25,36)';
    lg.fillStyle = amb; lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'lighter';
    const wx = WIN.x + WIN.w / 2 - ox, wy = WIN.y + WIN.h / 2;
    let rgd = lg.createRadialGradient(wx, wy, 5, wx, wy, S.day ? 300 : 150);
    rgd.addColorStop(0, S.day ? 'rgba(120,110,90,.9)' : 'rgba(55,68,100,.75)'); rgd.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = rgd; lg.fillRect(0, 0, W, H);
    // moonlight across the floor
    rgd = lg.createRadialGradient(wx - 10, 205, 4, wx - 10, 205, 80);
    rgd.addColorStop(0, S.day ? 'rgba(90,80,60,.6)' : 'rgba(45,55,85,.6)'); rgd.addColorStop(1, 'rgba(0,0,0,0)');
    lg.fillStyle = rgd; lg.fillRect(0, 0, W, H);
    if (S.hallLight) { rgd = lg.createRadialGradient(DOOR.xn + 30 - ox, 150, 4, DOOR.xn + 30 - ox, 150, 90); rgd.addColorStop(0, 'rgba(120,95,60,.7)'); rgd.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = rgd; lg.fillRect(0, 0, W, H); }
    const ti = S.torchOn ? S.torchI : 0;
    if (ti > 0.01) {
      const tx = S.tx, ty = S.ty;
      rgd = lg.createRadialGradient(tx, ty, 0, tx, ty, 190);
      rgd.addColorStop(0, `rgba(120,108,88,${0.55 * ti})`); rgd.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = rgd; lg.fillRect(0, 0, W, H);
      rgd = lg.createRadialGradient(tx, ty, 0, tx, ty, 78);
      rgd.addColorStop(0, `rgba(255,240,210,${ti})`); rgd.addColorStop(0.55, `rgba(240,215,170,${0.75 * ti})`); rgd.addColorStop(0.85, `rgba(140,120,90,${0.25 * ti})`); rgd.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = rgd; lg.fillRect(0, 0, W, H);
    }
    if (S.phoneGlow > 0) {
      rgd = lg.createRadialGradient(W - 40, H + 10, 2, W - 40, H + 10, 120);
      rgd.addColorStop(0, `rgba(90,120,200,${0.8 * S.phoneGlow})`); rgd.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = rgd; lg.fillRect(0, 0, W, H);
    }
    g.globalCompositeOperation = 'multiply'; g.drawImage(light, 0, 0); g.globalCompositeOperation = 'source-over';

    // eyeshine: two points that catch light that is not there
    if (lastEyes && S.eyes > 0) {
      g.fillStyle = `rgba(230,225,205,${Math.min(1, S.eyes)})`;
      for (const [ex, ey] of lastEyes) g.fillRect(Math.round(ex - ox), Math.round(ey), 1.6, 1.2);
    }
    // a face, for one frame, somewhere you were not looking
    if (S.sub) {
      g.save(); g.globalAlpha = 0.55; g.translate(S.sub.x - 30, S.sub.y - 30);
      face(sg, 240, 135, 260, { t, mouth: 0.6 }); g.drawImage(scare, 180, 75, 120, 120, 0, 0, 60, 60); g.restore();
    }
    post(S);
  }

  function drawScare(S) {
    const sc = S.scare, k = sc.k; // k: 0..1 progress
    const s = sc.size * (0.78 + k * 0.4) + Math.sin(S.t * 60) * 5;
    face(sg, 240 + (Math.random() - 0.5) * 10, 140 + (Math.random() - 0.5) * 8, s, { t: S.t, cold: sc.cold, mouth: 0.7 + k * 0.5 });
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    // tear the frame into slices
    for (let y = 0; y < H; y += 6) {
      const off = Math.random() < 0.25 ? (Math.random() - 0.5) * 40 : 0;
      g.drawImage(scare, 0, y, W, 6, off, y, W, 6);
    }
    if (Math.random() < 0.08) { g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, 0, W, H); }
    post({ ...S, split: 3, grain: 18, fade: 1, desat: 0, warm: 0 });
  }

  function post(S) {
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const grain = S.grain == null ? 14 : S.grain, q = S.quant || 10, fade = S.fade == null ? 1 : S.fade;
    const flash = (S.flash || 0) * 255, desat = S.desat || 0, split = S.split | 0, warm = S.warm || 0;
    const off = (Math.random() * NT) | 0, mask = NT - 1;
    for (let y = 0, i = 0, p = 0; y < H; y++) {
      const by = (y & 3) << 2;
      for (let x = 0; x < W; x++, i += 4, p++) {
        const vg = vign[p] * fade, n = noiseTab[(off + p) & mask] * grain, b = bayer[by | (x & 3)] * q;
        let r = (split && x < W - split ? d[i + split * 4] : d[i]) * vg + n + flash;
        let gg = d[i + 1] * vg + n + flash, bb = d[i + 2] * vg + n + flash;
        if (desat) { const l = r * 0.3 + gg * 0.59 + bb * 0.11; r += (l - r) * desat; gg += (l - gg) * desat; bb += (l - bb) * desat; }
        if (warm) { r += warm * 10; bb -= warm * 8; }
        d[i] = ((r + b) / q | 0) * q; d[i + 1] = ((gg + b) / q | 0) * q; d[i + 2] = ((bb + b) / q | 0) * q;
      }
    }
    g.putImageData(img, 0, 0);
  }

  // is a world-space rectangle inside the torch beam?
  function lit(S, name) {
    const r = SPOTS[name]; if (!r || !S.torchOn || S.torchI < 0.3) return false;
    const wx = S.tx + S.camX, wy = S.ty;
    const cx = Math.max(r.x, Math.min(wx, r.x + r.w)), cy = Math.max(r.y, Math.min(wy, r.y + r.h));
    return Math.hypot(wx - cx, wy - cy) < 46;
  }
  function figLit(S) {
    if (!S.figStage || !S.torchOn || S.torchI < 0.3) return false;
    const st = STAGES[S.figStage], wx = S.tx + S.camX, wy = S.ty;
    const top = st.fy - st.h * 0.95, w = st.h * 0.12;
    const cx = Math.max(st.x - w, Math.min(wx, st.x + w)), cy = Math.max(top, Math.min(wy, st.fy));
    return Math.hypot(wx - cx, wy - cy) < 50;
  }
  function spotAt(S) {
    const wx = S.tx + S.camX, wy = S.ty; let best = null, bd = 1e9;
    for (const k in SPOTS) {
      if (k === 'bedfoot' || k === 'wardrobe') continue;
      const r = SPOTS[k], cx = Math.max(r.x, Math.min(wx, r.x + r.w)), cy = Math.max(r.y, Math.min(wy, r.y + r.h));
      const dd = Math.hypot(wx - cx, wy - cy); if (dd < bd) { bd = dd; best = k; }
    }
    return bd < 26 ? best : null;
  }

  return { init, frame, lit, figLit, spotAt, W, H, WW, STAGES };
})();
