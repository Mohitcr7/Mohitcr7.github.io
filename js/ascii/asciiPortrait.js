/* ================================================================
   ASCII PORTRAIT · bootstrap
   Wires generator → renderer → animation controller onto the
   #asciiPortrait canvas, and plays a terminal boot sequence in the
   existing site loader while the grid is generated.
   ================================================================ */
(() => {
  const canvas = document.getElementById('asciiPortrait');
  if (!canvas) return;

  const SRC = 'assets/portrait-face.png';
  const RAMP = 'hacker'; // see AsciiGenerator.RAMPS

  /* Responsive density + crop. On wide screens the portrait is large,
     so a head-and-shoulders bust reads fine. On phones the canvas is
     small, so we crop TIGHT to the head (face owns the whole grid) and
     push the density up — otherwise the face gets too few cells to be
     recognizable. */
  const CROP_WIDE = { x: 0.14, y: 0.02, w: 0.72, h: 0.9 };
  const CROP_FACE = { x: 0.23, y: 0.19, w: 0.54, h: 0.6 };
  function pickConfig() {
    const w = innerWidth;
    if (w >= 1500) return { cols: 150, crop: CROP_WIDE };
    if (w >= 1100) return { cols: 132, crop: CROP_WIDE };
    if (w >= 720)  return { cols: 104, crop: CROP_WIDE };
    return { cols: 122, crop: CROP_FACE };
  }

  /* Terminal boot lines shown in the loader while we generate. */
  const BOOT_LINES = [
    'INITIALIZING NEURAL RENDERER…',
    'LOADING FACE MESH…',
    'GENERATING ASCII…',
    'OPTIMIZING CHARACTER DENSITY…',
    'COMPLETE.',
  ];
  function playBootSequence() {
    const label = document.querySelector('.loader-label');
    const loader = document.getElementById('loader');
    if (!label || !loader || loader.classList.contains('done')) return;
    BOOT_LINES.forEach((line, i) => {
      setTimeout(() => {
        if (!loader.classList.contains('done')) label.textContent = 'MOHIT.SYS // ' + line;
      }, 140 + i * 170);
    });
  }

  async function init() {
    playBootSequence();
    let cfg = pickConfig();
    const renderer = window.AsciiRenderer.create(canvas);

    let grid;
    try {
      grid = await window.AsciiGenerator.generate(SRC, cfg.cols, { ramp: RAMP, crop: cfg.crop });
    } catch (_) {
      return; // portrait asset missing — leave the hero clean
    }
    renderer.resize(); // layout is settled by now (generate() is async)
    renderer.setGrid(grid);

    // The portrait lives in the career section; it assembles + renders
    // only while that section is on screen.
    const trigger = document.getElementById('career');
    const anim = window.AsciiAnimation.create(renderer, grid, { trigger });
    anim.start();

    // Regenerate at a new density/crop when the breakpoint changes.
    let resizeTimer = 0;
    let sig = cfg.cols + ':' + JSON.stringify(cfg.crop);
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        const next = pickConfig();
        const nextSig = next.cols + ':' + JSON.stringify(next.crop);
        if (nextSig !== sig) {
          sig = nextSig;
          cfg = next;
          try {
            const g = await window.AsciiGenerator.generate(SRC, cfg.cols, { ramp: RAMP, crop: cfg.crop });
            // Mutate the shared grid object so the renderer AND the
            // animation controller both see the new density.
            Object.assign(grid, g);
            renderer.setGrid(grid);
          } catch (_) { /* keep current grid */ }
        }
      }, 250);
    });
  }

  init();
})();
