// Онлайн-раскрашивание: заливка касанием, кисть, ластик, отмена, масштаб двумя пальцами,
// автосохранение в «Мои раскраски» (IndexedDB), сохранение картинки в телефон и печать.
(function () {
  "use strict";

  // ---------- хранилище «Мои раскраски» ----------
  var DB = null;
  function db() {
    if (DB) return DB;
    DB = new Promise(function (ok, fail) {
      if (!window.indexedDB) return fail(new Error("no idb"));
      var r = indexedDB.open("raskraskino", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("works", { keyPath: "id" }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { fail(r.error); };
    });
    return DB;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, fail) {
        var t = d.transaction("works", mode), s = t.objectStore("works"), res = fn(s);
        t.oncomplete = function () { ok(res && res.result); };
        t.onerror = function () { fail(t.error); };
      });
    });
  }
  var store = {
    get: function (id) { return idb("readonly", function (s) { return s.get(id); }); },
    put: function (v) { return idb("readwrite", function (s) { s.put(v); }); },
    del: function (id) { return idb("readwrite", function (s) { s.delete(id); }); },
    all: function () { return idb("readonly", function (s) { return s.getAll(); }); },
  };

  function goal(name) { try { if (window.ym && window.YM_ID) window.ym(window.YM_ID, "reachGoal", name); } catch (e) {} }

  // ---------- печать и сохранение готовой картинки ----------
  function printSrc(src) {
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open();
    d.write("<!doctype html><html><head><style>@page{size:A4 portrait;margin:8mm}body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center}div{width:100%;height:100%}img{width:100%;height:calc(100% - 6mm);object-fit:contain;display:block}p{margin:1mm 0 0;font:8pt sans-serif;color:#888;text-align:center}</style></head><body><div><img src=\"" + src + "\"><p>Раскраски бесплатно: " + location.hostname + "</p></div></body></html>");
    d.close();
    var go = function () { f.contentWindow.focus(); f.contentWindow.print(); setTimeout(function () { f.remove(); }, 60000); };
    var im = d.images[0];
    if (im.complete) setTimeout(go, 50); else im.onload = go;
  }

  function saveBlob(blob, name, title) {
    var file;
    try { file = new File([blob], name, { type: "image/png" }); } catch (e) { file = null; }
    var touch = matchMedia("(pointer:coarse)").matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file], title: title }).catch(function (e) { if (e && e.name !== "AbortError") download(); });
    }
    download();
    function download() {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
    }
    return Promise.resolve();
  }

  // Склеивает слой цвета и контуры в одну картинку
  function compose(lineImg, colorSrc, W, H, scale) {
    var c = document.createElement("canvas");
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    var x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    if (colorSrc) x.drawImage(colorSrc, 0, 0, c.width, c.height);
    x.globalCompositeOperation = "multiply";
    x.drawImage(lineImg, 0, 0, c.width, c.height);
    x.globalCompositeOperation = "source-over";
    return c;
  }

  // ---------- страница «Мои раскраски» ----------
  var mine = document.getElementById("my-works");
  if (mine) {
    var empty = document.getElementById("my-empty");
    store.all().then(function (list) {
      list = (list || []).sort(function (a, b) { return b.updated - a.updated; });
      if (!list.length) { empty.hidden = false; return; }
      list.forEach(function (w) {
        var el = document.createElement("div");
        el.className = "work";
        el.innerHTML = '<a class="card" href="' + w.edit + '"><img alt="" width="300" height="424"><span></span></a>' +
          '<div class="work__btns"><a class="btn btn--main" href="' + w.edit + '">Продолжить</a><button type="button" class="btn btn--ghost" data-del>Удалить</button></div>';
        el.querySelector("img").src = w.thumb;
        el.querySelector("img").alt = w.title;
        el.querySelector("span").textContent = w.title;
        el.querySelector("[data-del]").onclick = function () {
          if (!confirm("Удалить «" + w.title + "» из ваших раскрасок?")) return;
          store.del(w.id).then(function () { el.remove(); if (!mine.children.length) empty.hidden = false; });
        };
        mine.appendChild(el);
      });
    }).catch(function () { empty.hidden = false; empty.textContent = "Браузер не даёт сохранять раскраски. Попробуйте открыть сайт в Chrome, Яндекс Браузере или Safari без режима «Инкогнито»."; });
  }

  // ---------- редактор ----------
  var app = document.getElementById("paint");
  if (!app) return;
  var LIST = window.PAINT_LIST || [];
  var id = new URLSearchParams(location.search).get("r");
  var item = null;
  for (var i = 0; i < LIST.length; i++) if (LIST[i].s === id) item = LIST[i];
  if (!item) { document.getElementById("paint-pick").hidden = false; app.hidden = true; return; }

  document.title = "Раскрасить онлайн: " + item.t + " — Раскраскино";
  document.getElementById("paint-title").textContent = item.t;
  var back = document.getElementById("paint-back");
  back.href = item.u;

  var stage = document.getElementById("paint-stage");
  var zoom = document.getElementById("paint-zoom");
  var cv = document.getElementById("paint-color");
  var lines = document.getElementById("paint-lines");
  var status = document.getElementById("paint-status");
  var ctx = cv.getContext("2d");
  var W = 0, H = 0, wall = null;
  var tool = "fill", color = "#ff6b5a", size = 18;
  var undo = [], redo = [];
  var lineImg = new Image();

  function say(t) { status.textContent = t || ""; }
  say("Загружаем раскраску…");

  lineImg.onload = function () {
    W = 1000; H = Math.round(W * (lineImg.naturalHeight || 1414) / (lineImg.naturalWidth || 1000));
    if (lineImg.naturalWidth && lineImg.naturalWidth < W && /\.png$/i.test(item.i)) { W = lineImg.naturalWidth; H = lineImg.naturalHeight; }
    cv.width = W; cv.height = H;
    // контуры: рисуем на холст, превращаем светлое в прозрачное, а тёмное запоминаем как «стенки» для заливки
    var lc = document.createElement("canvas");
    lc.width = W; lc.height = H;
    var lx = lc.getContext("2d");
    lx.fillStyle = "#fff"; lx.fillRect(0, 0, W, H);
    lx.drawImage(lineImg, 0, 0, W, H);
    var d = lx.getImageData(0, 0, W, H).data;
    wall = new Uint8Array(W * H);
    for (var p = 0, q = 0; p < wall.length; p++, q += 4) {
      var lum = (d[q] * 299 + d[q + 1] * 587 + d[q + 2] * 114) / 1000;
      if (lum < 165) wall[p] = 1;
    }
    lines.width = W; lines.height = H;
    lines.getContext("2d").drawImage(lc, 0, 0);
    linesReady = lc;
    fit();
    if (matchMedia("(max-width:699px)").matches) app.scrollIntoView({ block: "start" });
    store.get(item.s).then(function (w) {
      if (w && w.color) {
        var u = URL.createObjectURL(w.color), im = new Image();
        im.onload = function () { ctx.drawImage(im, 0, 0, W, H); URL.revokeObjectURL(u); say("Продолжаем с того места, где вы остановились."); };
        im.src = u;
      } else say("Выберите цвет и нажмите на часть рисунка.");
    }).catch(function () { say("Выберите цвет и нажмите на часть рисунка."); });
  };
  lineImg.onerror = function () { say("Не удалось загрузить картинку. Проверьте интернет и обновите страницу."); };
  var linesReady = null;
  lineImg.src = item.i;

  // ---------- масштаб и перемещение ----------
  var Z = { s: 1, x: 0, y: 0, bw: 0, bh: 0 };
  function apply() { zoom.style.transform = "translate(" + Z.x + "px," + Z.y + "px) scale(" + Z.s + ")"; }
  function fit() {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    var k = Math.min(sw / W, sh / H);
    Z.bw = W * k; Z.bh = H * k;
    zoom.style.width = Z.bw + "px"; zoom.style.height = Z.bh + "px";
    Z.s = 1; Z.x = (sw - Z.bw) / 2; Z.y = (sh - Z.bh) / 2;
    apply();
  }
  function clampPan() {
    var sw = stage.clientWidth, sh = stage.clientHeight, w = Z.bw * Z.s, h = Z.bh * Z.s;
    Z.x = w <= sw ? (sw - w) / 2 : Math.min(0, Math.max(sw - w, Z.x));
    Z.y = h <= sh ? (sh - h) / 2 : Math.min(0, Math.max(sh - h, Z.y));
  }
  function zoomAt(px, py, ns) {
    ns = Math.max(1, Math.min(8, ns));
    var cx = (px - Z.x) / Z.s, cy = (py - Z.y) / Z.s;
    Z.s = ns; Z.x = px - cx * ns; Z.y = py - cy * ns;
    clampPan(); apply();
  }
  window.addEventListener("resize", function () { if (W) fit(); });

  function toImg(e) {
    var r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function local(e) { var r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // ---------- отмена ----------
  function snap(x, y, w, h) {
    x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y));
    w = Math.min(W - x, Math.ceil(w)); h = Math.min(H - y, Math.ceil(h));
    return { x: x, y: y, d: ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)) };
  }
  function pushUndo(u) { undo.push(u); if (undo.length > 30) undo.shift(); redo = []; buttons(); }
  function swap(from, to) {
    var u = from.pop(); if (!u) return;
    to.push(snap(u.x, u.y, u.d.width, u.d.height));
    ctx.putImageData(u.d, u.x, u.y);
    buttons(); changed();
  }
  function buttons() {
    document.getElementById("paint-undo").disabled = !undo.length;
    document.getElementById("paint-redo").disabled = !redo.length;
  }

  // ---------- заливка ----------
  function hex(c) { var n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function fill(px, py) {
    px = Math.floor(px); py = Math.floor(py);
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    var start = py * W + px;
    // нажали точно на линию — ищем ближайшую пустую точку рядом
    if (wall[start]) {
      var found = -1;
      for (var r = 1; r < 8 && found < 0; r++)
        for (var dy = -r; dy <= r && found < 0; dy++)
          for (var dx = -r; dx <= r; dx++) {
            var xx = px + dx, yy = py + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H && !wall[yy * W + xx]) { found = yy * W + xx; break; }
          }
      if (found < 0) return;
      start = found;
    }
    var mask = new Uint8Array(W * H), stack = [start], minX = W, minY = H, maxX = 0, maxY = 0;
    mask[start] = 1;
    while (stack.length) {
      var p = stack.pop(), y = (p / W) | 0, x = p - y * W, l = x, rr = x;
      while (l > 0 && !wall[p - (x - l) - 1] && !mask[p - (x - l) - 1]) l--;
      while (rr < W - 1 && !wall[p + (rr - x) + 1] && !mask[p + (rr - x) + 1]) rr++;
      var row = y * W;
      for (var k = l; k <= rr; k++) {
        mask[row + k] = 1;
        if (y > 0) { var u = row - W + k; if (!mask[u] && !wall[u]) { mask[u] = 1; stack.push(u); } }
        if (y < H - 1) { var dn = row + W + k; if (!mask[dn] && !wall[dn]) { mask[dn] = 1; stack.push(dn); } }
      }
      if (l < minX) minX = l; if (rr > maxX) maxX = rr; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    // чуть заходим под линию, чтобы у краёв не оставалось белых зазоров
    minX = Math.max(0, minX - 2); minY = Math.max(0, minY - 2); maxX = Math.min(W - 1, maxX + 2); maxY = Math.min(H - 1, maxY + 2);
    var bw = maxX - minX + 1, bh = maxY - minY + 1;
    var before = snap(minX, minY, bw, bh);
    var img = ctx.getImageData(minX, minY, bw, bh), d = img.data, c = hex(color);
    for (var yy2 = minY; yy2 <= maxY; yy2++) for (var xx2 = minX; xx2 <= maxX; xx2++) {
      var i2 = yy2 * W + xx2, on = mask[i2];
      if (!on && wall[i2]) {
        on = (xx2 > 0 && mask[i2 - 1]) || (xx2 < W - 1 && mask[i2 + 1]) || (yy2 > 0 && mask[i2 - W]) || (yy2 < H - 1 && mask[i2 + W]) ||
          (xx2 > 1 && mask[i2 - 2]) || (xx2 < W - 2 && mask[i2 + 2]) || (yy2 > 1 && mask[i2 - 2 * W]) || (yy2 < H - 2 && mask[i2 + 2 * W]);
      }
      if (on) { var o = ((yy2 - minY) * bw + (xx2 - minX)) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
    }
    ctx.putImageData(img, minX, minY);
    pushUndo(before);
    changed();
  }

  // ---------- кисть и ластик ----------
  var stroke = null;
  function strokeStart(pt) {
    stroke = { full: ctx.getImageData(0, 0, W, H), minX: pt.x, minY: pt.y, maxX: pt.x, maxY: pt.y, last: pt };
    ctx.globalCompositeOperation = tool === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = ctx.fillStyle = color;
    ctx.lineWidth = size; ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath(); ctx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2); ctx.fill();
  }
  function strokeMove(pt) {
    if (!stroke) return;
    ctx.beginPath(); ctx.moveTo(stroke.last.x, stroke.last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    stroke.last = pt;
    stroke.minX = Math.min(stroke.minX, pt.x); stroke.minY = Math.min(stroke.minY, pt.y);
    stroke.maxX = Math.max(stroke.maxX, pt.x); stroke.maxY = Math.max(stroke.maxY, pt.y);
  }
  function strokeEnd(cancel) {
    if (!stroke) return;
    ctx.globalCompositeOperation = "source-over";
    var s = stroke; stroke = null;
    if (cancel) { ctx.putImageData(s.full, 0, 0); return; }
    var pad = size / 2 + 2, x = Math.max(0, Math.floor(s.minX - pad)), y = Math.max(0, Math.floor(s.minY - pad));
    var w = Math.min(W, Math.ceil(s.maxX + pad)) - x, h = Math.min(H, Math.ceil(s.maxY + pad)) - y;
    var tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
    var tx = tmp.getContext("2d"); tx.putImageData(s.full, 0, 0);
    pushUndo({ x: x, y: y, d: tx.getImageData(x, y, Math.max(1, w), Math.max(1, h)) });
    changed();
  }

  // ---------- касания: один палец рисует, два — увеличивают ----------
  var P = {}, pinch = null, down = null;
  stage.addEventListener("pointerdown", function (e) {
    if (!W) return;
    stage.setPointerCapture(e.pointerId);
    P[e.pointerId] = local(e);
    var ids = Object.keys(P);
    if (ids.length === 2) {
      if (stroke) strokeEnd(true);
      down = null;
      var a = P[ids[0]], b = P[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, s: Z.s, x: Z.x, y: Z.y };
    } else if (ids.length === 1) {
      down = { x: e.clientX, y: e.clientY, img: toImg(e), moved: false, pan: e.button === 1 || e.button === 2 || tool === "hand" };
      if (!down.pan && (tool === "brush" || tool === "erase")) strokeStart(down.img);
    }
  });
  stage.addEventListener("pointermove", function (e) {
    if (!P[e.pointerId]) return;
    var prev = P[e.pointerId];
    P[e.pointerId] = local(e);
    var ids = Object.keys(P);
    if (pinch && ids.length >= 2) {
      var a = P[ids[0]], b = P[ids[1]];
      var dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var ns = Math.max(1, Math.min(8, pinch.s * dist / pinch.d));
      var cx = (pinch.mx - pinch.x) / pinch.s, cy = (pinch.my - pinch.y) / pinch.s;
      Z.s = ns; Z.x = mx - cx * ns; Z.y = my - cy * ns; clampPan(); apply();
      return;
    }
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true;
    // в режиме заливки палец, который тянут, двигает увеличенную картинку
    if (down.pan || (tool === "fill" && down.moved)) { Z.x += P[e.pointerId].x - prev.x; Z.y += P[e.pointerId].y - prev.y; clampPan(); apply(); return; }
    if (stroke) {
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (var k = 0; k < evs.length; k++) strokeMove(toImg(evs[k]));
    }
  });
  function up(e) {
    if (!P[e.pointerId]) return;
    delete P[e.pointerId];
    var left = Object.keys(P).length;
    if (pinch) { if (!left) pinch = null; return; }
    if (!down) return;
    var d = down; down = null;
    if (e.type === "pointercancel") { strokeEnd(true); return; }
    if (d.pan) return;
    if (tool === "fill" && !d.moved) fill(d.img.x, d.img.y);
    else if (stroke) strokeEnd(false);
  }
  stage.addEventListener("pointerup", up);
  stage.addEventListener("pointercancel", up);
  stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  stage.addEventListener("wheel", function (e) {
    e.preventDefault();
    var p = local(e);
    zoomAt(p.x, p.y, Z.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
  }, { passive: false });

  // ---------- панель ----------
  app.addEventListener("click", function (e) {
    var b = e.target.closest("[data-tool],[data-color],[data-act]");
    if (!b) return;
    if (b.hasAttribute("data-tool")) setTool(b.getAttribute("data-tool"));
    else if (b.hasAttribute("data-color")) setColor(b.getAttribute("data-color"));
    else act(b.getAttribute("data-act"), b);
  });
  function setTool(t) {
    tool = t;
    app.querySelectorAll("[data-tool]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-tool") === t); });
    document.getElementById("paint-size-box").hidden = !(t === "brush" || t === "erase");
    stage.style.cursor = t === "hand" ? "grab" : "crosshair";
  }
  function setColor(c) {
    color = c;
    app.querySelectorAll("[data-color]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-color") === c); });
    document.getElementById("paint-cur").style.background = c;
    if (tool === "erase" || tool === "hand") setTool("fill");
  }
  document.getElementById("paint-custom").addEventListener("input", function (e) { setColor(e.target.value); });
  document.getElementById("paint-size").addEventListener("input", function (e) { size = +e.target.value; });

  function result(scale) { return compose(linesReady, cv, W, H, scale || 1); }
  function act(a, b) {
    if (!W) return;
    if (a === "undo") swap(undo, redo);
    else if (a === "redo") swap(redo, undo);
    else if (a === "fit") fit();
    else if (a === "zin") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, Z.s * 1.5);
    else if (a === "zout") zoomAt(stage.clientWidth / 2, stage.clientHeight / 2, Z.s / 1.5);
    else if (a === "clear") {
      if (!confirm("Стереть все цвета и начать раскрашивать заново?")) return;
      pushUndo(snap(0, 0, W, H));
      ctx.clearRect(0, 0, W, H); changed();
    } else if (a === "save") {
      var label = b.innerHTML; b.disabled = true; b.textContent = "Готовим картинку…";
      flush();
      result(1654 / W).toBlob(function (blob) {
        saveBlob(blob, item.s + "-raskrasheno.png", item.t).then(function () { b.disabled = false; b.innerHTML = label; });
        goal("color_save");
      }, "image/png");
    } else if (a === "print") {
      flush();
      printSrc(result(1654 / W).toDataURL("image/png"));
      goal("color_print");
    }
  }

  // ---------- автосохранение ----------
  var timer = null, dirty = false, first = true;
  function changed() {
    dirty = true;
    if (first) { first = false; goal("color_start"); }
    clearTimeout(timer); timer = setTimeout(flush, 1200);
  }
  function flush() {
    if (!dirty) return; dirty = false; clearTimeout(timer);
    cv.toBlob(function (blob) {
      var th = result(240 / W).toDataURL("image/jpeg", 0.8);
      store.put({ id: item.s, title: item.t, edit: location.pathname + "?r=" + encodeURIComponent(item.s), url: item.u, color: blob, thumb: th, updated: Date.now() })
        .then(function () { say("Сохранено в «Мои раскраски» ✓"); })
        .catch(function () { say("Не получилось сохранить в браузере. Сохраните картинку кнопкой «Сохранить»."); });
    }, "image/png");
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) flush(); });
  window.addEventListener("pagehide", flush);

  setTool("fill"); setColor(color); buttons();
})();
