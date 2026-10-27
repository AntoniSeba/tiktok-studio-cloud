/* ---------- wiralowe napisy: słowo po słowie, ważne słowa na czerwono ---------- */
const cap = $("cap");
let capIdx = -1, capEls = [];
function drawCaption(t, s) {
  const i = CAPS.findIndex((c) => t >= c.t0 && t < c.t1);
  if (s.kind !== "broll" || i < 0) { cap.style.opacity = 0; return; }
  if (i !== capIdx) {
    capIdx = i;
    cap.innerHTML = "";
    capEls = CAPS[i].w.map((x) => { const e = document.createElement("span"); e.className = "cw" + (x.r ? " r" : ""); e.textContent = x.w; cap.appendChild(e); cap.appendChild(document.createTextNode(" ")); return e; });
  }
  cap.style.opacity = 1;
  const cy = s.capY != null ? s.capY : 1180;
  cap.style.top = Math.round(cy - cap.offsetHeight / 2) + "px";
  CAPS[i].w.forEach((x, k) => {
    const kk = backOut(win(t, x.t - 0.04, x.t + 0.1));
    capEls[k].style.opacity = clamp01(kk * 3).toFixed(3);
    capEls[k].style.transform = `scale(${(0.72 + 0.28 * kk).toFixed(3)})`;
  });
}
