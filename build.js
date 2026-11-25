// Сборка сайта: node build.js  →  готовый сайт в папке dist/
// Ничего устанавливать не нужно, достаточно Node.js 18+.
const fs = require("fs");
const path = require("path");

const cfg = require("./site.config.js");
const sections = require("./content/sections.json");
const pages = require("./content/raskraski.json");

const OUT = path.join(__dirname, "dist");
const B = cfg.basePath.replace(/\/$/, "");
const year = new Date().getFullYear();

// ---------- помощники ----------
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const link = (p) => `${B}${p}`;
// Разделы → подгруппы → раскраски
const groups = [];
for (const s of sections) for (const g of s.groups) { g.section = s; groups.push(g); }
const groupBySlug = Object.fromEntries(groups.map((g) => [g.slug, g]));
for (const p of pages) {
  p.g = groupBySlug[p.group];
  if (!p.g) throw new Error(`У раскраски ${p.slug} неизвестная подгруппа «${p.group}»`);
  for (const a of p.also || []) if (!groupBySlug[a]) throw new Error(`У раскраски ${p.slug} неизвестная подгруппа «${a}»`);
}
const pageUrl = (p) => `/${p.g.section.slug}/${p.g.slug}/${p.slug}/`;
const secUrl = (s) => `/${s.slug}/`;
const groupUrl = (g) => `/${g.section.slug}/${g.slug}/`;
const inGroup = (p, g) => p.group === g.slug || (p.also || []).includes(g.slug);
const inSection = (p, s) => s.groups.some((g) => inGroup(p, g));
const hasCover = (name) => fs.existsSync(path.join(__dirname, "images", name));
// Цветная заставка: images/cover-s-<раздел>.jpg или images/cover-g-<подгруппа>.jpg; если её нет — первая раскраска
function coverOf(kind, obj, list) {
  const name = `cover-${kind}-${obj.slug}.jpg`;
  if (hasCover(name)) return { src: link("/img/" + name), color: true };
  return list[0] ? { src: link("/img/" + list[0].image), color: false } : null;
}
function tile(url, title, cov, n) {
  return `<a class="tile" href="${link(url)}"><span class="tile__img${cov && !cov.color ? " tile__img--line" : ""}">${cov ? `<img src="${cov.src}" alt="" loading="lazy" width="240" height="240">` : ""}</span><b>${esc(title)}</b>${n != null ? `<small>${n} шт.</small>` : ""}</a>`;
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function ad(place) {
  if (cfg.adsEnabled && cfg.adCodes[place]) {
    return `<div class="ad ad--${place}">${cfg.adCodes[place]}</div>`;
  }
  return `<div class="ad ad--${place} ad--placeholder" aria-hidden="true">Здесь будет реклама (${place})</div>`;
}

function metrika() {
  const id = String(cfg.yandexMetrikaId || "").replace(/\D/g, "");
  if (!id) return "";
  return `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js?id=${id}","ym");ym(${id},"init",{ssr:true,webvisor:true,clickmap:true,referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true});</script><noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute;left:-9999px" alt=""></div></noscript>`;
}

function card(p) {
  return `<a class="card" href="${link(pageUrl(p))}">
  <img src="${link("/img/" + p.image)}" alt="${esc(p.title)}" loading="lazy" width="300" height="424">
  <span>${esc(p.short)}</span></a>`;
}

function sideNav(cur) {
  return `<nav class="snav" aria-label="Разделы">${sections
    .map((s) => {
      const open = cur && cur.slug === s.slug;
      const subs = open
        ? `<div class="snav__sub">${s.groups.filter((g) => pages.some((p) => inGroup(p, g))).map((g) => `<a href="${link(groupUrl(g))}">${esc(g.title)}</a>`).join("")}</div>`
        : "";
      return `<a class="snav__item${open ? " is-open" : ""}" href="${link(secUrl(s))}">Раскраски: ${esc(s.title)}</a>${subs}`;
    })
    .join("")}</nav>`;
}

function layout({ title, description, canonical, body, breadcrumbs = [], jsonld = null, section = null, head = "" }) {
  const fullTitle = title === cfg.name ? `${cfg.name} — ${cfg.tagline}` : `${title} — ${cfg.name}`;
  const crumbs = breadcrumbs.length
    ? `<nav class="crumbs" aria-label="Навигация"><a href="${link("/")}">Главная</a>${breadcrumbs
        .map((b) => (b.url ? ` › <a href="${link(b.url)}">${esc(b.title)}</a>` : ` › <span>${esc(b.title)}</span>`))
        .join("")}</nav>`
    : "";
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<meta name="yandex-verification" content="b2cba5e0da4f8ea0">
<meta name="p:domain_verify" content="e04f822ae8e32799d191a0e5a5712e13"/>
<link rel="canonical" href="${cfg.url}${B}${canonical}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${link("/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${link("/style.css")}">
<link rel="manifest" href="${link("/manifest.webmanifest")}">
<meta name="theme-color" content="#ff6b5a">
<link rel="apple-touch-icon" href="${link("/icons/apple-touch-icon.png")}">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.name)}">
${head}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${metrika()}
</head>
<body>
<header class="top">
  <div class="wrap top__in">
    <a class="logo" href="${link("/")}"><span class="logo__dot"></span>${esc(cfg.name)}</a>
    <form class="search" action="${link("/poisk/")}" method="get" role="search"><input type="search" name="q" placeholder="Найти раскраски" aria-label="Поиск раскрасок" required><button type="submit">Искать</button></form>
    <nav class="menu">${sections.map((s) => `<a href="${link(secUrl(s))}">${esc(s.title)}</a>`).join("")}</nav>
  </div>
