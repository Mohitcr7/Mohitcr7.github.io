/* ================================================================
   MOHIT — Cinematic Scroll Portfolio
   Lenis smooth scroll + GSAP ScrollTrigger
   Hero: canvas frame-sequence scrub (360° orbit)
   ================================================================ */

gsap.registerPlugin(ScrollTrigger);

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Smooth scroll (Lenis) ---------- */
const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1 });
window.lenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

document.querySelectorAll('[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    lenis.scrollTo(a.getAttribute('href'), { offset: 0, duration: 1.6 });
  });
});

/* ================================================================
   HERO — boot sequence
   The ASCII data-sphere (backdrop.js) is the hero centerpiece;
   the loader is a short cosmetic sweep, no assets to fetch.
   ================================================================ */
const loaderEl = document.getElementById('loader');
const loaderFill = document.getElementById('loaderFill');
const loaderPct = document.getElementById('loaderPct');

function setLoader(p) {
  const pct = Math.round(p * 100);
  loaderFill.style.width = pct + '%';
  loaderPct.textContent = pct + '%';
}

function finishLoader() {
  setLoader(1);
  setTimeout(() => loaderEl.classList.add('done'), 350);
  introReveal();
  typeCerts();
}

/* ================================================================
   HERO — certifications typewriter (coding-style load)
   Types each line char-by-char: "> ORG :: credential", org in bold,
   with a blinking caret that rides the active line.
   ================================================================ */
function typeCerts() {
  const lines = gsap.utils.toArray('.cert-line');
  if (!lines.length) return;
  gsap.to('.hero-certs', { opacity: 1, duration: 0.5, ease: 'power2.out' });

  const segsFor = (el) => [
    { text: '> ', cls: 'cert-sep' },
    { text: el.dataset.org, cls: 'org' },
    { text: ' :: ', cls: 'cert-sep' },
    { text: el.dataset.text, cls: '' },
  ];

  if (prefersReduced) {
    lines.forEach((el) => {
      el.innerHTML = segsFor(el).map((s) =>
        s.cls === 'org' ? `<b>${s.text}</b>`
          : s.cls ? `<span class="${s.cls}">${s.text}</span>` : s.text
      ).join('');
    });
    return;
  }

  const caret = document.createElement('span');
  caret.className = 'cert-caret';
  let li = 0;

  function typeLine() {
    if (li >= lines.length) return; // caret stays blinking on the last line
    const el = lines[li];
    el.appendChild(caret);
    const segs = segsFor(el);
    let si = 0, ci = 0, node = null;
    const iv = setInterval(() => {
      const seg = segs[si];
      if (!node) {
        node = seg.cls === 'org' ? document.createElement('b') : document.createElement('span');
        if (seg.cls && seg.cls !== 'org') node.className = seg.cls;
        el.insertBefore(node, caret);
      }
      node.textContent += seg.text[ci++];
      if (ci >= seg.text.length) { si++; ci = 0; node = null; }
      if (si >= segs.length) {
        clearInterval(iv);
        li++;
        setTimeout(typeLine, 200);
      }
    }, 16);
  }
  setTimeout(typeLine, 600);
}

document.body.classList.add('no-frames');
gsap.set('.hero-content', { y: '-22vh' }); // lift the type clear of the heritage half
(function bootLoader() {
  let p = 0;
  const iv = setInterval(() => {
    p = Math.min(1, p + 0.22 + Math.random() * 0.2);
    setLoader(p);
    if (p >= 1) { clearInterval(iv); finishLoader(); }
  }, 110);
})();

/* ---------- Hero scrub + kinetic title ---------- */
const letters = gsap.utils.toArray('.ht-letter');
const reg = document.querySelector('.ht-reg');

gsap.set(letters, { yPercent: 120, opacity: 0 });
gsap.set(reg, { scale: 0, opacity: 0 });
gsap.set('.hero-kicker', { opacity: 0, y: 16 });
gsap.set('.hero-sub', { opacity: 0, y: 24 });

