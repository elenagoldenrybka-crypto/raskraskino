// Проверка картинок для онлайн-раскрашивания заливкой.
// Читает PNG (без сторонних библиотек), находит замкнутые области и оценивает,
// не «протекает» ли заливка: если почти весь рисунок — одна область, раскраска для заливки не годится.
const fs = require("fs");
const zlib = require("zlib");

function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, pal = null, trns = null;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString("ascii", p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (t === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; }
    else if (t === "PLTE") pal = d;
    else if (t === "tRNS") trns = d;
    else if (t === "IDAT") idat.push(d);
    else if (t === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || inter) return null;
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0, up = y ? out[dst - stride + x] : 0, c = x >= ch && y ? out[dst - stride + x - ch] : 0;
      let v = raw[src + x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[dst + x] = v & 255;
    }
  }
  const lum = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, al = 255;
    if (type === 0) r = g = bl = out[i];
    else if (type === 4) { r = g = bl = out[i * 2]; al = out[i * 2 + 1]; }
    else if (type === 2) { r = out[i * 3]; g = out[i * 3 + 1]; bl = out[i * 3 + 2]; }
    else if (type === 6) { r = out[i * 4]; g = out[i * 4 + 1]; bl = out[i * 4 + 2]; al = out[i * 4 + 3]; }
    else { const k = out[i]; r = pal[k * 3]; g = pal[k * 3 + 1]; bl = pal[k * 3 + 2]; if (trns && k < trns.length) al = trns[k]; }
    const l = (r * 299 + g * 587 + bl * 114) / 1000;
    lum[i] = Math.round(l * al / 255 + 255 * (1 - al / 255));
  }
  return { w, h, lum };
}

// Стенки = тёмные пиксели, расширенные на R пикселей (закрывает мелкие разрывы в линиях)
function walls(img, R) {
  const { w, h, lum } = img, wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (lum[i] < 165) wall[i] = 1;
  if (!R) return wall;
  const tmp = new Uint8Array(w * h), res = new Uint8Array(w * h);
  let x, y, run;
  for (y = 0; y < h; y++) { run = -1e9; for (x = 0; x < w; x++) { if (wall[y * w + x]) run = x; if (x - run <= R) tmp[y * w + x] = 1; } run = 1e9; for (x = w - 1; x >= 0; x--) { if (wall[y * w + x]) run = x; if (run - x <= R) tmp[y * w + x] = 1; } }
  for (x = 0; x < w; x++) { run = -1e9; for (y = 0; y < h; y++) { if (tmp[y * w + x]) run = y; if (y - run <= R) res[y * w + x] = 1; } run = 1e9; for (y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) run = y; if (run - y <= R) res[y * w + x] = 1; } }
  return res;
}

function regions(wall, w, h) {
  const lab = new Int32Array(w * h), sizes = [], border = [];
  const st = [];
  let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (wall[s] || lab[s]) continue;
    n++; let size = 0, touch = false; lab[s] = n; st.push(s);
    while (st.length) {
      const p = st.pop(), y = (p / w) | 0, x = p - y * w; size++;
      if (!x || !y || x === w - 1 || y === h - 1) touch = true;
      if (x > 0 && !wall[p - 1] && !lab[p - 1]) { lab[p - 1] = n; st.push(p - 1); }
      if (x < w - 1 && !wall[p + 1] && !lab[p + 1]) { lab[p + 1] = n; st.push(p + 1); }
      if (y > 0 && !wall[p - w] && !lab[p - w]) { lab[p - w] = n; st.push(p - w); }
      if (y < h - 1 && !wall[p + w] && !lab[p + w]) { lab[p + w] = n; st.push(p + w); }
    }
    sizes.push(size); border.push(touch);
  }
  return { sizes, border };
}

// Заливка с краёв листа: какие пиксели связаны с внешним фоном
function outside(wall, w, h) {
  const out = new Uint8Array(w * h), st = [];
  const push = (p) => { if (!wall[p] && !out[p]) { out[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (st.length) {
    const p = st.pop(), y = (p / w) | 0, x = p - y * w;
    if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w);
  }
  return out;
}

// Доля «внутренности» рисунка, куда протекает заливка фона.
// Силуэт рисунка = всё, что не снаружи после «толстых» линий (разрывы до ~30 px закрыты).
function analyze(file) {
  const img = readPng(file);
  if (!img) return null;
  const { w, h } = img;
  const wall = walls(img, 2);
  const bg = outside(wall, w, h);
  const R = 14, thick = walls(img, R), farOut = outside(thick, w, h);
  // наружная зона с отступом R обратно к линиям
  let inside = 0, leak = 0;
  // расширяем farOut на R (приближённо: пиксель снаружи, если в окне R по строке и столбцу есть farOut)
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { let last = -1e9; for (let x = 0; x < w; x++) { if (farOut[y * w + x]) last = x; if (x - last <= R) near[y * w + x] = 1; } last = 1e9; for (let x = w - 1; x >= 0; x--) { if (farOut[y * w + x]) last = x; if (last - x <= R) near[y * w + x] = 1; } }
  const near2 = new Uint8Array(near);
  for (let x = 0; x < w; x++) { let last = -1e9; for (let y = 0; y < h; y++) { if (near[y * w + x]) last = y; if (y - last <= R) near2[y * w + x] = 1; } last = 1e9; for (let y = h - 1; y >= 0; y--) { if (near[y * w + x]) last = y; if (last - y <= R) near2[y * w + x] = 1; } }
  for (let i = 0; i < w * h; i++) {
    if (near2[i] || wall[i]) continue;
    inside++;
    if (bg[i]) leak++;
  }
  return { leak: inside ? +(leak / inside).toFixed(3) : 0, inside: +(inside / (w * h)).toFixed(3) };
}

module.exports = { analyze, readPng };
if (require.main === module) {
  const dir = process.argv[2] || "images";
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".png") && !f.startsWith("cover") && !f.startsWith("pin"))) {
    const t = Date.now(); const r = analyze(dir + "/" + f);
    console.log(f.padEnd(34), JSON.stringify(r), Date.now() - t + "ms");
  }
}
