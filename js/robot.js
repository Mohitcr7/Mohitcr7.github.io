/* ================================================================
   MOHIT — Finale companion robot
   Interactive Spline scene (cursor-tracking robot) rendered with
   the official vanilla runtime — no React/build step needed.
   Lazy-loads only when the visitor nears the finale.
   ================================================================ */
(() => {
  const canvas = document.getElementById('robotCanvas');
  const wrap = document.getElementById('finaleRobot');
  const tag = document.getElementById('robotTag');
  if (!canvas || !wrap) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) {
    wrap.classList.add('off');
    if (tag) tag.classList.add('off');
    return;
  }

  const SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode';
  const RUNTIME = 'https://unpkg.com/@splinetool/runtime@1/build/runtime.js';

  let started = false;
  const io = new IntersectionObserver((entries) => {
    if (started || !entries.some((e) => e.isIntersecting)) return;
    started = true;
    io.disconnect();
    if (tag) tag.textContent = 'MOHIT.BOT // BOOTING…';

    import(RUNTIME)
      .then(({ Application }) => {
        const app = new Application(canvas);
        return app.load(SCENE);
      })
      .then(() => {
        wrap.classList.add('on');
        if (tag) tag.textContent = 'MOHIT.BOT // ONLINE';
      })
      .catch(() => {
        // Offline / blocked CDN: keep the finale clean, no dead canvas
        wrap.classList.add('off');
        if (tag) tag.textContent = 'MOHIT.BOT // OFFLINE';
      });
  }, { rootMargin: '800px 0px' });

  io.observe(wrap);
})();
