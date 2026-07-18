/* ================================================================
   ASCII PORTRAIT · renderer
   Draws the character grid to a full-bleed transparent canvas.
   Performance model: one font set per frame, cells grouped into
   quantized-alpha buckets so fillStyle changes stay ~12/frame
   regardless of cell count. No DOM nodes, no per-cell styles.
   ================================================================ */
window.AsciiRenderer = (() => {
  const GREEN = '0, 220, 130'; // --emerald

  function create(canvas) {
    const ctx = canvas.getContext('2d');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0, H = 0;
    let grid = null;          // { cols, rows, cells, bbox }
    let cellW = 0, cellH = 0; // screen size of one character cell
    let originX = 0, originY = 0; // top-left of the grid on screen
    let anchorY = 0; // subject centre — rotation/tilt pivot

    function resize() {
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      if (grid) measure();
    }

    /* Fit and CENTRE the subject's bounding box within this dedicated
       canvas (the career-log column). Fills ~90% of the tighter axis
       so the bust is large and cleanly visible. */
    function measure() {
      const b = grid.bbox;
      cellH = Math.min((H * 0.99) / b.h, (W * 0.96) / (b.w * 0.6));
      cellW = cellH * 0.6;
      originX = W / 2 - (b.minC + b.w / 2) * cellW;
      originY = H / 2 - (b.minR + b.h / 2) * cellH;
      anchorY = originY + (b.minR + b.h / 2) * cellH;
    }

    function setGrid(g) {
      grid = g;
      measure();
    }

    /* Screen-space bounding box of the subject (for hover tests). */
    function subjectRect() {
      const b = grid.bbox;
      return {
        x: originX + b.minC * cellW,
        y: originY + b.minR * cellH,
        w: b.w * cellW,
        h: b.h * cellH,
      };
    }

    /**
     * draw(fx) — fx is the per-frame state from the controller:
     * { t, D, alpha, yaw, pitch, px, py, floatY, mouse, morphs,
     *   flicker, glitchRows, glitchX, scanY, pulse, eyeBoost,
     *   sparks, cursorOn }
     */
    function draw(fx) {
      // Guard: recover if we were created before first layout
      if (canvas.clientWidth !== W || canvas.clientHeight !== H) resize();
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!grid || fx.alpha <= 0) return;

      // --- portrait-space transform: tilt about centre, then
      //     parallax/float offset ---
      const pcx = W / 2, pcy = anchorY;
      ctx.translate(pcx + fx.px, pcy + fx.py + fx.floatY);
      ctx.rotate(fx.yaw * 0.12);
      ctx.transform(1 - Math.abs(fx.yaw) * 0.35, fx.pitch * 0.05, 0, 1, 0, 0);
      ctx.translate(-pcx, -pcy);

      ctx.globalAlpha = fx.alpha;
      ctx.font = `${cellH.toFixed(1)}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // --- bucket cells by quantized alpha (0.05 steps) ---
      const buckets = new Map();
      const mx = fx.mouse.x, my = fx.mouse.y;
      const binT = (fx.t / 90) | 0;

      for (let i = 0; i < grid.cells.length; i++) {
        const cell = grid.cells[i];
        let x = originX + (cell.col + 0.5) * cellW;
        let y = originY + (cell.row + 0.5) * cellH;
        let ch = cell.ch;
        let a = 0.3 + cell.v * 0.65;

        // Decompile: cells whose threshold is passed fall away as
        // raw binary; drives page-load assembly AND scroll scatter.
        const loose = fx.D - cell.r1;
        if (loose > 0) {
          ch = (binT + i) % 2 ? '1' : '0';
          y += loose * loose * H * (0.7 + cell.r2 * 0.8);
          x += (cell.r3 - 0.5) * loose * 140;
          a *= Math.max(0, 1 - loose * 1.7);
          if (a < 0.02) continue;
        } else {
          // Settled cell: cursor morphing + magnetic push
          const dx = x - mx, dy = y - my;
          const dd = Math.hypot(dx, dy);
          if (dd < 90 && dd > 0.01) {
            const k = 1 - dd / 90;
            a = Math.min(1, a + k * 0.55);
            x += (dx / dd) * k * k * 7;
            y += (dy / dd) * k * k * 7;
            const m = fx.morphs.get(i);
            if (m) ch = m.ch;
          }
          // Eye/glasses highlight on hover — subtle
          if (cell.eye) a = Math.min(1, a + fx.eyeBoost * 0.22);
          // Scheduled flicker cells
          const f = fx.flicker.get(i);
          if (f) { ch = f.ch || ch; a *= f.dim; }
          // Row glitch offset
          if (fx.glitchRows.has(cell.row)) x += fx.glitchX;
          // Idle brightness breathe
          a *= fx.pulse;
        }

        const q = Math.max(0.05, Math.min(1, Math.round(a * 20) / 20));
        let b = buckets.get(q);
        if (!b) { b = []; buckets.set(q, b); }
        b.push(x, y, ch.charCodeAt(0) === 32 ? '.' : ch);
      }

      for (const [q, arr] of buckets) {
        ctx.fillStyle = `rgba(${GREEN}, ${q})`;
        for (let j = 0; j < arr.length; j += 3) {
          ctx.fillText(arr[j + 2], arr[j], arr[j + 1]);
        }
      }

      // --- scanline: a faint bar sweeping down the subject ---
      const rect = subjectRect();
      if (fx.scanY >= 0) {
        const sy = rect.y + rect.h * fx.scanY;
        const gradient = ctx.createLinearGradient(0, sy - 14, 0, sy + 14);
        gradient.addColorStop(0, `rgba(${GREEN}, 0)`);
        gradient.addColorStop(0.5, `rgba(${GREEN}, 0.07)`);
        gradient.addColorStop(1, `rgba(${GREEN}, 0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(rect.x - 20, sy - 14, rect.w + 40, 28);
      }

      // --- stray pixels drifting around the silhouette ---
      for (const s of fx.sparks) {
        ctx.fillStyle = `rgba(${GREEN}, ${(s.life * 0.35).toFixed(3)})`;
        ctx.fillRect(s.x, s.y, 2, 2);
      }

      // --- blinking terminal cursor beside the portrait (left side —
      //     the right edge is flush with the viewport) ---
      if (fx.cursorOn) {
        ctx.fillStyle = `rgba(${GREEN}, 0.75)`;
        ctx.fillRect(rect.x + rect.w + 10, rect.y + rect.h * 0.1, cellW * 0.9, cellH * 1.1);
      }

      ctx.globalAlpha = 1;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    resize();
    return {
      resize, setGrid, subjectRect, draw,
      rect: () => canvas.getBoundingClientRect(),
      get size() { return { W, H }; },
    };
  }

  return { create };
})();
