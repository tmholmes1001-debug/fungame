// The bedroom, in three.js. One fixed camera: you, lying in bed, holding a
// phone in front of your face. The phone hides the middle of the room.
// Light is physically based (inverse square), so the phone only lights what
// is close to you, and a post pass fakes your eyes adjusting to the dark.
const World = (() => {
  const T = THREE;
  let renderer, scene, cam, phoneCam, liveCam, rtMain, rtSmall, post, postScene, postCam;
  let faceScene, faceCam, faceSnap = null;
  const L = {}, O = {};
  let W = 1, H = 1, hdr = true;
  const rand = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

  // ------------------------------------------------------------ textures
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  const wallpaper = () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#9aa58e'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(70,85,60,.16)'; g.fillRect(x, 0, 10, h); g.fillStyle = 'rgba(255,250,230,.08)'; g.fillRect(x + 14, 0, 3, h); }
    for (let i = 0; i < 90; i++) {
      const x = (i % 9) * 57 + (Math.floor(i / 9) % 2) * 28, y = Math.floor(i / 9) * 52 + 10;
      g.fillStyle = 'rgba(150,90,95,.35)';
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(80,110,70,.35)'; g.fillRect(x - 1, y + 5, 2, 9);
    }
    // damp, age, a tea-coloured stain
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(60,50,30,${rand() * 0.05})`; g.fillRect(rand() * w, rand() * h, 2 + rand() * 6, 2 + rand() * 6); }
    const s = g.createRadialGradient(380, 120, 4, 380, 120, 90); s.addColorStop(0, 'rgba(110,85,40,.2)'); s.addColorStop(1, 'rgba(110,85,40,0)'); g.fillStyle = s; g.fillRect(0, 0, w, h);
  }, [3, 1.4]);
  const planks = () => canvasTex(512, 512, (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      const base = 70 + rand() * 25; g.fillStyle = `rgb(${base + 30},${base},${base * 0.62})`; g.fillRect(i * 64, 0, 64, h);
      for (let k = 0; k < 40; k++) { g.strokeStyle = `rgba(40,25,10,${0.08 + rand() * 0.12})`; g.lineWidth = 1; g.beginPath(); const x = i * 64 + rand() * 64; g.moveTo(x, 0); g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x + rand() * 4, h); g.stroke(); }
      g.fillStyle = 'rgba(15,8,4,.8)'; g.fillRect(i * 64, 0, 2, h);
      const cut = rand() * h; g.fillRect(i * 64, cut, 64, 2);
    }
  }, [3, 4]);
  const floral = () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9b2a3'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const x = rand() * w, y = rand() * h, r = 3 + rand() * 4;
      g.fillStyle = rand() < 0.7 ? 'rgba(90,115,170,.55)' : 'rgba(175,110,125,.5)';
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.7, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(230,200,90,.7)'; g.beginPath(); g.arc(x, y, r * 0.4, 0, 7); g.fill();
    }
  }, [2, 2]);
  const doorTex = () => canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#d8d2c2'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,60,45,.45)'; g.lineWidth = 5;
    g.strokeRect(36, 40, w - 72, h * 0.42); g.strokeRect(36, h * 0.52, w - 72, h * 0.42);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.strokeRect(41, 45, w - 82, h * 0.42 - 10);
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(80,60,30,${rand() * 0.06})`; g.fillRect(rand() * w, rand() * h, 3, 3); }
    g.fillStyle = 'rgba(60,40,20,.18)'; g.fillRect(w - 50, h * 0.48, 30, 40); // fingerprints by the handle
  });
  const drawingTex = () => canvasTex(256, 200, (g, w, h) => {
    g.fillStyle = '#efe8d8'; g.fillRect(0, 0, w, h);
    g.lineCap = 'round'; g.lineWidth = 4;
    const stick = (x, y, s, c) => { g.strokeStyle = c; g.beginPath(); g.arc(x, y, s * 0.16, 0, 7); g.moveTo(x, y + s * 0.16); g.lineTo(x, y + s * 0.6); g.lineTo(x - s * 0.18, y + s * 0.95); g.moveTo(x, y + s * 0.6); g.lineTo(x + s * 0.18, y + s * 0.95); g.moveTo(x - s * 0.25, y + s * 0.33); g.lineTo(x + s * 0.25, y + s * 0.33); g.stroke(); };
    stick(70, 50, 110, '#b03a4a'); stick(125, 85, 70, '#2f5fa8');
    g.strokeStyle = '#e0a020'; g.beginPath(); g.arc(215, 35, 18, 0, 7); g.stroke();
    // the third one, in black crayon, pressed hard
    g.lineWidth = 6; stick(200, 40, 150, '#111');
    g.fillStyle = '#3a2a20'; g.font = 'bold 15px Comic Sans MS, cursive'; g.fillText('ME  MUM', 40, 190);
  });
  const photoTex = () => canvasTex(128, 160, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#c9a77c'); bg.addColorStop(1, '#6f5440'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a1e18'; g.beginPath(); g.ellipse(64, 70, 34, 42, 0, 0, 7); g.fill(); g.fillRect(30, 70, 68, 90);
    g.fillStyle = '#e0c4a6'; g.beginPath(); g.ellipse(64, 72, 22, 28, 0, 0, 7); g.fill();
    g.fillStyle = '#2a1e18'; g.fillRect(53, 66, 5, 3); g.fillRect(70, 66, 5, 3); g.fillStyle = '#a04848'; g.fillRect(57, 86, 14, 3);
  });
  const boxTex = label => canvasTex(256, 192, (g, w, h) => {
    g.fillStyle = '#a5845a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(70,50,20,${rand() * 0.08})`; g.fillRect(rand() * w, rand() * h, 4, 1); }
    g.fillStyle = 'rgba(220,200,160,.7)'; g.fillRect(w / 2 - 14, 0, 28, h);
    g.fillStyle = '#1b1612'; g.font = 'bold 40px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(label, w / 2, h * 0.62);
  });
  const skinTex = () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#cdc2b4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${90 + rand() * 60},${60 + rand() * 40},${70 + rand() * 50},${rand() * 0.07})`; g.beginPath(); g.arc(rand() * w, rand() * h, rand() * 6, 0, 7); g.fill(); }
    // veins under thin skin
    g.strokeStyle = 'rgba(70,90,130,.22)';
    for (let i = 0; i < 26; i++) { g.lineWidth = 0.6 + rand() * 1.4; g.beginPath(); let x = rand() * w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rand() - 0.5) * 50; y += (rand() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
  });
  const eyeTex = () => canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#d9d2c0'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,30,30,.5)';
    for (let i = 0; i < 40; i++) { g.lineWidth = 0.5 + rand(); g.beginPath(); let x = rand() < 0.5 ? 0 : w, y = rand() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (x > w / 2 ? -1 : 1) * rand() * 30; y += (rand() - 0.5) * 20; g.lineTo(x, y); } g.stroke(); }
    // front of the eyeball (+z) is at u = 0.25 on a three.js sphere
    const cx = w * 0.25, cy = h / 2;
    const ir = g.createRadialGradient(cx, cy, 2, cx, cy, 15); ir.addColorStop(0, '#000'); ir.addColorStop(0.35, '#000'); ir.addColorStop(0.45, '#3b2a20'); ir.addColorStop(1, '#14100c');
    g.fillStyle = ir; g.beginPath(); g.ellipse(cx, cy, 13, 20, 0, 0, 7); g.fill();
  });

  // ------------------------------------------------------------ helpers
  const std = (o) => new T.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  function box(w, h, d, mat, x, y, z, parent = scene) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true; parent.add(m); return m;
  }
  function plane(w, h, mat, x, y, z, rx = 0, ry = 0, parent = scene) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0);
    m.receiveShadow = true; parent.add(m); return m;
  }

  // ------------------------------------------------------------ room
  // Room: x -2..2, y 0..2.5, z -2.6 (far wall, door) .. 2.6 (head wall)
  const DOOR = { x0: -1.8, x1: -0.95, h: 2.02 };
  const WIN = { z0: -1.55, z1: -0.45, y0: 0.95, y1: 2.05 };
  function buildRoom() {
    const wallM = std({ map: wallpaper(), roughness: 0.95 });
    const floorM = std({ map: planks(), roughness: 0.75 });
    const ceilM = std({ color: 0xd8d4ca });
    plane(4, 5.2, floorM, 0, 0, 0, -Math.PI / 2);
    plane(4, 5.2, ceilM, 0, 2.5, 0, Math.PI / 2);
    // far wall, with a doorway
    plane(DOOR.x0 + 2, 2.5, wallM, (-2 + DOOR.x0) / 2, 1.25, -2.6);
    plane(2 - DOOR.x1, 2.5, wallM, (DOOR.x1 + 2) / 2, 1.25, -2.6);
    plane(DOOR.x1 - DOOR.x0, 2.5 - DOOR.h, wallM, (DOOR.x0 + DOOR.x1) / 2, (2.5 + DOOR.h) / 2, -2.6);
    plane(5.2, 2.5, wallM, -2, 1.25, 0, 0, Math.PI / 2);   // left wall
    plane(4, 2.5, wallM, 0, 1.25, 2.6, 0, Math.PI);        // behind your head
    // right wall with a window
    const rw = (z0, z1, y0, y1) => plane(z1 - z0, y1 - y0, wallM, 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, -Math.PI / 2);
    rw(-2.6, WIN.z0, 0, 2.5); rw(WIN.z1, 2.6, 0, 2.5); rw(WIN.z0, WIN.z1, 0, WIN.y0); rw(WIN.z0, WIN.z1, WIN.y1, 2.5);
    // skirting
    const sk = std({ color: 0xcfc8b6, roughness: 0.6 });
    box(4, 0.12, 0.02, sk, 0, 0.06, -2.59); box(0.02, 0.12, 5.2, sk, -1.99, 0.06, 0); box(0.02, 0.12, 5.2, sk, 1.99, 0.06, 0);

    // window: frame, bars, glass, the night outside
    const frame = std({ color: 0xe6e0d0, roughness: 0.5 });
    const wz = (WIN.z0 + WIN.z1) / 2, wy = (WIN.y0 + WIN.y1) / 2, ww = WIN.z1 - WIN.z0, wh = WIN.y1 - WIN.y0;
    box(0.08, 0.06, ww + 0.1, frame, 2, WIN.y0, wz); box(0.08, 0.06, ww + 0.1, frame, 2, WIN.y1, wz);
    box(0.08, wh, 0.06, frame, 2, wy, WIN.z0); box(0.08, wh, 0.06, frame, 2, wy, WIN.z1);
    box(0.05, wh, 0.035, frame, 2, wy, wz); box(0.05, 0.035, ww, frame, 2, wy + 0.1, wz);
    box(0.22, 0.04, ww + 0.2, frame, 1.92, WIN.y0 - 0.03, wz);
    const sky = new T.Mesh(new T.PlaneGeometry(6, 4), new T.MeshBasicMaterial({ map: canvasTex(256, 256, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#060a14'); gr.addColorStop(0.6, '#0f1626'); gr.addColorStop(1, '#141414'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const m = g.createRadialGradient(150, 70, 2, 150, 70, 60); m.addColorStop(0, 'rgba(210,220,240,.9)'); m.addColorStop(0.15, 'rgba(120,140,180,.3)'); m.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = m; g.fillRect(0, 0, w, h);
      g.fillStyle = '#040508'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, 170); g.lineTo(60, 140); g.lineTo(120, 170); g.lineTo(120, 190); g.lineTo(256, 190); g.lineTo(256, h); g.fill();
      g.fillStyle = '#8a6a3a'; g.fillRect(70, 175, 10, 8);
    }) }));
    sky.position.set(4.2, 1.4, wz); sky.rotation.y = -Math.PI / 2; scene.add(sky);
    // curtains, nearly closed: moonlight comes through the gap
    const curtM = std({ color: 0x8a5c62, roughness: 1, side: T.DoubleSide });
    O.curtains = [];
    for (const [z0, z1] of [[WIN.z0 - 0.18, wz - 0.1], [wz + 0.06, WIN.z1 + 0.18]]) {
      const g = new T.PlaneGeometry(z1 - z0, 1.55, 24, 1), p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 38) * 0.035);
      g.computeVertexNormals();
      const m = new T.Mesh(g, curtM); m.position.set(1.9, wy + 0.08, (z0 + z1) / 2); m.rotation.y = -Math.PI / 2;
      m.castShadow = m.receiveShadow = true; scene.add(m); O.curtains.push(m);
    }
    box(0.03, 0.03, ww + 0.6, std({ color: 0x3b2c22 }), 1.9, WIN.y1 + 0.12, wz);

    // the door, ajar
    const trim = std({ color: 0xe0dacb, roughness: 0.5 });
    box(0.07, DOOR.h + 0.07, 0.05, trim, DOOR.x0 - 0.035, DOOR.h / 2, -2.575);
    box(0.07, DOOR.h + 0.07, 0.05, trim, DOOR.x1 + 0.035, DOOR.h / 2, -2.575);
    box(DOOR.x1 - DOOR.x0 + 0.14, 0.07, 0.05, trim, (DOOR.x0 + DOOR.x1) / 2, DOOR.h + 0.035, -2.575);
    O.door = new T.Group(); O.door.position.set(DOOR.x0, 0, -2.6); scene.add(O.door);
    const leaf = box(DOOR.x1 - DOOR.x0 - 0.01, DOOR.h - 0.01, 0.04, std({ map: doorTex(), roughness: 0.55 }), (DOOR.x1 - DOOR.x0) / 2, DOOR.h / 2, 0, O.door);
    const knob = new T.Mesh(new T.SphereGeometry(0.03, 12, 8), std({ color: 0x9a8a5a, metalness: 0.8, roughness: 0.35 }));
    knob.position.set(DOOR.x1 - DOOR.x0 - 0.08, 1.0, 0.04); O.door.add(knob);
    void leaf;
    // the landing beyond: a dim light someone left on
    const hallM = std({ color: 0x8c8474, side: T.BackSide });
    const hall = new T.Mesh(new T.BoxGeometry(2.4, 2.5, 2.2), hallM); hall.position.set(-1.35, 1.25, -3.72); hall.receiveShadow = true; scene.add(hall);
    box(0.06, 0.95, 1.6, std({ color: 0x4a3426 }), -0.42, 0.48, -3.7); // banister
    L.hall = new T.PointLight(0xffb070, 1.6, 0, 2); L.hall.position.set(-1.9, 2.1, -4.4); scene.add(L.hall);

    // bed: mattress, duvet over your legs, footboard
    box(1.45, 0.3, 2.05, std({ color: 0xe8e2d6 }), 0, 0.42, 1.45);
    const dg = new T.PlaneGeometry(1.75, 2.2, 60, 70), dp = dg.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i), z = -dp.getY(i) + 1.4; // plane y maps to world -z
      let y = 0.64;
      const legs = Math.exp(-Math.pow((x + 0.17) / 0.12, 2)) + Math.exp(-Math.pow((x - 0.16) / 0.12, 2));
      y += legs * 0.06 * Math.max(0, Math.min(1, (2.0 - z) / 0.6)) * (z > 0.5 ? 1 : 0.3);
      y += Math.exp(-Math.pow((z - 0.55) / 0.08, 2)) * (Math.exp(-Math.pow((x + 0.17) / 0.09, 2)) + Math.exp(-Math.pow((x - 0.16) / 0.09, 2))) * 0.07;
      y += Math.sin(x * 21 + z * 6) * 0.008 + Math.sin(z * 17 - x * 4) * 0.01;
      const edge = Math.max(0, Math.abs(x) - 0.72); y -= edge * 2.6;
      if (z < 0.45) y -= (0.45 - z) * 2.4;
      dp.setXYZ(i, x, y, z);
    }
    dg.computeVertexNormals();
    O.duvet = new T.Mesh(dg, std({ map: floral(), roughness: 0.95, side: T.DoubleSide })); O.duvet.castShadow = O.duvet.receiveShadow = true; scene.add(O.duvet);
    const wood = std({ color: 0x4a3122, roughness: 0.55 });
    box(1.55, 0.3, 0.05, wood, 0, 0.55, 0.36); box(0.07, 0.8, 0.07, wood, -0.78, 0.4, 0.36); box(0.07, 0.8, 0.07, wood, 0.78, 0.4, 0.36);
    box(1.55, 0.05, 0.08, wood, 0, 0.72, 0.36);

    // her chair, her cardigan
    const chairM = std({ color: 0x5a3e2c, roughness: 0.6 });
    const cx = 0.55, cz = -2.25;
    box(0.45, 0.04, 0.42, chairM, cx, 0.46, cz);
    for (const [dx, dz] of [[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]]) box(0.035, 0.46, 0.035, chairM, cx + dx, 0.23, cz + dz);
    box(0.035, 0.5, 0.035, chairM, cx - 0.2, 0.72, cz - 0.18); box(0.035, 0.5, 0.035, chairM, cx + 0.2, 0.72, cz - 0.18); box(0.44, 0.06, 0.03, chairM, cx, 0.92, cz - 0.18);
    const cg = new T.SphereGeometry(0.22, 18, 14), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const y = cp.getY(i); cp.setXYZ(i, cp.getX(i) * 1.1, y * 1.4 + (y < 0 ? y * 0.6 : 0), cp.getZ(i) * 0.45 + Math.sin(cp.getX(i) * 30) * 0.01); }
    cg.computeVertexNormals();
    O.cardigan = new T.Mesh(cg, std({ color: 0x7a6177, roughness: 1 })); O.cardigan.position.set(cx, 0.78, cz - 0.12); O.cardigan.castShadow = O.cardigan.receiveShadow = true; scene.add(O.cardigan);

    // wardrobe in the far corner, one door not quite shut
    const wardM = std({ color: 0x4b3424, roughness: 0.55 });
    box(0.62, 2.05, 0.95, wardM, 1.68, 1.025, -2.1);
    box(0.02, 1.9, 0.015, std({ color: 0x050505 }), 1.37, 1.0, -2.1);
    box(0.02, 0.02, 0.2, std({ color: 0x9a8a5a, metalness: 0.8, roughness: 0.4 }), 1.36, 1.05, -2.0);

    // boxes of her things
    const b1 = box(0.55, 0.4, 0.45, std({ map: boxTex('KEEP') }), -1.55, 0.2, -1.2); b1.rotation.y = 1.45;
    const b2 = box(0.45, 0.32, 0.38, std({ map: boxTex('MUM') }), -1.58, 0.56, -1.22); b2.rotation.y = 1.62;
    // the drawing, the photo, the lampshade
    plane(0.42, 0.33, std({ map: drawingTex(), roughness: 1 }), -0.42, 1.45, -2.585);
    box(0.32, 0.4, 0.03, std({ color: 0x2b1d15 }), 1.0, 1.6, -2.585);
    plane(0.26, 0.33, std({ map: photoTex(), roughness: 0.3 }), 1.0, 1.6, -2.565);
    const shade = new T.Mesh(new T.CylinderGeometry(0.14, 0.24, 0.22, 20, 1, true), std({ color: 0xd8c8a8, side: T.DoubleSide }));
    shade.position.set(0, 2.15, -0.6); shade.castShadow = true; scene.add(shade);
    box(0.01, 0.25, 0.01, std({ color: 0x222222 }), 0, 2.38, -0.6);

    // you, for cameras that are not your eyes
    const you = new T.Group();
    const head = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), std({ color: 0xc9a88a })); head.position.set(0, 1.12, 2.32); head.scale.set(1, 1.15, 1.05);
    const hair = new T.Mesh(new T.SphereGeometry(0.11, 16, 12, 0, 6.3, 0, 1.7), std({ color: 0x2a1d16 })); hair.position.set(0, 1.15, 2.35);
    const pillow = box(0.7, 0.3, 0.45, std({ color: 0xece6da }), 0, 0.75, 2.35, you);
    const screen = new T.Mesh(new T.PlaneGeometry(0.075, 0.155), new T.MeshBasicMaterial({ color: 0xcfe0ff }));
    screen.position.set(0, 1.04, 1.95); screen.rotation.x = -0.25; O.youScreen = screen;
    you.add(head, hair, screen); void pillow;
    you.traverse(o => { o.layers.set(1); o.castShadow = true; });
    scene.add(you);

    // lights
    scene.add(new T.HemisphereLight(0x223044, 0x0a0806, 0.025));
    L.moon = new T.SpotLight(0xa8bce0, 22, 0, 0.32, 0.6, 2);
    L.moon.position.set(3.8, 2.9, wz + 0.1); L.moon.target.position.set(0.2, 0.15, -0.6);
    L.moon.castShadow = true; L.moon.shadow.mapSize.set(1024, 1024); L.moon.shadow.bias = -0.0005;
    scene.add(L.moon, L.moon.target);
    L.phone = new T.PointLight(0xcfe0ff, 0.2, 0, 2); L.phone.position.set(0.02, 1.06, 1.92);
    L.phone.castShadow = true; L.phone.shadow.mapSize.set(512, 512); L.phone.shadow.camera.near = 0.05; L.phone.shadow.bias = -0.002;
    scene.add(L.phone);
    L.torch = new T.SpotLight(0xfff0dc, 0, 0, 0.55, 0.45, 2); L.torch.position.set(0.02, 1.06, 1.88);
    L.torch.target.position.set(-0.1, 0.9, -2.6); L.torch.castShadow = true; L.torch.shadow.mapSize.set(512, 512);
    scene.add(L.torch, L.torch.target);
    L.flash = new T.PointLight(0xffffff, 0, 0, 2); L.flash.position.set(0.02, 1.06, 1.85); scene.add(L.flash);
  }

  // ------------------------------------------------------------ the visitor
  // Built to be read as a silhouette, never as a model: too tall, too thin,
  // a nightdress, hair hanging forward, arms that end below the knee.
  function buildFigure() {
    const g = new T.Group(), dark = std({ color: 0x16130f, roughness: 1 }), skin = std({ color: 0x302a25, roughness: 0.85 });
    const prof = [[0.0, 0], [0.27, 0], [0.24, 0.4], [0.17, 0.95], [0.13, 1.35], [0.15, 1.55], [0.1, 1.62], [0.0, 1.63]].map(([r, y]) => new T.Vector2(r, y));
    const body = new T.Mesh(new T.LatheGeometry(prof, 24), dark); body.scale.z = 0.62; g.add(body);
    const neck = new T.Mesh(new T.CylinderGeometry(0.035, 0.045, 0.22, 10), skin); neck.position.y = 1.72; neck.rotation.z = 0.12; g.add(neck);
    const head = new T.Group(); head.position.set(0.035, 1.9, 0); head.rotation.z = 0.38; g.add(head);
    const skullM = new T.Mesh(new T.SphereGeometry(0.1, 16, 12), dark); skullM.scale.set(0.95, 1.2, 1); head.add(skullM);
    // hair falling forward over the face and down the back
    const hairM = std({ color: 0x0b0a09, roughness: 0.7, side: T.DoubleSide });
    for (let i = 0; i < 9; i++) {
      const strip = new T.Mesh(new T.PlaneGeometry(0.07, 0.62, 1, 6), hairM), p = strip.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) p.setZ(k, Math.pow((0.31 - p.getY(k)) / 0.62, 2) * 0.05);
      const a = (i / 8 - 0.5) * 2.4; strip.position.set(Math.sin(a) * 0.085, -0.22, Math.cos(a) * 0.085); strip.rotation.y = a; head.add(strip);
    }
    for (const s of [-1, 1]) {
      const arm = new T.Mesh(new T.CylinderGeometry(0.022, 0.03, 0.95, 8), skin); arm.position.set(s * 0.17, 1.12, 0.03); arm.rotation.z = s * 0.06; g.add(arm);
      for (let f = 0; f < 4; f++) { const fi = new T.Mesh(new T.CylinderGeometry(0.006, 0.008, 0.13, 5), skin); fi.position.set(s * (0.2 + f * 0.012), 0.6, 0.03 + (f - 1.5) * 0.012); g.add(fi); }
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.visible = false; scene.add(g); O.fig = g;
  }
  const SPOTS = {
    gap:     { p: [-1.08, 0, -3.05], r: 0.25 },
    doorway: { p: [-1.38, 0, -2.75], r: 0.05 },
    inside:  { p: [-0.95, 0, -1.6], r: 0.35 },
    foot:    { p: [0.0, 0, 0.02], r: 0.0 },
    side:    { p: [0.62, 0, 1.35], r: -0.55 },
  };

  // ------------------------------------------------------------ the face
  // MediaPipe's canonical face, pushed just past human: the eyes a little
  // too big and too far apart, the face a little too long, and a jaw that
  // keeps opening after a jaw should stop.
  const UPPER_LIP = new Set([61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 76, 62, 184, 183, 42, 41, 38, 12, 268, 271, 272, 407, 408, 292, 306]);
  const LOWER_LIP = [146, 91, 181, 84, 17, 314, 405, 321, 375, 95, 88, 178, 87, 14, 317, 402, 318, 324, 77, 90, 180, 85, 16, 315, 404, 320, 307];
  let faceBase, faceGeo, jawW, smileW, eyeC;
  function buildFace() {
    const P = FACE_MESH.pos, n = P.length / 3;
    const v = i => new T.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const ctr = (ids) => ids.map(v).reduce((a, b) => a.add(b), new T.Vector3()).multiplyScalar(1 / ids.length);
    eyeC = [ctr([33, 133, 159, 145]), ctr([263, 362, 386, 374])];
    faceBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = v(i);
      p.x *= 0.93; p.y *= 1.07;
      for (const e of eyeC) {
        const d = Math.hypot(p.x - e.x, p.y - e.y), w = Math.max(0, 1 - d / 2.6);
        p.x += (p.x - e.x) * 0.14 * w + Math.sign(e.x) * 0.35 * w; p.y += (p.y - e.y) * 0.12 * w; p.z -= 0.35 * w * w;
      }
      faceBase.set([p.x, p.y, p.z], i * 3);
    }
    eyeC = eyeC.map(e => new T.Vector3(e.x * 0.93 + Math.sign(e.x) * 0.35, e.y * 1.07, e.z - 0.9));
    const mouthY = -4.35 * 1.07;
    jawW = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = faceBase[i * 3], y = faceBase[i * 3 + 1];
      if (UPPER_LIP.has(i)) { jawW[i] = 0; continue; }
      if (LOWER_LIP.includes(i)) { jawW[i] = 1; continue; }
      const below = Math.min(1, Math.max(0, (mouthY - y) / 1.6)), lateral = Math.min(1, Math.max(0, 1 - (Math.abs(x) - 3.5) / 3.5));
      jawW[i] = below * lateral;
    }
    const corners = [61, 291].map(i => [faceBase[i * 3], faceBase[i * 3 + 1]]);
    smileW = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = faceBase[i * 3], y = faceBase[i * 3 + 1];
      smileW[i] = Math.max(...corners.map(([cx, cy]) => Math.max(0, 1 - Math.hypot(x - cx, y - cy) / 2.2)));
      // her left eye sits a few millimetres lower than her right
      if (x > 0) { const d = Math.hypot(x - eyeC[1].x, y - eyeC[1].y); faceBase[i * 3 + 1] -= 0.35 * Math.max(0, 1 - d / 3); }
    }
    eyeC[1].y -= 0.35;
    faceGeo = new T.BufferGeometry();
    faceGeo.setAttribute('position', new T.BufferAttribute(faceBase.slice(), 3));
    faceGeo.setAttribute('uv', new T.Float32BufferAttribute(FACE_MESH.uv, 2));
    // vertex colour: sunken grey around the eyes, bloodless lips
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = faceBase[i * 3], y = faceBase[i * 3 + 1];
      let c = 0.92 + (rand() - 0.5) * 0.1;
      for (const e of eyeC) c *= 1 - 0.55 * Math.max(0, 1 - Math.hypot(x - e.x, y - e.y) / 2.4);
      const lip = Math.max(0, 1 - Math.hypot(x / 2.6, (y - mouthY) / 0.9));
      col.set([c * (1 - lip * 0.35), c * (1 - lip * 0.45), c * (1 - lip * 0.3)], i * 3);
    }
    faceGeo.setAttribute('color', new T.BufferAttribute(col, 3));
    faceGeo.setIndex(FACE_MESH.idx); faceGeo.computeVertexNormals();
    const face = new T.Mesh(faceGeo, std({ map: skinTex(), vertexColors: true, roughness: 0.62, side: T.DoubleSide }));
    const head = new T.Group(); head.add(face);
    // the inside of the mouth, the back of the skull
    const cavity = new T.Mesh(new T.SphereGeometry(3.2, 16, 12), new T.MeshBasicMaterial({ color: 0x000000 }));
    cavity.position.set(0, -4.5, 1.2); cavity.scale.set(0.9, 1, 0.6); head.add(cavity); O.cavity = cavity;
    const skull = new T.Mesh(new T.SphereGeometry(7.6, 20, 16), new T.MeshBasicMaterial({ color: 0x050404 }));
    skull.position.set(0, 0.6, -4.2); skull.scale.set(1, 1.25, 0.62); head.add(skull);
    // eyes that do not blink
    O.eyes = eyeC.map(e => {
      const m = new T.Mesh(new T.SphereGeometry(1.25, 24, 16), std({ map: eyeTex(), roughness: 0.15 }));
      m.position.copy(e); head.add(m); return m;
    });
    // hair: a black mass framing the face, and a few wet strands across it
    const voidM = new T.MeshBasicMaterial({ color: 0x000000, side: T.DoubleSide });
    for (const sd of [-1, 1]) {
      const g = new T.PlaneGeometry(9, 34, 4, 12), p = g.attributes.position;
      for (let j = 0; j < p.count; j++) { const yy = p.getY(j), xx = p.getX(j); p.setZ(j, -Math.abs(xx) * 0.35 - Math.max(0, yy - 8) * 0.25); }
      const m = new T.Mesh(g, voidM); m.position.set(sd * 10.2, -7, 1.2); m.rotation.y = sd * 0.5; head.add(m);
    }
    const cap = new T.Mesh(new T.SphereGeometry(8.6, 20, 12, 0, Math.PI * 2, 0, 1.25), voidM); cap.position.set(0, 1.2, 0.2); cap.scale.set(1.02, 1, 0.9); head.add(cap);
    const strandM = std({ color: 0x030303, roughness: 0.85 });
    for (let i = 0; i < 9; i++) {
      const x0 = (i - 4) * 1.1 + (i % 2 ? 0.4 : -0.3), z0 = 6.2 - Math.abs(x0) * 0.25;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(new T.Vector3(x0 * (1 + t * 0.5) + Math.sin(t * 5 + i) * 0.6, 8.5 - t * (14 + (i % 3) * 5), z0 - t * 1.5 + Math.sin(t * 3.1) * 0.4)); }
      head.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, 0.09 + (i % 3) * 0.05, 4), strandM));
    }
    head.scale.setScalar(0.0125); head.visible = false;
    scene.add(head); O.face = head;
    L.face = new T.PointLight(0x9fb8ff, 0, 0, 2); scene.add(L.face);
  }
  function setJaw(J, wobble, t, smile = 0) {
    const p = faceGeo.attributes.position.array;
    for (let i = 0; i < jawW.length; i++) {
      const w = jawW[i], sw = smileW[i];
      const bx = faceBase[i * 3], by = faceBase[i * 3 + 1], bz = faceBase[i * 3 + 2];
      p[i * 3] = bx + J * 0.12 * w + Math.sin(t * 40 + by) * wobble * 0.08 + Math.sign(bx) * sw * smile * 1.1;
      p[i * 3 + 1] = by - J * w + sw * smile * 0.9;
      p[i * 3 + 2] = bz - J * 0.35 * w - sw * smile * 0.4;
    }
    faceGeo.attributes.position.needsUpdate = true; faceGeo.computeVertexNormals();
    O.cavity.position.y = -4.5 - J * 0.55; O.cavity.scale.y = 1 + J * 0.18;
  }

  // ------------------------------------------------------------ post
  const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
  const FRAG = `
    uniform sampler2D tDiffuse; uniform vec2 res;
    uniform float exposure, time, grain, blur, vign, flash, glitch, night, aberr, fade, lift;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0., 1.); }
    void main(){
      vec2 uv = vUv;
      if (glitch > 0.) {
        float band = floor(uv.y * 34. + floor(time * 9.));
        if (hash(vec2(band, floor(time * 24.))) < glitch * 0.6) uv.x += (hash(vec2(band, time)) - .5) * .16 * glitch;
      }
      vec2 px = 1. / res; vec3 c = vec3(0.); float tot = 0.;
      for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
        vec2 o = vec2(float(i), float(j)) * px * blur; float w = exp(-float(i * i + j * j) / 3.);
        c += texture2D(tDiffuse, uv + o).rgb * w; tot += w;
      }
      c /= tot;
      if (aberr > 0.) { c.r = mix(c.r, texture2D(tDiffuse, uv + vec2(aberr * px.x * 4., 0.)).r, .8); c.b = mix(c.b, texture2D(tDiffuse, uv - vec2(aberr * px.x * 4., 0.)).b, .8); }
      c = c * exposure + lift;
      c = aces(c);
      if (night > .5) { float l = dot(c, vec3(.3, .59, .11)); l = pow(l, .8) * 1.2; c = vec3(l * .82, l, l * .86); }
      float n = hash(uv * res + fract(time * 7.13) * 91.) - .5;
      c += n * grain * (.35 + .65 * clamp(exposure / 6., 0., 1.4));
      vec2 d = uv - .5; c *= 1. - vign * dot(d, d) * 2.4;
      c = mix(c, vec3(1.), flash);
      c = pow(max(c, 0.), vec3(1. / 2.2)) * fade;
      c += (hash(uv * res + time) - .5) / 255.;
      gl_FragColor = vec4(c, 1.);
    }`;
  function makePost() {
    post = new T.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, res: { value: new T.Vector2(1, 1) }, exposure: { value: 1 }, time: { value: 0 }, grain: { value: 0.05 }, blur: { value: 0 }, vign: { value: 0.6 }, flash: { value: 0 }, glitch: { value: 0 }, night: { value: 0 }, aberr: { value: 0 }, fade: { value: 1 }, lift: { value: 0 } },
      vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    });
    postScene = new T.Scene(); postCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), post));
  }
  function makeRT(w, h) {
    return new T.WebGLRenderTarget(w, h, { minFilter: T.LinearFilter, magFilter: T.LinearFilter, type: hdr ? T.HalfFloatType : T.UnsignedByteType });
  }

  // ------------------------------------------------------------ public
  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
    renderer.outputEncoding = T.LinearEncoding;
    hdr = renderer.capabilities.isWebGL2;
    scene = new T.Scene(); scene.background = new T.Color(0x000000);
    cam = new T.PerspectiveCamera(56, 16 / 9, 0.05, 30); cam.position.set(0.03, 1.22, 2.3); cam.lookAt(-0.1, 0.78, -2.6);
    phoneCam = new T.PerspectiveCamera(52, 9 / 16, 0.05, 30); phoneCam.position.set(0.02, 1.08, 1.9); phoneCam.lookAt(0, 0.92, -2.6);
    liveCam = new T.PerspectiveCamera(70, 9 / 16, 0.05, 30); liveCam.position.set(-1.7, 2.3, -2.2); liveCam.lookAt(0.1, 0.6, 1.4);
    liveCam.layers.enable(1); cam.layers.set(0); phoneCam.layers.set(0);
    buildRoom(); buildFigure(); buildFace(); makePost();
    rtSmall = makeRT(360, 640);
    resize();
    snapFace();
  }
  function resize() {
    const pr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = window.innerWidth; H = window.innerHeight;
    renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
    cam.aspect = W / H; cam.updateProjectionMatrix();
    const ih = Math.min(720, Math.round(H * pr)), iw = Math.round(ih * W / H);
    if (rtMain) rtMain.dispose();
    rtMain = makeRT(iw, ih);
  }

  // place things from the director's state
  let doorAngle = 0.06, figAt = null;
  function apply(s, dt) {
    doorAngle += (s.door - doorAngle) * Math.min(1, dt * (s.doorSpeed || 1.2));
    O.door.rotation.y = -doorAngle;
    L.hall.intensity = s.hallLight * (0.85 + Math.random() * 0.15 * s.hallFlicker);
    L.phone.intensity = s.phoneLight; L.phone.color.setHex(s.phoneColor || 0xcfe0ff);
    L.torch.intensity = s.torch ? 26 : 0;
    L.flash.intensity = s.flash * 60;
    O.youScreen.visible = s.phoneLight > 0.05;
    if (s.fig !== figAt) {
      figAt = s.fig; O.fig.visible = !!SPOTS[s.fig];
      if (SPOTS[s.fig]) { const sp = SPOTS[s.fig]; O.fig.position.set(...sp.p); O.fig.rotation.y = sp.r; }
    }
    if (O.fig.visible) O.fig.rotation.z = Math.sin(s.t * 0.7) * 0.012;
    O.curtains.forEach((c, i) => { c.rotation.x = Math.round(Math.sin(s.t * 0.6 + i) * 60) / 4000; });
    // the face, when it is time
    const sc = s.scare;
    O.face.visible = !!sc;
    if (sc) {
      const k = sc.k, d = 0.62 - Math.min(1, k * 1.8) * 0.36;
      const dir = new T.Vector3(); cam.getWorldDirection(dir);
      O.face.position.copy(cam.position).addScaledVector(dir, d);
      O.face.position.y -= 0.03 - Math.sin(s.t * 31) * 0.004;
      O.face.position.x += Math.sin(s.t * 23) * 0.004;
      O.face.quaternion.copy(cam.quaternion); O.face.rotateZ(0.16 + Math.sin(s.t * 3) * 0.02);
      setJaw(0.4 + Math.max(0, Math.min(1, (k - 0.18) * 1.6)) * 6, k > 0.18 ? 1 : 0, s.t, Math.max(0, 1 - k * 3));
      L.face.position.copy(cam.position).addScaledVector(dir, 0.12); L.face.position.y -= 0.13;
      L.face.intensity = 0.07 * (0.75 + Math.random() * 0.5);
    } else L.face.intensity = 0;
  }

  // views: the room (your eyes), plus optional phone-screen viewports
  // shadows only re-render when something that casts them has moved
  let shadowKey = '', frame = 0;
  function render(s, dt, views = []) {
    apply(s, dt);
    const key = `${doorAngle.toFixed(3)}|${figAt}|${s.torch}|${!!s.scare}|${O.curtains[0].rotation.x.toFixed(3)}`;
    if (key !== shadowKey || ++frame % 20 === 0) { renderer.shadowMap.needsUpdate = true; shadowKey = key; }
    post.uniforms.time.value = s.t;
    renderer.setRenderTarget(rtMain); renderer.render(scene, cam);
    renderer.setRenderTarget(null);
    renderer.setViewport(0, 0, W, H); renderer.setScissorTest(false);
    Object.assign(uni(), { tDiffuse: rtMain.texture, exposure: s.exposure, grain: s.grain, blur: s.blur, vign: 0.75, flash: s.flash * 0.9, glitch: s.glitch, night: 0, aberr: s.aberr, fade: s.fade, lift: 0 });
    post.uniforms.res.value.set(rtMain.width, rtMain.height);
    renderer.render(postScene, postCam);
    for (const v of views) {
      const r = v.rect; if (!r || r.width < 4) continue;
      const c = v.mode === 'live' ? liveCam : phoneCam;
      c.aspect = r.width / r.height; c.updateProjectionMatrix();
      const sw = Math.max(64, Math.round(480 * c.aspect)); if (rtSmall.width !== sw) rtSmall.setSize(sw, 480);
      const youScreen = O.youScreen.visible; if (v.mode !== 'live') O.youScreen.visible = false;
      renderer.setRenderTarget(rtSmall); renderer.render(scene, c); renderer.setRenderTarget(null);
      O.youScreen.visible = youScreen;
      const y = H - r.bottom;
      renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(r.left, y, r.width, r.height); renderer.setScissorTest(true);
      Object.assign(uni(), { tDiffuse: rtSmall.texture, exposure: v.exposure || 14, grain: 0.16, blur: 0.6, vign: 0.9, flash: s.flash, glitch: v.glitch || 0, night: 1, aberr: 0.4, fade: 1, lift: 0.002 });
      post.uniforms.res.value.set(rtSmall.width, rtSmall.height);
      renderer.render(postScene, postCam);
      renderer.setScissorTest(false);
    }
  }
  function uni() { const u = post.uniforms; return new Proxy({}, { set: (_, k, val) => { u[k].value = val; return true; } }); }

  // a still of the face, for the feed. rendered once.
  function snapFace() {
    try {
      faceScene = new T.Scene(); faceCam = new T.PerspectiveCamera(30, 1, 0.01, 10); faceCam.position.set(0, 0, 0.62);
      const f = O.face; scene.remove(f); faceScene.add(f); f.visible = true; f.position.set(0, -0.01, 0); f.rotation.set(0, 0, 0.12);
      setJaw(0.6, 0, 0, 1);
      const l = new T.PointLight(0x9fb8ff, 0.05, 0, 2); l.position.set(0.02, -0.12, 0.24); faceScene.add(l);
      const rt = new T.WebGLRenderTarget(256, 256);
      renderer.setRenderTarget(rt); renderer.render(faceScene, faceCam);
      const px = new Uint8Array(256 * 256 * 4); renderer.readRenderTargetPixels(rt, 0, 0, 256, 256, px);
      renderer.setRenderTarget(null);
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'), img = g.createImageData(256, 256);
      for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
        const si = ((255 - y) * 256 + x) * 4, di = (y * 256 + x) * 4;
        for (let k = 0; k < 3; k++) img.data[di + k] = Math.min(255, Math.pow(px[si + k] / 255, 1 / 2.2) * 255 * 1.4);
        img.data[di + 3] = 255;
      }
      g.putImageData(img, 0, 0); faceSnap = c;
      faceScene.remove(f); faceScene.remove(l); scene.add(f); f.visible = false; f.rotation.set(0, 0, 0); rt.dispose();
    } catch (e) { faceSnap = null; }
  }

  // the LIVE video is filmed from wherever she is standing
  const LIVE = {
    landing: [[-1.45, 1.85, -3.3], [-1.2, 1.0, -2.6]],
    door:    [[-1.4, 1.9, -2.9], [0, 0.9, 2.0]],
    doorway: [[-1.35, 1.95, -2.45], [0, 0.9, 2.1]],
    foot:    [[0.02, 1.95, 0.12], [0, 0.95, 2.2]],
    side:    [[0.62, 1.85, 1.45], [0, 1.05, 2.3]],
  };
  function liveFrom(at) {
    const l = LIVE[at] || LIVE.landing;
    liveCam.position.set(...l[0]); liveCam.lookAt(...l[1]);
  }

  return { init, resize, render, liveFrom, get faceImage() { return faceSnap; } };
})();