</header>
<div class="wrap layout">
  <aside class="lnav">${sideNav(section)}</aside>
  <main>
    ${crumbs}
    ${body}
  </main>
  <aside class="side">${ad("sidebar")}</aside>
</div>
<footer class="foot">
  <div class="wrap">
    <p>© ${year} ${esc(cfg.name)}. Все раскраски бесплатны для личного некоммерческого использования.</p>
    <p class="soc">Новые раскраски каждый день: <a href="https://vk.ru/pro_raskraski" target="_blank" rel="noopener">мы ВКонтакте</a> · <a href="https://www.pinterest.com/Elena_raskraskino/" target="_blank" rel="noopener">мы в Pinterest</a></p>
    <p><a href="${link("/moi-raskraski/")}">Мои раскраски</a> · <a href="${link("/raskrasit/")}">Раскрасить онлайн</a> · <a href="${link("/o-sajte/")}">О сайте</a> · <a href="${link("/privacy/")}">Политика конфиденциальности</a> · <a href="${link("/kontakty/")}">Контакты</a></p>
  </div>
</footer>
<div class="cookie" id="cookie" hidden>
  <span>Мы используем cookies и сервисы аналитики, чтобы сайт работал лучше. Подробнее — в <a href="${link("/privacy/")}">политике конфиденциальности</a>.</span>
  <button type="button" id="cookie-ok">Понятно</button>
</div>
<script>window.BASE=${JSON.stringify(B)};window.YM_ID=${JSON.stringify(String(cfg.yandexMetrikaId || "").replace(/\D/g, ""))};</script>
<script src="${link("/app.js")}" defer></script>
</body>
</html>`;
}

// Какие картинки годятся для раскрашивания заливкой (контуры замкнуты)
const { analyze } = require("./tools/zalivka.js");
const leakCache = {};
function paintable(p) {
  if ((cfg.paintExclude || []).includes(p.slug)) return false;
  if ((cfg.paintExcludeGroups || []).includes(p.group)) return false;
  if (!p.image.endsWith(".png")) return true;
  if (!(p.image in leakCache)) {
    try { const r = analyze(path.join(__dirname, "images", p.image)); leakCache[p.image] = r ? r.leak : 0; } catch (e) { leakCache[p.image] = 0; }
  }
  return leakCache[p.image] <= (cfg.paintMaxLeak ?? 0.3);
}
const paintUrl = (p) => link(`/raskrasit/?r=${encodeURIComponent(p.slug)}`);
// Кнопка «Сохранить в Pinterest»: Пинтерест сам заберёт картинку и поставит ссылку на страницу
const pinHref = (p) =>
  `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(cfg.url + link(pageUrl(p)))}&media=${encodeURIComponent(cfg.url + link("/img/" + p.image))}&description=${encodeURIComponent(p.title + " — скачать и распечатать бесплатно")}`;
const pinBtn = (p) => `<a class="pin" href="${pinHref(p)}" target="_blank" rel="noopener nofollow" aria-label="Сохранить в Pinterest"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-3.6 19.3c-.1-.8-.2-2 0-2.9l1.2-5s-.3-.6-.3-1.5c0-1.4.8-2.5 1.8-2.5.9 0 1.3.6 1.3 1.4 0 .9-.5 2.2-.8 3.4-.2 1 .5 1.9 1.6 1.9 1.9 0 3.3-2 3.3-4.9 0-2.5-1.8-4.3-4.4-4.3-3 0-4.8 2.3-4.8 4.6 0 .9.3 1.9.8 2.4l.1.4-.3 1.2c0 .2-.2.3-.4.2-1.4-.6-2.2-2.6-2.2-4.2 0-3.4 2.5-6.6 7.2-6.6 3.8 0 6.7 2.7 6.7 6.3 0 3.7-2.4 6.8-5.6 6.8-1.1 0-2.2-.6-2.5-1.3l-.7 2.6c-.2 1-.9 2.2-1.4 2.9A10 10 0 1 0 12 2z"/></svg>Сохранить</a>`;

