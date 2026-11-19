// Кнопки «Распечатать» и «Скачать PNG», плашка про cookies
(function () {
  document.querySelectorAll("[data-print]").forEach(function (b) {
    b.addEventListener("click", function () { window.print(); });
  });

  document.querySelectorAll("[data-png]").forEach(function (b) {
    b.addEventListener("click", function () {
      var label = b.innerHTML;
      b.disabled = true; b.textContent = "Готовим файл…";
      var img = new Image();
      img.onload = function () {
        // А4 при 200 dpi
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
          a.download = (b.getAttribute("data-name") || "raskraska") + ".png";
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
          b.disabled = false; b.innerHTML = label;
        }, "image/png");
      };
      img.onerror = function () { b.disabled = false; b.innerHTML = label; window.open(b.getAttribute("data-png")); };
      img.src = b.getAttribute("data-png");
    });
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
