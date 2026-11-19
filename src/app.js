// Окно просмотра, печать, скачивание PNG, плашка про cookies
(function () {

  // ---------- Окно просмотра ----------
  var V = document.getElementById("viewer");
  var G = window.GALLERY || [];
  var cur = window.GALLERY_START || 0;

  function show(i) {
    if (!G.length) return;
    cur = (i + G.length) % G.length;
    var it = G[cur];
    document.getElementById("viewer-img").src = it.img;
    document.getElementById("viewer-img").alt = it.t;
    document.getElementById("viewer-title").textContent = it.t;
    document.getElementById("viewer-count").textContent = (cur + 1) + " / " + G.length;
  }
  function openV() { if (!V) return; show(cur); V.hidden = false; document.body.classList.add("no-scroll"); V.querySelector(".viewer__close").focus(); }
  function closeV() { V.hidden = true; document.body.classList.remove("no-scroll"); }

  // Печать через невидимый фрейм: на листе только картинка
  function printImg(src, half) {
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var css = half
      ? "@page{size:A4 landscape;margin:8mm}body{margin:0;display:flex;height:100vh;align-items:center}img{width:50%;height:100%;object-fit:contain;box-sizing:border-box;padding:0 4mm}img+img{border-left:1px dashed #999}"
      : "@page{size:A4 portrait;margin:8mm}body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center}img{width:100%;height:100%;object-fit:contain}";
    var imgs = half ? '<img src="' + src + '"><img src="' + src + '">' : '<img src="' + src + '">';
    var d = f.contentWindow.document;
    d.open(); d.write("<!doctype html><html><head><style>" + css + "</style></head><body>" + imgs + "</body></html>"); d.close();
    var go = function () { f.contentWindow.focus(); f.contentWindow.print(); window.focus(); setTimeout(function () { f.remove(); }, 60000); };
    var first = d.images[0];
    if (first.complete) setTimeout(go, 50); else first.onload = go;
  }

  function downloadPng(src, name, btn) {
    var label = btn ? btn.innerHTML : "";
    if (btn) { btn.disabled = true; btn.textContent = "Готовим файл…"; }
    var done = function () { if (btn) { btn.disabled = false; btn.innerHTML = label; } };
    var img = new Image();
    img.onload = function () {
      var W = 1654, H = 2339, c = document.createElement("canvas");
      c.width = W; c.height = H;
      var x = c.getContext("2d");
      x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
      var s = Math.min(W / img.naturalWidth, H / img.naturalHeight);
      var w = img.naturalWidth * s, h = img.naturalHeight * s;
      x.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      c.toBlob(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (name || "raskraska") + ".png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        done();
      }, "image/png");
    };
    img.onerror = function () { done(); window.open(src); };
    img.src = src;
  }

  function share(btn) {
    var it = G[cur], url = location.origin + it.url;
    if (navigator.share) { navigator.share({ title: it.t, url: url }).catch(function () {}); return; }
    var ok = function () { var l = btn.innerHTML; btn.textContent = "Ссылка скопирована ✓"; setTimeout(function () { btn.innerHTML = l; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, function () { prompt("Скопируйте ссылку:", url); });
    else prompt("Скопируйте ссылку:", url);
  }

  document.querySelectorAll("[data-open]").forEach(function (b) {
    b.addEventListener("click", function () { cur = window.GALLERY_START || 0; openV(); });
  });
  if (V) {
    V.addEventListener("click", function (e) {
      if (e.target === V) return closeV();
      var b = e.target.closest("[data-v]"); if (!b) return;
      var a = b.getAttribute("data-v"), it = G[cur];
      if (a === "close") closeV();
      else if (a === "prev") show(cur - 1);
      else if (a === "next") show(cur + 1);
      else if (a === "print") printImg(it.img, false);
      else if (a === "half") printImg(it.img, true);
      else if (a === "png") downloadPng(it.img, it.s, b);
      else if (a === "share") share(b);
    });
    document.addEventListener("keydown", function (e) {
      if (V.hidden) return;
      if (e.key === "Escape") closeV();
      if (e.key === "ArrowLeft") show(cur - 1);
      if (e.key === "ArrowRight") show(cur + 1);
    });
    var sx = null;
    V.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    V.addEventListener("touchend", function (e) {
      if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 60 && e.target.closest(".viewer__stage")) show(cur + (dx < 0 ? 1 : -1));
    });
  }

  document.querySelectorAll("[data-png]").forEach(function (b) {
    b.addEventListener("click", function () { downloadPng(b.getAttribute("data-png"), b.getAttribute("data-name"), b); });
  });

  try {
    var box = document.getElementById("cookie");
    if (box && !localStorage.getItem("cookie-ok")) {
      box.hidden = false;
      document.getElementById("cookie-ok").addEventListener("click", function () {
        localStorage.setItem("cookie-ok", "1"); box.hidden = true;
      });
    }
  } catch (e) {}
})();
