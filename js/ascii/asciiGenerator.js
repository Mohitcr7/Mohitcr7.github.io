/* ================================================================
   ASCII PORTRAIT · generator
   Converts a portrait image (transparent-background cutout) into a
   luminance-mapped character grid. Transparent pixels produce no
   cell, so the silhouette is preserved for free.
   ================================================================ */
window.AsciiGenerator = (() => {
  // Selectable density ramps, darkest → brightest
  const RAMPS = {
    classic: ' .:-=+*#%@',
    hacker: ' .:i1%#0@',
    blocks: ' ░▒▓█',
  };

  /* Load an image element (must be same-origin for pixel access). */
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /* Deterministic per-cell pseudo-random in [0,1) — stable across
     frames so decompile/reassemble thresholds don't jitter. */
  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  /**
   * generate(src, cols, opts) → { cols, rows, cells, bbox }
   * Each cell: { col, row, ch, v (0..1 brightness), r1..r3 (stable
   * randoms), eye (part of the eye/face highlight region) }
   */
  async function generate(src, cols, opts = {}) {
    const ramp = RAMPS[opts.ramp] || opts.ramp || RAMPS.classic;
    const img = await loadImage(src);

    // Optional source crop (fractions of the image) — trims the wide
    // shoulders to a bust so the face owns more of the grid.
    const crop = opts.crop || { x: 0, y: 0, w: 1, h: 1 };
    const sx = img.naturalWidth * crop.x;
    const sy = img.naturalHeight * crop.y;
    const sw = img.naturalWidth * crop.w;
    const sh = img.naturalHeight * crop.h;

    // Mono glyph cells are ~0.6 as wide as tall; compensate rows so
    // the portrait keeps its aspect ratio on screen.
    const CHAR_ASPECT = 0.6;
    const rows = Math.round((sh / sw) * cols * CHAR_ASPECT);

    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, sx, sy, sw, sh, 0, 0, cols, rows);
    const d = x.getImageData(0, 0, cols, rows).data;

    // Pass 1: collect subject pixels + luminance range for
    // histogram normalization (a dark suit must still read).
    const raw = [];
    let minL = 1, maxL = 0;
    let minC = cols, maxC = 0, minR = rows, maxR = 0;
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const i = (r * cols + col) * 4;
        const a = d[i + 3] / 255;
        if (a < 0.4) continue; // background — not part of the subject
        const lum = ((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255) * a;
        raw.push({ col, row: r, lum });
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
        if (col < minC) minC = col;
        if (col > maxC) maxC = col;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
      }
    }

    // Pass 2: normalize to the subject's own range, then map to ramp.
    const span = Math.max(0.001, maxL - minL);
    const cells = [];
    for (const px of raw) {
      const n = Math.pow((px.lum - minL) / span, 0.85);
      const v = 0.18 + n * 0.82;
      const ci = Math.max(1, Math.min(ramp.length - 1, Math.round(v * (ramp.length - 1))));
      const idx = px.row * cols + px.col;
      cells.push({
        col: px.col, row: px.row, ch: ramp[ci], v,
        r1: hash(idx), r2: hash(idx * 3 + 1), r3: hash(idx * 7 + 2),
        eye: false,
      });
    }

    const bbox = { minC, maxC, minR, maxR, w: maxC - minC + 1, h: maxR - minR + 1 };

    // Eye band, relative to the subject's bounding box. Tuned for a
    // head-and-shoulders crop: eyes sit ~a third down the bbox.
    const eyeTop = minR + bbox.h * 0.26;
    const eyeBot = minR + bbox.h * 0.38;
    const eyeL = minC + bbox.w * 0.32;
    const eyeR = minC + bbox.w * 0.68;
    for (const cell of cells) {
      cell.eye = cell.row >= eyeTop && cell.row <= eyeBot && cell.col >= eyeL && cell.col <= eyeR;
    }

    return { cols, rows, cells, bbox };
  }

  return { generate, RAMPS };
})();
