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
  // Bust crop: trim the outer shoulders so the face owns the grid.
  const CROP = { x: 0.14, y: 0.02, w: 0.72, h: 0.9 };

  /* Responsive column counts — higher density on wide screens where
     the portrait is large, so the face stays crisp and recognizable. */
  function pickCols() {
    if (innerWidth >= 1500) return 150;
    if (innerWidth >= 1100) return 132;
    if (innerWidth >= 720) return 104;
    return 70;
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
    let cols = pickCols();
    const renderer = window.AsciiRenderer.create(canvas);

    let grid;
    try {
      grid = await window.AsciiGenerator.generate(SRC, cols, { ramp: RAMP, crop: CROP });
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

    // Regenerate at a different density when the breakpoint changes.
    let resizeTimer = 0;
    addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(async () => {
        const next = pickCols();
        if (next !== cols) {
          cols = next;
          try {
            const g = await window.AsciiGenerator.generate(SRC, cols, { ramp: RAMP, crop: CROP });
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
