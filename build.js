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
<link rel="canonical" href="${cfg.url}${B}${canonical}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${link("/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${link("/style.css")}">
${head}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${metrika()}
</head>
<body>
<header class="top">
  <div class="wrap top__in">
    <a class="logo" href="${link("/")}"><span class="logo__dot"></span>${esc(cfg.name)}</a>
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
    <p><a href="${link("/o-sajte/")}">О сайте</a> · <a href="${link("/privacy/")}">Политика конфиденциальности</a> · <a href="${link("/kontakty/")}">Контакты</a></p>
  </div>
</footer>
<div class="cookie" id="cookie" hidden>
  <span>Мы используем cookies и сервисы аналитики, чтобы сайт работал лучше. Подробнее — в <a href="${link("/privacy/")}">политике конфиденциальности</a>.</span>
  <button type="button" id="cookie-ok">Понятно</button>
</div>
<script src="${link("/app.js")}" defer></script>
</body>
</html>`;
}

// Окно просмотра: картинка, стрелки, кнопки и место под рекламу
function viewer(current) {
  // порядок листания: сначала та же тема, потом остальные
  const s = current.g.section;
  const list = pages.filter((x) => x.group === current.group)
    .concat(pages.filter((x) => x.group !== current.group && inSection(x, s)))
    .concat(pages.filter((x) => !inSection(x, s)));
  const data = list.map((x) => ({ t: x.title, s: x.slug, img: link("/img/" + x.image), url: link(pageUrl(x)) }));
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
      <button type="button" class="vbtn vbtn--print" data-v="print">🖨 Распечатать</button>
      <button type="button" class="vbtn vbtn--down" data-v="png">⬇ Скачать PNG</button>
      <button type="button" class="vbtn vbtn--half" data-v="half">✂ Печать на пол-листа</button>
      <button type="button" class="vbtn vbtn--share" data-v="share">↗ Поделиться</button>
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
for (const f of ["style.css", "app.js", "favicon.svg"]) fs.copyFileSync(path.join(__dirname, "src", f), path.join(OUT, f));
// Файлы из папки public/ копируются в корень сайта как есть (подтверждения Вебмастера и т.п.)
const PUB = path.join(__dirname, "public");
if (fs.existsSync(PUB)) for (const f of fs.readdirSync(PUB)) fs.copyFileSync(path.join(PUB, f), path.join(OUT, f));
fs.mkdirSync(path.join(OUT, "img"));
for (const f of fs.readdirSync(path.join(__dirname, "images"))) fs.copyFileSync(path.join(__dirname, "images", f), path.join(OUT, "img", f));

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
${ad("top")}
<div class="grid">${l.map(card).join("")}</div>
${ad("bottom")}
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
  <button type="button" class="sheet__open" data-open aria-label="Открыть раскраску в большом окне">
    <img src="${img}" alt="${esc(p.title)} — контурный рисунок для раскрашивания" width="600" height="848">
    <span class="sheet__zoom">Открыть и распечатать</span>
  </button>
</figure>
<div class="actions">
  <button type="button" class="btn btn--main" data-open>🖨 Распечатать</button>
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

// Служебные страницы
const simple = (slug, title, html) =>
  write(`${slug}/index.html`, layout({ title, description: `${title} — ${cfg.name}`, canonical: `/${slug}/`, breadcrumbs: [{ title }], body: `<h1>${esc(title)}</h1><div class="text">${html}</div>` }));

simple("o-sajte", "О сайте", `
<p>«${esc(cfg.name)}» — сборник бесплатных раскрасок для детей и взрослых. Все рисунки нарисованы специально для сайта.</p>
<p>Раскраски можно скачивать и печатать для себя, для занятий с детьми дома, в детском саду или школе. Продавать и выкладывать их на других сайтах нельзя.</p>`);

simple("kontakty", "Контакты", `<p>Пишите на почту: <a href="mailto:${esc(cfg.email)}">${esc(cfg.email)}</a>. Мы рады идеям для новых раскрасок!</p>`);

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
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${cfg.url}${B}/sitemap.xml\n`);
if (cfg.adsensePublisherId) write("ads.txt", `google.com, ${cfg.adsensePublisherId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Готово: ${pages.length} раскрасок, разделов: ${sections.length}, подгрупп: ${groups.length} → папка dist/`);
