/* ================================================================
   MOHIT — Backdrop FX
   01 · cursor-reactive dot-matrix grid (site-wide)
   02 · ASCII data-sphere in the hero
   Pure canvas, no dependencies.
   ================================================================ */
(() => {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  const mouse = {
    x: innerWidth * 0.5, y: innerHeight * 0.42,
    tx: innerWidth * 0.5, ty: innerHeight * 0.42,
  };
  addEventListener('pointermove', (e) => {
    mouse.tx = e.clientX;
    mouse.ty = e.clientY;
  }, { passive: true });

  /* ---------------- DOT GRID ---------------- */
  const grid = document.getElementById('bgGrid');
  const gtx = grid.getContext('2d');
  const GAP = 28;
  const DOT = 1.4;
  const SPOT_R = 210;

  function sizeGrid() {
    grid.width = Math.round(innerWidth * DPR);
    grid.height = Math.round(innerHeight * DPR);
  }

  function drawGrid(t) {
    gtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    gtx.clearRect(0, 0, innerWidth, innerHeight);
    const mx = mouse.x, my = mouse.y;
    for (let x = GAP / 2; x < innerWidth; x += GAP) {
      for (let y = GAP / 2; y < innerHeight; y += GAP) {
        const wave = Math.sin(t * 0.0006 + x * 0.011 + y * 0.013) * 0.02;
        const a = 0.045 + wave;
        const d = Math.hypot(x - mx, y - my);
        if (d < SPOT_R) {
          const k = 1 - d / SPOT_R;
          gtx.fillStyle = `rgba(0, 220, 130, ${(a + k * k * 0.3).toFixed(3)})`;
        } else {
          gtx.fillStyle = `rgba(242, 234, 217, ${Math.max(0.015, a).toFixed(3)})`;
        }
        gtx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT);
      }
    }
  }

  /* ---------------- ASCII SPHERE ----------------
     Full-bleed hero centerpiece. Scroll dives the camera INTO the
     sphere (chars expand and fly past); cursor repels nearby chars;
     click sends a shockwave pulse + spin kick. */
  const sph = document.getElementById('asciiSphere');
  const stx = sph.getContext('2d');
  const hero = document.querySelector('.hero');
  let heroH = hero ? hero.offsetHeight : 0;

  const N = 780;
  const CHARS = '0101010101<>+·01';
  const GA = Math.PI * (3 - Math.sqrt(5));
  const pts = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    pts.push({
      x: Math.cos(th) * r, y, z: Math.sin(th) * r,
      c: CHARS[(Math.random() * CHARS.length) | 0],
      s: 0.75 + Math.random() * 0.6,
    });
  }

  let rotY = 0;
  let spin = 0;      // scroll-injected extra spin, decays each frame
  let pulseT = -1;   // click shockwave start time
  let lastScrollY = scrollY;
  addEventListener('scroll', () => {
    spin += (scrollY - lastScrollY) * 0.00035;
    lastScrollY = scrollY;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if (scrollY < heroH && e.clientY > 80) {
      pulseT = performance.now();
      spin += (e.clientX < innerWidth / 2 ? -1 : 1) * 0.012;
    }
  });

  function sizeSphere() {
    sph.width = Math.round(sph.clientWidth * DPR);
    sph.height = Math.round(sph.clientHeight * DPR);
  }

  function drawSphere(dt, t) {
    const w = sph.clientWidth, h = sph.clientHeight;
    stx.setTransform(DPR, 0, 0, DPR, 0, 0);
    stx.clearRect(0, 0, w, h);

    // Hero scroll progress drives the dive
    const scrollable = Math.max(1, heroH - innerHeight);
    const p = Math.min(1, Math.max(0, scrollY / scrollable));
    const dive = Math.pow(p, 1.35);

    // Fade out only at the very end of the hero
    const fade = p < 0.8 ? 1 : Math.max(0, 1 - (p - 0.8) / 0.18);
    if (fade <= 0) return;
    stx.globalAlpha = fade;

    spin *= 0.94;
    rotY += (0.00022 + dive * 0.0005) * dt + spin;
    const tiltX = 0.32 + (mouse.y / innerHeight - 0.5) * 0.35;
    const tiltZ = (mouse.x / innerWidth - 0.5) * 0.12;

    // Camera flies toward (then through) the sphere surface
    const R = Math.min(w, h) * (0.32 + dive * 0.9);
    const cam = 1.55 - dive * 1.28;
    const cx = w / 2 + (w / 2 - mouse.x) * -0.04;
    const cy = h * 0.45 + (h / 2 - mouse.y) * -0.04 + dive * h * 0.05;

    // Click shockwave: a decaying ripple in the radius
    let pulseK = 1;
    if (pulseT >= 0) {
      const pt = (t - pulseT) / 1000;
      if (pt < 1.4) pulseK = 1 + 0.09 * Math.exp(-pt * 3) * Math.sin(pt * 16);
      else pulseT = -1;
    }

    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);
    const cosZ = Math.cos(tiltZ), sinZ = Math.sin(tiltZ);

    stx.textAlign = 'center';
    stx.textBaseline = 'middle';

    for (let i = 0; i < N; i++) {
      const pt = pts[i];
      const x1 = pt.x * cosY + pt.z * sinY;
      const z1 = -pt.x * sinY + pt.z * cosY;
      const y2 = pt.y * cosX - z1 * sinX;
      const z2 = pt.y * sinX + z1 * cosX;
      const x3 = x1 * cosZ - y2 * sinZ;
      const y3 = x1 * sinZ + y2 * cosZ;

      const denom = cam - z2 * 0.45;
      if (denom < 0.06) continue; // char has flown past the camera
      const pers = 1 / denom;

      let sx = cx + x3 * R * pulseK * pers;
      let sy = cy + y3 * R * pulseK * pers;
      if (sx < -50 || sx > w + 50 || sy < -50 || sy > h + 50) continue;

      // Cursor repulsion: nearby chars scatter and ignite
      let hot = 0;
      const ddx = sx - mouse.x, ddy = sy - mouse.y;
      const dd = Math.hypot(ddx, ddy);
      if (dd < 120 && dd > 0.01) {
        hot = 1 - dd / 120;
        sx += (ddx / dd) * hot * hot * 26;
        sy += (ddy / dd) * hot * hot * 26;
      }

      const depth = (z2 + 1) / 2; // 0 = back, 1 = front
      const size = Math.min(42, 11 * pt.s * pers);
      stx.font = `${size.toFixed(1)}px "JetBrains Mono", monospace`;
      if (hot > 0 || depth > 0.52) {
        const a = Math.min(0.95, 0.16 + depth * 0.62 + hot * 0.5 + dive * 0.15);
        stx.fillStyle = `rgba(0, 220, 130, ${a.toFixed(3)})`;
      } else {
        const a = Math.min(0.6, 0.05 + depth * 0.18 + dive * 0.2);
        stx.fillStyle = `rgba(242, 234, 217, ${a.toFixed(3)})`;
      }
      stx.fillText(pt.c, sx, sy);
    }
    stx.globalAlpha = 1;
  }

  /* ---------------- LOOP ---------------- */
  function sizeAll() {
    sizeGrid();
    sizeSphere();
    heroH = hero ? hero.offsetHeight : 0;
  }
  addEventListener('resize', () => {
    sizeAll();
    if (reduced) { drawGrid(0); drawSphere(16, 0); }
  });
  sizeAll();

  if (reduced) {
    drawGrid(0);
    drawSphere(16, 0);
    return;
  }

  let last = performance.now();
  (function loop(t) {
    const dt = Math.min(50, t - last);
    last = t;
    mouse.x += (mouse.tx - mouse.x) * 0.08;
    mouse.y += (mouse.ty - mouse.y) * 0.08;
    drawGrid(t);
    if (scrollY < heroH) {
      drawSphere(dt, t);
    } else {
      stx.clearRect(0, 0, sph.clientWidth, sph.clientHeight);
    }
    requestAnimationFrame(loop);
  })(last);
})();