// Окно просмотра: картинка, стрелки, кнопки и место под рекламу
function viewer(current) {
  // порядок листания: сначала та же тема, потом остальные
  const s = current.g.section;
  const list = pages.filter((x) => x.group === current.group)
    .concat(pages.filter((x) => x.group !== current.group && inSection(x, s)))
    .concat(pages.filter((x) => !inSection(x, s)));
  const data = list.map((x) => ({ t: x.title, s: x.slug, img: link("/img/" + x.image), url: link(pageUrl(x)), paint: paintable(x) ? paintUrl(x) : "" }));
  return `
<div class="viewer" id="viewer" hidden role="dialog" aria-modal="true" aria-label="Просмотр раскраски">
  <div class="viewer__box">
    <div class="viewer__main">
      <div class="viewer__stage">
        <button type="button" class="viewer__nav viewer__nav--prev" data-v="prev" aria-label="Предыдущая раскраска">‹</button>
        <img class="viewer__img" id="viewer-img" src="" alt="">
        <button type="button" class="viewer__nav viewer__nav--next" data-v="next" aria-label="Следующая раскраска">›</button>
      </div>
      ${ad("modal")}
    </div>
    <div class="viewer__side">
      <button type="button" class="viewer__close" data-v="close" aria-label="Закрыть">×</button>
      <p class="viewer__title" id="viewer-title"></p>
      <a class="vbtn vbtn--paint" id="viewer-paint" href="#">🎨 Раскрасить онлайн</a>
      <button type="button" class="vbtn vbtn--print" data-v="print">🖨 Распечатать</button>
      <button type="button" class="vbtn vbtn--down" data-v="png">⬇ Скачать PNG</button>
      <button type="button" class="vbtn vbtn--half" data-v="half">✂ Печать на пол-листа</button>
      <button type="button" class="vbtn vbtn--share" data-v="share">↗ Поделиться</button>
      <button type="button" class="vbtn vbtn--pin" data-v="pin">📌 Сохранить в Pinterest</button>
      <p class="viewer__hint">«Пол-листа» печатает две одинаковые раскраски на одном листе А4: удобно для двоих детей и экономит бумагу.</p>
      <p class="viewer__count" id="viewer-count"></p>
    </div>
  </div>
</div>
<script>window.GALLERY=${JSON.stringify(data).replace(/</g, "\\u003c")};window.GALLERY_START=${list.indexOf(current)};</script>`;
}

