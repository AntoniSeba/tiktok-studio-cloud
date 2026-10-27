// Fragmenty do wklejania przez javascript_tool w karcie z SUROWYM podglądem:
//   http://localhost:<port>/api/projects/<id>/preview/index.html
// Nigdy w karcie "seed" (ona sama przełącza się na Studio). Otwórz nową kartę (tabs_create),
// ustaw viewport 1080x1920 (resize_window), przeładuj stronę i odczekaj ok. 5 s.

// 1. Przygotowanie: #root ma w surowym podglądzie wysokość 0, a fonty trzeba wczytać ręcznie.
document.documentElement.style.height = '1920px';
document.body.style.height = '1920px';
document.getElementById('root').style.height = '1920px';
const st = document.createElement('style');
st.textContent = "@font-face{font-family:Oswald;font-weight:600;src:url(.dbgfonts/osw/600-normal-36a8cb33d2c5.woff2)}" +
  " @font-face{font-family:'IBM Plex Mono';font-weight:600;src:url(.dbgfonts/plex/600-normal-86bf5ff03242.woff2)}" +
  " @font-face{font-family:'IBM Plex Mono';font-weight:400;src:url(.dbgfonts/plex/600-normal-86bf5ff03242.woff2)}";
document.head.appendChild(st);
// snapAt: renderuje klatkę i kopiuje canvas do <img>, bo zrzut ekranu nie łapie WebGL bez preserveDrawingBuffer
window.snapAt = (t) => {
  window.__renderAt(t);
  let im = document.getElementById('dbgImg');
  if (!im) { im = document.createElement('img'); im.id = 'dbgImg'; im.style.cssText = 'position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:0'; document.getElementById('root').appendChild(im); }
  im.src = document.getElementById('gl').toDataURL();
  document.getElementById('gl').style.visibility = 'hidden';
  return t;
};
await document.fonts.load('600 40px Oswald'); await document.fonts.load('600 40px "IBM Plex Mono"');
snapAt(0);
// potem: snapAt(12.3) + computer screenshot scale 0.3 (kilka par w jednym browser_batch)

// 2. Szew pętli: różnica t=0 kontra t=D ma być wielokrotnie mniejsza niż między sąsiednimi klatkami.
// Liczyć synchronicznie, w osobnym wywołaniu (długi async w javascript_tool wisi).
const cv = document.getElementById('gl'); const sm = document.createElement('canvas'); sm.width = 108; sm.height = 192;
const g = sm.getContext('2d');
window.grab = (t) => { window.__renderAt(t); g.drawImage(cv, 0, 0, 108, 192); return g.getImageData(0, 0, 108, 192).data; };
const D = 166.18; // czas filmu
const a = grab(0), b = grab(D), c = grab(1 / 30);
let d1 = 0, d2 = 0;
for (let i = 0; i < a.length; i += 4) { d1 += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]); d2 += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]); }
[(d1 / (108 * 192)).toFixed(3), (d2 / (108 * 192)).toFixed(3)]; // np. ["0.142", "3.043"] = szew niewidoczny

// 3. Sprawdzenie elementu SVG, którego nie widać (np. linia wymiaru pod gradientem shade-bot):
// [...document.getElementById('dim').children].map(c => [c.getAttribute('opacity'), c.children[0].getAttribute('d')])
