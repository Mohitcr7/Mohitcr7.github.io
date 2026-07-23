/* ================================================================
   MOHIT — Backdrop FX
   01 · cursor-reactive dot-matrix grid (site-wide)
   02 · ASCII data-sphere in the hero (scroll dives INTO it,
        cursor repels chars, click sends a shockwave + spin kick)
   The ASCII portrait (bottom-right) lives in js/ascii/.
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
    const cy = h * 0.34 + (h / 2 - mouse.y) * -0.04 + dive * h * 0.05;

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

  /* ---------------- DATA RAIN + FLOATING DUST ----------------
     Sparse, futuristic AI-telemetry streams + parallax dust motes,
     both on the #dataRain canvas behind the sphere. Deliberately faint
     — only noticeable after staring for a few seconds. Throttled on
     mobile; fades out with the hero as you dive. */
  const rain = document.getElementById('dataRain');
  const rtx = rain ? rain.getContext('2d') : null;
  const isMobile = innerWidth < 720;
  const RAIN_CHARS = '01<>{}[]#/\\+=01·01';

  let streams = [];
  let motes = [];

  function makeStream(w, h, spread) {
    const len = 5 + (Math.random() * 15 | 0);
    const chars = [];
    for (let i = 0; i < len; i++) chars.push(RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0]);
    return {
      x: Math.random() * w,
      y: spread ? Math.random() * h : -Math.random() * h * 0.4,
      len, chars,
      fs: 12 + Math.random() * 8,
      speed: 0.014 + Math.random() * 0.05,   // fraction of height per ms·0.06
      alpha: 0.1 + Math.random() * 0.34,     // random opacity
    };
  }

  function seedFX() {
    if (!rain) return;
    const w = rain.clientWidth || innerWidth;
    const h = rain.clientHeight || innerHeight;
    const cols = Math.max(6, Math.round((w / 52) * (isMobile ? 0.5 : 1)));
    streams = [];
    for (let i = 0; i < cols; i++) streams.push(makeStream(w, h, true));
    const nMotes = isMobile ? 24 : 68;
    motes = [];
    for (let i = 0; i < nMotes; i++) {
      motes.push({
        x: Math.random() * w, y: Math.random() * h,
        z: 0.3 + Math.random() * 0.7,          // depth → parallax + size
        r: 0.6 + Math.random() * 1.3,
        ph: Math.random() * Math.PI * 2,
        sp: 0.2 + Math.random() * 0.5,
      });
    }
  }

  function drawRain(dt, t, fade) {
    if (!rtx) return;
    const w = rain.clientWidth, h = rain.clientHeight;
    rtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    rtx.clearRect(0, 0, w, h);
    if (fade <= 0) return;
    rtx.globalAlpha = fade;
    rtx.textAlign = 'center';
    rtx.textBaseline = 'middle';

    for (const s of streams) {
      s.y += s.speed * dt * h * 0.06;
      if (Math.random() < 0.35) s.chars[(Math.random() * s.len) | 0] = RAIN_CHARS[(Math.random() * RAIN_CHARS.length) | 0];
      rtx.font = `${s.fs.toFixed(1)}px "JetBrains Mono", monospace`;
      const step = s.fs * 1.16;
      for (let k = 0; k < s.len; k++) {
        const cy = s.y - k * step;
        if (cy < -20 || cy > h + 20) continue;
        const a = s.alpha * (1 - k / s.len);
        if (k === 0) rtx.fillStyle = `rgba(190, 255, 224, ${(a * 1.2).toFixed(3)})`;
        else rtx.fillStyle = `rgba(0, 220, 130, ${a.toFixed(3)})`;
        rtx.fillText(s.chars[k], s.x, cy);
      }
      if (s.y - s.len * step > h) Object.assign(s, makeStream(w, h, false));
    }

    const px = mouse.x / innerWidth - 0.5;
    const py = mouse.y / innerHeight - 0.5;
    for (const m of motes) {
      m.ph += m.sp * dt * 0.0016;
      const sx = m.x + Math.sin(m.ph) * 8 * m.z - px * 30 * m.z;
      const sy = m.y + Math.cos(m.ph * 0.8) * 6 * m.z - py * 22 * m.z;
      const a = (0.1 + 0.2 * m.z) * (0.55 + 0.45 * Math.sin(m.ph));
      rtx.fillStyle = `rgba(242, 234, 217, ${Math.max(0, a).toFixed(3)})`;
      rtx.beginPath();
      rtx.arc(sx, sy, m.r * m.z, 0, 6.283);
      rtx.fill();
    }
    rtx.globalAlpha = 1;
  }

  function sizeRain() {
    if (!rain) return;
    rain.width = Math.round(rain.clientWidth * DPR);
    rain.height = Math.round(rain.clientHeight * DPR);
  }

  /* ---------------- LOOP ---------------- */
  function sizeAll() {
    sizeGrid();
    sizeSphere();
    sizeRain();
    heroH = hero ? hero.offsetHeight : 0;
  }
  addEventListener('resize', () => {
    sizeAll();
    seedFX();
    if (reduced) { drawGrid(0); drawSphere(16, 0); drawRain(16, 0, 0.5); }
  });
  sizeAll();
  seedFX();

  function heroFade() {
    const scrollable = Math.max(1, heroH - innerHeight);
    const p = Math.min(1, Math.max(0, scrollY / scrollable));
    return p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.28);
  }

  if (reduced) {
    drawGrid(0);
    drawSphere(16, 0);
    drawRain(16, 0, 0.5);
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
      drawRain(dt, t, heroFade());
    } else {
      stx.clearRect(0, 0, sph.clientWidth, sph.clientHeight);
      if (rtx) rtx.clearRect(0, 0, rain.clientWidth, rain.clientHeight);
    }
    requestAnimationFrame(loop);
  })(last);
})();