// ---------- сборка ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ["style.css", "app.js", "color.js", "favicon.svg"]) fs.copyFileSync(path.join(__dirname, "src", f), path.join(OUT, f));
fs.mkdirSync(path.join(OUT, "icons"));
for (const f of fs.readdirSync(path.join(__dirname, "src", "icons"))) fs.copyFileSync(path.join(__dirname, "src", "icons", f), path.join(OUT, "icons", f));
// Приложение на телефон (PWA): манифест и сервис-воркер
write("sw.js", fs.readFileSync(path.join(__dirname, "src", "sw.js"), "utf8").replace("__BASE__", B).replace("__VERSION__", Date.now().toString(36)));
write("manifest.webmanifest", JSON.stringify({
  name: `${cfg.name} — раскраски онлайн`,
  short_name: cfg.name,
  description: "Раскрашивайте картинки прямо в телефоне, сохраняйте и печатайте",
  lang: "ru",
  start_url: `${B}/?utm_source=app`,
  scope: `${B}/`,
  display: "standalone",
  orientation: "portrait",
  background_color: "#fffaf3",
  theme_color: "#ff6b5a",
  icons: [
    { src: `${B}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
    { src: `${B}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    { src: `${B}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  shortcuts: [
    { name: "Мои раскраски", url: `${B}/moi-raskraski/` },
    { name: "Раскрасить онлайн", url: `${B}/raskrasit/` },
  ],
}, null, 1));
// Файлы из папки public/ копируются в корень сайта как есть (подтверждения Вебмастера и т.п.)
const PUB = path.join(__dirname, "public");
if (fs.existsSync(PUB)) for (const f of fs.readdirSync(PUB)) fs.copyFileSync(path.join(PUB, f), path.join(OUT, f));
fs.mkdirSync(path.join(OUT, "img"));
for (const f of fs.readdirSync(path.join(__dirname, "images"))) fs.copyFileSync(path.join(__dirname, "images", f), path.join(OUT, "img", f));
// PDF для печати (делает tools/make_pdf.py)
const PDF = path.join(__dirname, "pdf");
const hasPdf = (n) => fs.existsSync(path.join(PDF, n));
if (fs.existsSync(PDF)) { fs.mkdirSync(path.join(OUT, "pdf")); for (const f of fs.readdirSync(PDF)) fs.copyFileSync(path.join(PDF, f), path.join(OUT, "pdf", f)); }
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? "раскраска" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "раскраски" : "раскрасок");

const sorted = [...pages].sort((a, b) => b.added.localeCompare(a.added));

// Главная
write(
  "index.html",
  layout({
    title: cfg.name,
    description: `${cfg.tagline}. Разделы: ${sections.map((c) => c.title.toLowerCase()).join(", ")}. Скачать в хорошем качестве или распечатать на А4.`,
    canonical: "/",
    body: `
<section class="hero">
  <h1>Бесплатные раскраски для детей</h1>
  <p>Выберите картинку, нажмите «Распечатать» или «Скачать». Все раскраски — формата А4, с чёткими контурами.</p>
  <p class="hero__paint">🎨 Новое: любую картинку можно <a href="${link("/raskrasit/")}">раскрасить онлайн</a> прямо в телефоне, сохранить и распечатать. <button type="button" class="linkbtn" data-install hidden>Установить как приложение</button></p>
</section>
${ad("top")}
<h2>Разделы</h2>
<div class="tiles">${sections
      .map((sec) => { const l = sorted.filter((p) => inSection(p, sec)); return l.length ? tile(secUrl(sec), sec.title, coverOf("s", sec, l), l.length) : ""; })
      .join("")}</div>
${ad("middle")}
<h2>Новые раскраски</h2>
<div class="grid">${sorted.slice(0, 12).map(card).join("")}</div>
${ad("bottom")}`,
  })
);

// Разделы
for (const sec of sections) {
  const all = sorted.filter((p) => inSection(p, sec));
  if (!all.length) continue;
  const gs = sec.groups.map((g) => ({ g, l: sorted.filter((p) => inGroup(p, g)) })).filter((x) => x.l.length);
  write(
    `${sec.slug}/index.html`,
    layout({
      title: `Раскраски: ${sec.title.toLowerCase()}`,
      description: sec.description,
      canonical: secUrl(sec),
      section: sec,
      breadcrumbs: [{ title: sec.title }],
      body: `
<h1>Раскраски: ${esc(sec.title.toLowerCase())}</h1>
<p class="lead">${esc(sec.description)}</p>
${ad("top")}
<div class="tiles">${gs.map(({ g, l }) => tile(groupUrl(g), g.title, coverOf("g", g, l), l.length)).join("")}</div>
${ad("middle")}
<h2>Все раскраски раздела</h2>
<div class="grid">${all.map(card).join("")}</div>
${ad("bottom")}`,
    })
  );
  // Подгруппы
  for (const { g, l } of gs) {
    const others = gs.filter((x) => x.g !== g);
    write(
      `${sec.slug}/${g.slug}/index.html`,
      layout({
        title: `Раскраски «${g.title}»`,
        description: `${g.description} Скачать бесплатно или распечатать на А4.`,
        canonical: groupUrl(g),
        section: sec,
        breadcrumbs: [{ title: sec.title, url: secUrl(sec) }, { title: g.title }],
        body: `
<h1>Раскраски «${esc(g.title)}»</h1>
<p class="lead">${esc(g.description)}</p>
${hasPdf(`sbornik-${g.slug}.pdf`) ? `<p class="pdfall"><a class="btn btn--main" href="${link(`/pdf/sbornik-${g.slug}.pdf`)}" download>📚 Скачать все ${l.length} ${plural(l.length)} одним PDF</a><span>Сборник для печати на А4: удобно для детского сада, школы и дома.</span></p>` : ""}
${ad("top")}
<div class="grid">${l.map(card).join("")}</div>
${ad("bottom")}
<section class="about"><h2>Как распечатать</h2><p>Откройте раскраску и нажмите «Распечатать»: на листе А4 будет только рисунок, без меню сайта. Можно скачать отдельную раскраску в PDF или PNG, а всю подборку — одним PDF-файлом. Лучше всего подходит обычная офисная бумага плотностью 80 г/м², для фломастеров и красок — плотнее.</p></section>
${others.length ? `<h2>Ещё в разделе «${esc(sec.title)}»</h2>
<div class="tiles">${others.map((x) => tile(groupUrl(x.g), x.g.title, coverOf("g", x.g, x.l), x.l.length)).join("")}</div>` : ""}`,
      })
    );
  }
}

// Страницы раскрасок
for (const p of pages) {
  const g = p.g, sec = g.section;
  const related = sorted.filter((x) => x.slug !== p.slug && inGroup(x, g))
    .concat(sorted.filter((x) => x.slug !== p.slug && !inGroup(x, g) && inSection(x, sec)))
    .concat(sorted.filter((x) => !inSection(x, sec)))
    .slice(0, 4);
  const img = link("/img/" + p.image);
  write(
    `${sec.slug}/${g.slug}/${p.slug}/index.html`,
    layout({
      title: p.title,
      description: `${p.title} — скачать бесплатно и распечатать на А4. ${p.text[0]}`.slice(0, 160),
      canonical: pageUrl(p),
      section: sec,
      breadcrumbs: [{ title: sec.title, url: secUrl(sec) }, { title: g.title, url: groupUrl(g) }, { title: p.short }],
      jsonld: {
        "@context": "https://schema.org",
        "@type": "ImageObject",
        name: p.title,
        contentUrl: `${cfg.url}${img}`,
        description: p.text[0],
        isFamilyFriendly: true,
      },
      body: `
<h1>${esc(p.title)}</h1>
${ad("top")}
<figure class="sheet" id="sheet">
  ${pinBtn(p)}
  <button type="button" class="sheet__open" data-open aria-label="Открыть раскраску в большом окне">
    <img src="${img}" alt="${esc(p.title)} — контурный рисунок для раскрашивания" width="600" height="848">
    <span class="sheet__zoom">Открыть и распечатать</span>
  </button>
</figure>
<div class="actions">
  ${paintable(p) ? `<a class="btn btn--paint" href="${paintUrl(p)}">🎨 Раскрасить онлайн</a>` : ""}
  <button type="button" class="btn btn--main" data-open>🖨 Распечатать</button>
  ${hasPdf(`${p.slug}.pdf`) ? `<a class="btn" href="${link(`/pdf/${p.slug}.pdf`)}" download>⬇ Скачать PDF</a>` : ""}
  <button type="button" class="btn" data-png="${img}" data-name="${esc(p.slug)}">⬇ Скачать PNG</button>
  ${p.image.endsWith(".svg") ? `<a class="btn btn--ghost" href="${img}" download="${esc(p.slug)}.svg">Скачать SVG</a>` : ""}
</div>
<p class="meta">Возраст: ${esc(p.age)} · Формат: А4, вертикально · Раздел: <a href="${link(groupUrl(g))}">${esc(g.title)}</a></p>
${ad("middle")}
<section class="about">
  <h2>Об этой раскраске</h2>
  ${p.text.map((t) => `<p>${esc(t)}</p>`).join("\n  ")}
  <p>Как распечатать: нажмите «Распечатать», в окне печати выберите формат А4 и книжную ориентацию. Картинка сама растянется на весь лист.</p>
</section>
${ad("bottom")}
<h2>Похожие раскраски</h2>
<div class="grid">${related.map(card).join("")}</div>
${viewer(p)}`,
    })
  );
}

// Онлайн-раскрашивание и «Мои раскраски»
const PALETTE = ["#e53935","#ff6b5a","#ff8a65","#fb8c00","#ffb300","#ffd54f","#fff176","#c0ca33","#7cb342","#43a047","#2e7d32","#26a69a","#4dd0e1","#29b6f6","#1e88e5","#3949ab","#7e57c2","#ab47bc","#ec407a","#f8bbd0","#ffccbc","#d7a77a","#8d6e63","#5d4037","#9e9e9e","#424242","#212121","#ffffff"];
write(
  "raskrasit/index.html",
  layout({
    title: "Раскрасить онлайн",
    description: "Раскрашивайте картинки онлайн прямо в телефоне или на компьютере: заливка одним касанием, кисть, ластик. Готовую раскраску можно сохранить и распечатать.",
    canonical: "/raskrasit/",
    head: `<meta name="robots" content="noindex, follow">`,
    breadcrumbs: [{ title: "Раскрасить онлайн" }],
    body: `
<div class="paint" id="paint">
  <div class="paint__head">
    <h1 id="paint-title">Раскрасить онлайн</h1>
    <a class="paint__back" id="paint-back" href="${link("/")}">‹ К раскраске</a>
  </div>
  <div class="paint__bar" role="toolbar" aria-label="Инструменты">
    <button type="button" class="pbtn" data-tool="fill" title="Заливка: нажмите на часть рисунка">🪣<span>Заливка</span></button>
    <button type="button" class="pbtn" data-tool="brush" title="Кисть">🖌<span>Кисть</span></button>
    <button type="button" class="pbtn" data-tool="erase" title="Ластик">🧽<span>Ластик</span></button>
    <span class="paint__sep"></span>
    <button type="button" class="pbtn" id="paint-undo" data-act="undo" title="Отменить">↶<span>Назад</span></button>
    <button type="button" class="pbtn" id="paint-redo" data-act="redo" title="Вернуть">↷<span>Вперёд</span></button>
    <button type="button" class="pbtn pbtn--wide" data-act="zin" title="Увеличить">＋</button>
    <button type="button" class="pbtn pbtn--wide" data-act="zout" title="Уменьшить">－</button>
  </div>
  <div class="paint__stage" id="paint-stage">
    <div class="paint__zoom" id="paint-zoom">
      <canvas id="paint-color"></canvas>
      <canvas id="paint-lines" aria-label="Раскраска"></canvas>
    </div>
  </div>
  <p class="paint__status" id="paint-status" aria-live="polite"></p>
  <div class="paint__size" id="paint-size-box" hidden><label for="paint-size">Толщина кисти</label><input type="range" id="paint-size" min="4" max="70" value="18"></div>
  <div class="paint__colors" aria-label="Цвета">
    <span class="paint__cur" id="paint-cur" title="Текущий цвет"></span>
    ${PALETTE.map((c) => `<button type="button" class="sw" data-color="${c}" style="background:${c}" aria-label="Цвет ${c}"></button>`).join("")}
    <label class="sw sw--custom" title="Свой цвет"><input type="color" id="paint-custom" value="#ff6b5a" aria-label="Свой цвет">+</label>
  </div>
  <div class="paint__actions">
    <button type="button" class="btn btn--main" data-act="save">💾 Сохранить картинку</button>
    <button type="button" class="btn" data-act="print">🖨 Распечатать</button>
    <a class="btn btn--ghost" href="${link("/moi-raskraski/")}">⭐ Мои раскраски</a>
    <button type="button" class="btn btn--ghost" data-act="clear">🗑 Начать заново</button>
  </div>
  <p class="paint__hint">Как раскрашивать: выберите цвет и нажмите на часть рисунка, она зальётся целиком. Мелкие детали удобно увеличить двумя пальцами. Раскраска сохраняется сама, её можно продолжить позже в разделе «Мои раскраски». <button type="button" class="linkbtn" data-install hidden>📲 Установить «${esc(cfg.name)}» как приложение</button></p>
</div>
<div id="paint-pick" hidden>
  <h1>Раскрасить онлайн</h1>
  <p class="lead">Выберите картинку: её можно раскрасить прямо в телефоне или на компьютере, сохранить и распечатать.</p>
  <div class="grid">${sorted.filter(paintable).map((p) => `<a class="card" href="${paintUrl(p)}"><img src="${link("/img/" + p.image)}" alt="${esc(p.title)}" loading="lazy" width="300" height="424"><span>${esc(p.short)}</span></a>`).join("")}</div>
</div>
${ad("bottom")}
<script>window.PAINT_LIST=${JSON.stringify(sorted.filter(paintable).map((p) => ({ s: p.slug, t: p.title, i: link("/img/" + p.image), u: link(pageUrl(p)) }))).replace(/</g, "\\u003c")};</script>
<script src="${link("/color.js")}" defer></script>`,
  })
);
write(
  "moi-raskraski/index.html",
  layout({
    title: "Мои раскраски",
    description: "Раскраски, которые вы раскрашивали онлайн на этом устройстве.",
    canonical: "/moi-raskraski/",
    head: `<meta name="robots" content="noindex, follow">`,
    breadcrumbs: [{ title: "Мои раскраски" }],
    body: `
<h1>Мои раскраски</h1>
<p class="lead">Здесь хранятся картинки, которые вы раскрашивали онлайн на этом телефоне или компьютере. Нажмите на картинку, чтобы продолжить, сохранить или распечатать её. <button type="button" class="linkbtn" data-install hidden>📲 Установить как приложение</button></p>
<p class="lead" id="my-empty" hidden>Пока здесь пусто. Откройте любую раскраску и нажмите «🎨 Раскрасить онлайн» или <a href="${link("/raskrasit/")}">выберите картинку здесь</a>.</p>
<div class="grid works" id="my-works"></div>
${ad("bottom")}
<script src="${link("/color.js")}" defer></script>`,
  })
);

// Поиск: индекс для браузера и страница результатов
write(
  "search-index.json",
  JSON.stringify(
    sorted.map((p) => ({
      t: p.title,
      s: p.short,
      u: link(pageUrl(p)),
      i: link("/img/" + p.image),
      k: [p.g.section.title, p.g.title, ...(p.also || []).map((a) => groupBySlug[a].title), p.text[0]].join(" "),
    }))
  )
);
write(
  "poisk/index.html",
  layout({
    title: "Поиск раскрасок",
    description: `Поиск раскрасок на сайте ${cfg.name}`,
    canonical: "/poisk/",
    head: `<meta name="robots" content="noindex">`,
    breadcrumbs: [{ title: "Поиск" }],
    body: `
<h1>Поиск раскрасок</h1>
<form class="search search--page" action="${link("/poisk/")}" method="get" role="search"><input type="search" name="q" id="q" placeholder="Например: котик, принцесса, Новый год" aria-label="Поиск раскрасок"><button type="submit">Искать</button></form>
<p class="lead" id="search-status"></p>
<div class="grid" id="search-results"></div>
${ad("bottom")}
<script>window.SEARCH_INDEX=${JSON.stringify(link("/search-index.json"))};</script>`,
  })
);

// Служебные страницы
const simple = (slug, title, html) =>
  write(`${slug}/index.html`, layout({ title, description: `${title} — ${cfg.name}`, canonical: `/${slug}/`, breadcrumbs: [{ title }], body: `<h1>${esc(title)}</h1><div class="text">${html}</div>` }));

simple("o-sajte", "О сайте", `
<p>«${esc(cfg.name)}» — сборник бесплатных раскрасок для детей и взрослых. Все рисунки нарисованы специально для сайта.</p>
<p>Раскраски можно скачивать и печатать для себя, для занятий с детьми дома, в детском саду или школе. Продавать и выкладывать их на других сайтах нельзя.</p>`);

simple("kontakty", "Контакты", `<p>Пишите на почту: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>. Мы рады идеям для новых раскрасок!</p><p>Подписывайтесь на нашу группу <a href="https://vk.ru/pro_raskraski" target="_blank" rel="noopener">ВКонтакте</a> и на <a href="https://www.pinterest.com/Elena_raskraskino/" target="_blank" rel="noopener">Pinterest</a>: там мы показываем новые раскраски.</p>`);

simple("privacy", "Политика конфиденциальности", `
<p><i>Это шаблон. Перед запуском впишите свои данные и при сомнениях покажите текст юристу.</i></p>
<p>1. Сайт «${esc(cfg.name)}» (${esc(cfg.url)}) не просит посетителей регистрироваться и не собирает имена, телефоны или адреса.</p>
<p>2. Для учёта посещаемости используется сервис Яндекс Метрика. Он получает обезличенные данные: адрес страницы, тип устройства и браузера, примерное местоположение, файлы cookie.</p>
<p>3. На сайте показывается реклама Рекламной сети Яндекса и/или Google AdSense. Эти сервисы могут использовать cookie, чтобы показывать более подходящую рекламу. Подробнее: <a href="https://yandex.ru/legal/confidential/" rel="nofollow">политика Яндекса</a>, <a href="https://policies.google.com/technologies/ads?hl=ru" rel="nofollow">политика Google</a>.</p>
<p>4. Вы можете отключить cookie в настройках браузера. Сайт при этом продолжит работать.</p>
<p>5. Продолжая пользоваться сайтом, вы соглашаетесь с обработкой данных, указанной выше, в соответствии с Федеральным законом № 152-ФЗ «О персональных данных».</p>
<p>6. Вопросы по обработке данных: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>.</p>`);

write("404.html", layout({ title: "Страница не найдена", description: "Страница не найдена", canonical: "/404.html", body: `<h1>Страница не найдена</h1><p>Попробуйте начать с <a href="${link("/")}">главной страницы</a>.</p>` }));

// Старые адреса (до разделов) → переадресация на новые
function redirect(from, to) {
  if (fs.existsSync(path.join(OUT, from, "index.html"))) return;
  const u = `${cfg.url}${B}${to}`;
  write(`${from.replace(/^\//, "")}index.html`, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Страница переехала</title><link rel="canonical" href="${u}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${link(to)}"><script>location.replace(${JSON.stringify(link(to))}+location.search)</script></head><body><p>Страница переехала: <a href="${link(to)}">${u}</a></p></body></html>`);
}
for (const p of pages) if (p.old && p.old !== pageUrl(p)) redirect(p.old, pageUrl(p));
const oldCats = { "novyj-god": "/prazdniki/novyj-god/" };
for (const [from, to] of Object.entries(oldCats)) redirect(`/${from}/`, to);

// sitemap.xml, robots.txt, ads.txt
const urls = ["/", ...sections.filter((x) => pages.some((p) => inSection(p, x))).map(secUrl), ...groups.filter((g) => pages.some((p) => inGroup(p, g))).map(groupUrl), ...pages.map(pageUrl), "/o-sajte/", "/kontakty/", "/privacy/"];
const lastmod = (u) => (pages.find((p) => pageUrl(p) === u) || {}).added || new Date().toISOString().slice(0, 10);
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${cfg.url}${B}${u}</loc><lastmod>${lastmod(u)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
// RSS-лента для Пинтереста и Дзена: новые раскраски с вертикальной картинкой-пином.
// В ленту попадают только раскраски, добавленные ПОСЛЕ 25.11.2026: всё более раннее
// уже стоит в расписании файла pinterest-vse-piny.csv, иначе пины задублируются.
const RSS_FROM = "2026-11-25";
{
  const items = [...pages].filter((p) => p.added > RSS_FROM).filter((p) => fs.existsSync(path.join(__dirname, "images", `pin-${p.slug.replace(/^raskraska-/, "")}.jpg`)))
    .sort((a, b) => b.added.localeCompare(a.added) || a.slug.localeCompare(b.slug)).slice(0, 60);
  const rss = items.map((p, i) => {
    const pin = `${cfg.url}${B}/img/pin-${p.slug.replace(/^raskraska-/, "")}.jpg`;
    const url = `${cfg.url}${B}${pageUrl(p)}`;
    const date = new Date(`${p.added}T09:00:00+03:00`); date.setMinutes(date.getMinutes() - i);
    return `  <item>
    <title>${esc(p.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${date.toUTCString()}</pubDate>
    <category>${esc(p.g.title)}</category>
    <description>${esc(`<img src="${pin}" alt="${p.title}"><p>${p.title} — скачать бесплатно и распечатать на А4. ${p.text[0]}</p>`)}</description>
    <enclosure url="${pin}" type="image/jpeg" length="0"/>
  </item>`;
  }).join("\n");
  write("rss.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(cfg.name)} — новые раскраски</title>
  <link>${cfg.url}${B}/</link>
  <description>${esc(cfg.tagline)}</description>
  <language>ru</language>
${rss}
</channel>
</rss>
`);
}
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${cfg.url}${B}/sitemap.xml\n`);
if (cfg.adsensePublisherId) write("ads.txt", `google.com, ${cfg.adsensePublisherId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Готово: ${pages.length} раскрасок, разделов: ${sections.length}, подгрупп: ${groups.length} → папка dist/`);
