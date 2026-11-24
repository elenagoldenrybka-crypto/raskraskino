// Сервис-воркер: сайт открывается как приложение и работает без интернета
// для уже открытых раскрасок. Страницы, стили и скрипты берутся из сети (всегда свежие),
// а при отсутствии интернета — из сохранённой копии. Картинки — сначала из копии.
var B = "__BASE__";
var CACHE = "raskraskino-__VERSION__";
var CORE = [B + "/", B + "/style.css", B + "/app.js", B + "/color.js", B + "/raskrasit/", B + "/moi-raskraski/", B + "/manifest.webmanifest", B + "/favicon.svg"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).catch(function () {}));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf("raskraskino-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.indexOf(B + "/pdf/") === 0) return;

  if (url.pathname.indexOf(B + "/img/") === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      });
    }));
    return;
  }

  e.respondWith(fetch(req).then(function (res) {
    if (res.ok && (req.mode === "navigate" || /\.(css|js|json|svg|webmanifest)$/.test(url.pathname))) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(function (hit) {
      return hit || (req.mode === "navigate" ? caches.match(B + "/moi-raskraski/") : undefined) || Response.error();
    });
  }));
});