function introReveal() {
  const tl = gsap.timeline({ delay: 0.25 });
  tl.to(letters, {
    yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.09, ease: 'power4.out',
  })
    .to(reg, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.5)' }, '-=0.5')
    .to('.hero-kicker', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.7')
    .to('.hero-sub', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.45');
}

ScrollTrigger.create({
  trigger: '.hero',
  start: 'top top',
  end: 'bottom bottom',
  scrub: 0.4,
  onUpdate: (self) => {
    // Kinetic type: title drifts up & tightens as the dive proceeds
    const p = self.progress;
    gsap.set('.hero-content', {
      yPercent: -p * 26,
      opacity: 1 - Math.max(0, (p - 0.55)) * 2.4,
    });
    gsap.set('.hero-scrollcue', { opacity: 1 - p * 4 });
    // HUD + certs fade as the hero scrolls away (sphere dives on its own)
    gsap.set('.hud', { opacity: Math.max(0, 1 - p * 1.6) });
    gsap.set('.hero-certs', { opacity: Math.max(0, 1 - p * 2.2) });
  },
});

/* ================================================================
   STATS — count-up on enter
   ================================================================ */
/* Counts wind up/down with scroll (scrubbed both directions) */
gsap.utils.toArray('.count').forEach((el) => {
  const target = parseFloat(el.dataset.target);
  const suffix = el.dataset.suffix || '';
  ScrollTrigger.create({
    trigger: el,
    start: 'top 94%',
    end: 'top 55%',
    scrub: 0.4,
    onUpdate: (self) => { el.textContent = Math.round(target * self.progress) + suffix; },
  });
});

/* Cards fade/rise in and out with scroll */
gsap.utils.toArray('.dcard').forEach((el) => {
  gsap.fromTo(el,
    { opacity: 0, y: 48 },
    {
      opacity: 1, y: 0, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 98%', end: 'top 72%', scrub: 0.4 },
    });
});

/* ================================================================
   TELEMETRY DASHBOARD — gauges, lollipops, growth chart
   ================================================================ */
function radialTicks(groupId, cx, cy, r0, r1, a0, a1, n) {
  const g = document.getElementById(groupId);
  if (!g) return;
  for (let i = 0; i < n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('x1', (cx + r0 * cos).toFixed(1));
    l.setAttribute('y1', (cy + r0 * sin).toFixed(1));
    l.setAttribute('x2', (cx + r1 * cos).toFixed(1));
    l.setAttribute('y2', (cy + r1 * sin).toFixed(1));
    g.appendChild(l);
  }
}
radialTicks('gaugeTicks', 110, 110, 88, 98, -210, 30, 48);
radialTicks('meterTicks', 120, 124, 92, 100, -180, 0, 36);

// Radial gauge sweep (arc length = r * span = 78 * 240° ≈ 326.7; fill 78%) — scrubbed
gsap.fromTo('#gaugeVal',
  { strokeDasharray: 326.7, strokeDashoffset: 326.7 },
  {
    strokeDashoffset: 326.7 * 0.22, ease: 'none',
    scrollTrigger: { trigger: '#gaugeVal', start: 'top 94%', end: 'top 45%', scrub: 0.5 },
  });

// Speedometer sweep (arc length = 86π ≈ 270.2; fill 70%) + needle — scrubbed
gsap.fromTo('#meterVal',
  { strokeDasharray: 270.2, strokeDashoffset: 270.2 },
  {
    strokeDashoffset: 270.2 * 0.3, ease: 'none',
    scrollTrigger: { trigger: '#meterVal', start: 'top 94%', end: 'top 45%', scrub: 0.5 },
  });
gsap.fromTo('#needle',
  { rotation: -84, svgOrigin: '120 124' },
  {
    rotation: 40, ease: 'power1.inOut',
    scrollTrigger: { trigger: '#needle', start: 'top 94%', end: 'top 40%', scrub: 0.5 },
  });
// live wobble rides on the wrapper group so it composes with the scrubbed needle
if (!prefersReduced) {
  gsap.fromTo('#needleWrap',
    { rotation: -2, svgOrigin: '120 124' },
    { rotation: 2, duration: 1.5, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

// Lollipops rise from the baseline, heads pop after — scrubbed
const lolliTl = gsap.timeline({
  scrollTrigger: { trigger: '#lolliGroup', start: 'top 94%', end: 'top 40%', scrub: 0.5 },
});
gsap.utils.toArray('#lolliGroup .lolli-stick').forEach((stick, i) => {
  const head = stick.nextElementSibling;
  const topY = stick.getAttribute('y2');
  lolliTl.fromTo(stick, { attr: { y2: 160 } }, { attr: { y2: topY }, duration: 0.5, ease: 'power1.out' }, i * 0.07);
  lolliTl.fromTo(head, { attr: { cy: 160 }, opacity: 0 }, { attr: { cy: topY }, opacity: 1, duration: 0.5, ease: 'power1.out' }, i * 0.07 + 0.05);
});

// Growth chart draws itself with scroll; end dot ignites, then pulses live
const chartTl = gsap.timeline({
  scrollTrigger: { trigger: '#chartLine', start: 'top 94%', end: 'top 40%', scrub: 0.5 },
});
chartTl.fromTo('#chartLine',
  { strokeDasharray: 1, strokeDashoffset: 1 },
  { strokeDashoffset: 0, duration: 1.8, ease: 'none' });
chartTl.fromTo('#chartDot',
  { scale: 0, opacity: 0, svgOrigin: '620 58' },
  { scale: 1, opacity: 1, duration: 0.3, ease: 'power1.out' }, '-=0.15');
if (!prefersReduced) {
  gsap.to('#chartDot', { attr: { r: 6.5 }, duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

/* ================================================================
   PILLARS — pinned sequential reveal over builder clip
   ================================================================ */
const pillars = gsap.utils.toArray('.pillar');
pillars.forEach((p) => gsap.set(p, { autoAlpha: 0, y: 60 }));

const pillarTl = gsap.timeline({
  scrollTrigger: {
    trigger: '.pillars',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.5,
  },
});

pillars.forEach((p, i) => {
  pillarTl.to(p, { autoAlpha: 1, y: 0, duration: 1, ease: 'power2.out' });
  // Isometric icon draws itself in stroke-by-stroke alongside the reveal
  const strokes = p.querySelectorAll('.pillar-icon [pathLength]:not(.orbit)');
  if (strokes.length) {
    pillarTl.to(strokes, { strokeDashoffset: 0, duration: 1.6, stagger: 0.05, ease: 'none' }, '<');
  }
  pillarTl.to({}, { duration: 1.4 }); // hold
  if (i < pillars.length - 1) {
    pillarTl.to(p, { autoAlpha: 0, y: -60, duration: 1, ease: 'power2.in' });
  }
});

/* ---------- Icon live layers: packets, scan sweep, cursor tilt ---------- */
if (!prefersReduced) {
  document.querySelectorAll('.pillar-icon svg').forEach((svg) => {
    // data packets travel along every dashed link
    svg.querySelectorAll('line.dash').forEach((ln, i) => {
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '2');
      c.setAttribute('class', 'packet');
      svg.appendChild(c);
      gsap.fromTo(c,
        { attr: { cx: +ln.getAttribute('x1'), cy: +ln.getAttribute('y1') }, opacity: 0 },
        {
          attr: { cx: +ln.getAttribute('x2'), cy: +ln.getAttribute('y2') }, opacity: 1,
          duration: 1.3 + (i % 3) * 0.4, delay: i * 0.45,
          repeat: -1, repeatDelay: 0.9, ease: 'power1.inOut',
        });
    });
    // scan line sweeps across the platform
    const scan = svg.querySelector('.scan');
    if (scan) {
      gsap.fromTo(scan,
        { x: 0, y: 0, opacity: 0.6 },
        {
          x: +scan.dataset.dx, y: +scan.dataset.dy, opacity: 0.1,
          duration: 3.2, repeat: -1, repeatDelay: 1.1, ease: 'none',
        });
    }
  });
  // subtle parallax tilt toward the cursor
  const tilts = gsap.utils.toArray('.icon-tilt');
  window.addEventListener('pointermove', (e) => {
    const nx = e.clientX / innerWidth - 0.5;
    const ny = e.clientY / innerHeight - 0.5;
    tilts.forEach((el) => gsap.to(el, { x: nx * 20, y: ny * 14, duration: 0.9, ease: 'power2.out' }));
  }, { passive: true });
}

/* ================================================================
   WORK — card reveals + hover tilt
   ================================================================ */
gsap.utils.toArray('.card').forEach((card) => {
  gsap.from(card, {
    opacity: 0, y: 90, duration: 1.1, ease: 'power3.out',
    scrollTrigger: { trigger: card, start: 'top 82%', once: true },
  });

  if (!prefersReduced) {
    card.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -3;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 3;
      gsap.to(card, { rotationX: rx, rotationY: ry, transformPerspective: 900, duration: 0.5, ease: 'power2.out' });
    });
    card.addEventListener('mouseleave', () => {
      gsap.to(card, { rotationX: 0, rotationY: 0, duration: 0.7, ease: 'elastic.out(1, 0.5)' });
    });
  }
});

/* ================================================================
   CAREER — timeline rail fill + entry reveals
   ================================================================ */
gsap.to('.timeline-rail-fill', {
  scaleY: 1,
  ease: 'none',
  scrollTrigger: {
    trigger: '.timeline',
    start: 'top 75%',
    end: 'bottom 55%',
    scrub: 0.4,
  },
});

gsap.utils.toArray('.tl-entry').forEach((entry) => {
  gsap.from(entry, {
    opacity: 0, x: -36, duration: 0.9, ease: 'power3.out',
    scrollTrigger: { trigger: entry, start: 'top 82%', once: true },
  });
});

/* ================================================================
   FINALE — line reveals + magnetic buttons
   ================================================================ */
gsap.utils.toArray('.finale-line').forEach((line, i) => {
  gsap.to(line, {
    y: 0, duration: 1.2, ease: 'power4.out', delay: i * 0.12,
    scrollTrigger: { trigger: '.finale', start: 'top 65%', once: true },
  });
});
gsap.set('.finale-line', { y: '110%' });

gsap.from('.finale-cta', {
  opacity: 0, y: 40, duration: 1, ease: 'power3.out', delay: 0.4,
  scrollTrigger: { trigger: '.finale', start: 'top 60%', once: true },
});

if (!prefersReduced) {
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - r.left - r.width / 2) * 0.25,
        y: (e.clientY - r.top - r.height / 2) * 0.25,
        duration: 0.4, ease: 'power2.out',
      });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    });
  });
}
