/* ================================================================
   ASCII PORTRAIT · animation controller
   Owns every piece of dynamic state and produces one `fx` object
   per frame for the renderer. Nothing here touches the canvas.

   States it blends:
   · assembly from binary when the career section scrolls into view
   · cursor tilt / parallax / magnetic morphing
   · flicker, 5s glitch, scanline, idle pulse, sparks, cursor blink
   ================================================================ */
window.AsciiAnimation = (() => {
  const MORPH_SET = '01+*@';
  const FLICK_SET = '01#%@';

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function create(renderer, grid, opts = {}) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const mouse = { x: innerWidth / 2, y: innerHeight * 0.42, tx: innerWidth / 2, ty: innerHeight * 0.42 };
    addEventListener('pointermove', (e) => { mouse.tx = e.clientX; mouse.ty = e.clientY; }, { passive: true });

    // The portrait stays intact on scroll — no decompile, no burst.

    const morphs = new Map();   // cellIndex → { ch, until }
    const flicker = new Map();  // cellIndex → { ch, dim, until }
    const glitchRows = new Set();
    const sparks = [];

    let bootT0 = -1;            // set when assembly starts
    let glitchUntil = 0, nextGlitch = 0, glitchX = 0;
    let nextFlick = 0, nextSpark = 0, nextIdle = 0;
    let idleT0 = -1;
    let eyeBoost = 0;
    let running = false;

    /* Kick off the load-in assembly. */
    function boot(t) { bootT0 = t; }

    function scheduleFrom(t) {
      nextGlitch = t + 5000;
      nextFlick = t + 400;
      nextSpark = t + 600;
      nextIdle = t + 20000;
    }

    /* Build the per-frame fx state. */
    function frame(t, dt) {
      // --- smooth mouse ---
      mouse.x += (mouse.tx - mouse.x) * 0.09;
      mouse.y += (mouse.ty - mouse.y) * 0.09;

      // --- canvas-local mouse: the portrait lives in the career
      //     column, offset from the viewport origin and scrolled ---
      const cr = renderer.rect();
      const lmx = mouse.x - cr.left;
      const lmy = mouse.y - cr.top;
      const lmouse = { x: lmx, y: lmy };

      // --- decompile level D: assembles from binary when the career
      //     section first scrolls in; stays intact thereafter ---
      let assembleD = 0;
      if (bootT0 === -1) {
        assembleD = 1; // not booted yet: fully scattered (invisible-ish)
      } else {
        const bp = clamp((t - bootT0) / 1100, 0, 1);
        assembleD = 1 - easeOutCubic(bp);
      }
      const D = clamp(assembleD, 0, 1.6);
      const alpha = 1; // always fully present within its column

      // --- tilt (max ~4°), parallax (slower than mouse), float ---
      const yaw = clamp((mouse.x / innerWidth - 0.5) * 0.14, -0.07, 0.07);
      const pitch = clamp((mouse.y / innerHeight - 0.5) * 0.1, -0.05, 0.05);
      const px = (mouse.x - innerWidth / 2) * 0.015;
      const py = (mouse.y - innerHeight / 2) * 0.012;
      const floatY = Math.sin(t * 0.0007) * 3;

      // --- cursor-proximity morphs (settled cells only) ---
      if (!reduced && D < 0.2) {
        const rect = renderer.subjectRect();
        if (lmx > rect.x - 60 && lmx < rect.x + rect.w + 60 &&
            lmy > rect.y - 60 && lmy < rect.y + rect.h + 60) {
          // sample a few random cells near the cursor each frame
          for (let n = 0; n < 3; n++) {
            const i = (Math.random() * grid.cells.length) | 0;
            const cell = grid.cells[i];
            const cx = rect.x + ((cell.col - grid.bbox.minC + 0.5) / grid.bbox.w) * rect.w;
            const cy = rect.y + ((cell.row - grid.bbox.minR + 0.5) / grid.bbox.h) * rect.h;
            if (Math.hypot(cx - lmx, cy - lmy) < 90 && !morphs.has(i)) {
              morphs.set(i, { ch: MORPH_SET[(Math.random() * MORPH_SET.length) | 0], until: t + 260 + Math.random() * 380 });
            }
          }
        }
        for (const [i, m] of morphs) if (t > m.until) morphs.delete(i);
        // eye highlight while hovering the subject
        const over = lmx > rect.x && lmx < rect.x + rect.w && lmy > rect.y && lmy < rect.y + rect.h;
        eyeBoost += ((over ? 1 : 0) - eyeBoost) * 0.06;
      }

      // --- scheduled flicker: a handful of cells at a time ---
      if (!reduced && t > nextFlick) {
        nextFlick = t + 260 + Math.random() * 500;
        for (let n = 0; n < 5; n++) {
          const i = (Math.random() * grid.cells.length) | 0;
          flicker.set(i, {
            ch: Math.random() < 0.5 ? FLICK_SET[(Math.random() * FLICK_SET.length) | 0] : null,
            dim: 0.4 + Math.random() * 0.9,
            until: t + 90 + Math.random() * 200,
          });
        }
      }
      for (const [i, f] of flicker) if (t > f.until) flicker.delete(i);

      // --- row glitch every 5 seconds ---
      if (!reduced && t > nextGlitch) {
        nextGlitch = t + 5000;
        glitchUntil = t + 150;
        glitchRows.clear();
        const base = grid.bbox.minR + ((Math.random() * grid.bbox.h) | 0);
        glitchRows.add(base).add(base + 1).add(base + 2);
        glitchX = (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5);
      }
      if (t > glitchUntil) glitchRows.clear();

      // --- idle breathe every ~20s ---
      if (!reduced && t > nextIdle) { nextIdle = t + 20000; idleT0 = t; }
      let pulse = 1;
      if (idleT0 >= 0) {
        const ip = (t - idleT0) / 1600;
        if (ip < 1) pulse = 1 + Math.sin(ip * Math.PI) * 0.12;
        else idleT0 = -1;
      }

      // --- stray pixels around the silhouette ---
      if (!reduced && t > nextSpark) {
        nextSpark = t + 350 + Math.random() * 500;
        const rect = renderer.subjectRect();
        const ang = Math.random() * Math.PI * 2;
        sparks.push({
          x: rect.x + rect.w / 2 + Math.cos(ang) * (rect.w * 0.55 + Math.random() * 40),
          y: rect.y + rect.h / 2 + Math.sin(ang) * (rect.h * 0.55 + Math.random() * 30),
          life: 1,
        });
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        sparks[i].life -= dt / 1200;
        sparks[i].y -= dt * 0.008;
        if (sparks[i].life <= 0) sparks.splice(i, 1);
      }

      return {
        t, D, alpha,
        yaw: reduced ? 0 : yaw,
        pitch: reduced ? 0 : pitch,
        px: reduced ? 0 : px,
        py: reduced ? 0 : py,
        floatY: reduced ? 0 : floatY,
        mouse: lmouse, morphs, flicker, glitchRows, glitchX,
        scanY: reduced ? -1 : (t % 7000) / 7000,
        pulse, eyeBoost, sparks,
        cursorOn: reduced ? false : ((t / 530) | 0) % 2 === 0,
      };
    }

    /* Main loop — renders only while the trigger (career section) is
       on screen, and assembles from binary the first time it enters. */
    function start() {
      if (running) return;
      running = true;

      const trigger = opts.trigger || null;

      if (reduced) {
        // Static assembled portrait, drawn once it scrolls into view.
        bootT0 = -Infinity;
        const drawStatic = () => { renderer.resize(); renderer.draw(frame(performance.now(), 16)); };
        addEventListener('resize', drawStatic);
        if (trigger) {
          const io = new IntersectionObserver((es) => {
            if (es.some((e) => e.isIntersecting)) drawStatic();
          });
          io.observe(trigger);
        } else drawStatic();
        return;
      }

      addEventListener('resize', () => renderer.resize());

      let visible = !trigger;
      let booted = false;
      const igniteIfReady = () => {
        if (!visible || booted) return;
        booted = true;
        const now = performance.now();
        renderer.resize();  // ensure sized to the settled column
        scheduleFrom(now);
        boot(now + 40);     // assemble from binary on first reveal
      };
      if (trigger) {
        const io = new IntersectionObserver((es) => {
          visible = es.some((e) => e.isIntersecting);
          igniteIfReady();
        }, { rootMargin: '-8% 0px' });
        io.observe(trigger);
      } else {
        igniteIfReady();
      }

      let last = performance.now();
      (function loop(t) {
        const dt = Math.min(50, t - last);
        last = t;
        if (visible) renderer.draw(frame(t, dt));
        requestAnimationFrame(loop);
      })(last);
    }

    return { start };
  }

  return { create };
})();
