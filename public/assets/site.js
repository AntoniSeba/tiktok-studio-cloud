// theme chosen in the app (auto = system setting)
try { const t = localStorage.getItem('tss-theme'); if (t && t !== 'auto') document.documentElement.dataset.theme = t; } catch {}
// site.js: tiny behaviour for the public pages (sticky header border).
// Wrapped so nothing leaks into globals (a top-level `top` would clash with window.top).
(() => {
  const header = document.getElementById('top');
  if (!header) return;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
