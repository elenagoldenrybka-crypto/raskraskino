// Сборка сайта: node build.js  →  готовый сайт в папке dist/
// Ничего устанавливать не нужно, достаточно Node.js 18+.
const fs = require("fs");
const path = require("path");

const cfg = require("./site.config.js");
const categories = require("./content/categories.json");
const pages = require("./content/raskraski.json");

const OUT = path.join(__dirname, "dist");
const B = cfg.basePath.replace(/\/$/, "");
const year = new Date().getFullYear();

// ---------- помощники ----------
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const link = (p) => `${B}${p}`;
const catBySlug = Object.fromEntries(categories.map((c) => [c.slug, c]));
const pageUrl = (p) => `/${p.category}/${p.slug}/`;
const catUrl = (c) => `/${c.slug}/`;

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
  return `<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});</script><noscript><div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute;left:-9999px" alt=""></div></noscript>`;
}

function card(p) {
  return `<a class="card" href="${link(pageUrl(p))}">
  <img src="${link("/img/" + p.image)}" alt="${esc(p.title)}" loading="lazy" width="300" height="424">
  <span>${esc(p.short)}</span></a>`;
}

function layout({ title, description, canonical, body, breadcrumbs = [], jsonld = null }) {
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
<link rel="canonical" href="${cfg.url}${B}${canonical}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="icon" href="${link("/favicon.svg")}" type="image/svg+xml">
<link rel="stylesheet" href="${link("/style.css")}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
${metrika()}
</head>
<body>
<header class="top">
  <div class="wrap top__in">
    <a class="logo" href="${link("/")}"><span class="logo__dot"></span>${esc(cfg.name)}</a>
    <nav class="menu">${categories.map((c) => `<a href="${link(catUrl(c))}">${esc(c.short)}</a>`).join("")}</nav>
  </div>
</header>
<div class="wrap layout">
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

// ---------- сборка ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ["style.css", "app.js", "favicon.svg"]) fs.copyFileSync(path.join(__dirname, "src", f), path.join(OUT, f));
fs.mkdirSync(path.join(OUT, "img"));
for (const f of fs.readdirSync(path.join(__dirname, "images"))) fs.copyFileSync(path.join(__dirname, "images", f), path.join(OUT, "img", f));

const sorted = [...pages].sort((a, b) => b.added.localeCompare(a.added));

// Главная
write(
  "index.html",
  layout({
    title: cfg.name,
    description: `${cfg.tagline}. Раскраски по темам: ${categories.map((c) => c.short.toLowerCase()).join(", ")}. Скачать в хорошем качестве или распечатать на А4.`,
    canonical: "/",
    body: `
<section class="hero">
  <h1>Бесплатные раскраски для детей</h1>
  <p>Выберите картинку, нажмите «Распечатать» или «Скачать». Все раскраски — формата А4, с чёткими контурами.</p>
</section>
${ad("top")}
<h2>Темы</h2>
<div class="cats">${categories
      .map((c) => {
        const first = pages.find((p) => p.category === c.slug);
        const n = pages.filter((p) => p.category === c.slug).length;
        return `<a class="cat" href="${link(catUrl(c))}">${first ? `<img src="${link("/img/" + first.image)}" alt="" loading="lazy">` : ""}<b>${esc(c.title)}</b><small>${n} шт.</small></a>`;
      })
      .join("")}</div>
${ad("middle")}
<h2>Новые раскраски</h2>
<div class="grid">${sorted.slice(0, 12).map(card).join("")}</div>
${ad("bottom")}`,
  })
);

// Категории
for (const c of categories) {
  const list = sorted.filter((p) => p.category === c.slug);
  write(
    `${c.slug}/index.html`,
    layout({
      title: `Раскраски: ${c.title.toLowerCase()}`,
      description: c.description,
      canonical: catUrl(c),
      breadcrumbs: [{ title: c.title }],
      body: `
<h1>Раскраски: ${esc(c.title.toLowerCase())}</h1>
<p class="lead">${esc(c.description)}</p>
${ad("top")}
<div class="grid">${list.map(card).join("")}</div>
${ad("bottom")}`,
    })
  );
}

// Страницы раскрасок
for (const p of pages) {
  const c = catBySlug[p.category];
  const related = sorted.filter((x) => x.slug !== p.slug && x.category === p.category)
    .concat(sorted.filter((x) => x.category !== p.category))
    .slice(0, 4);
  const img = link("/img/" + p.image);
  write(
    `${p.category}/${p.slug}/index.html`,
    layout({
      title: p.title,
      description: `${p.title} — скачать бесплатно и распечатать на А4. ${p.text[0]}`.slice(0, 160),
      canonical: pageUrl(p),
      breadcrumbs: [{ title: c.title, url: catUrl(c) }, { title: p.short }],
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
  <img src="${img}" alt="${esc(p.title)} — контурный рисунок для раскрашивания" width="600" height="848">
</figure>
<div class="actions">
  <button type="button" class="btn btn--main" data-print>🖨 Распечатать</button>
  <button type="button" class="btn" data-png="${img}" data-name="${esc(p.slug)}">⬇ Скачать PNG</button>
  <a class="btn btn--ghost" href="${img}" download="${esc(p.slug)}.svg">Скачать SVG</a>
</div>
<p class="meta">Возраст: ${esc(p.age)} · Формат: А4, вертикально · Тема: <a href="${link(catUrl(c))}">${esc(c.title)}</a></p>
${ad("middle")}
<section class="about">
  <h2>Об этой раскраске</h2>
  ${p.text.map((t) => `<p>${esc(t)}</p>`).join("\n  ")}
  <p>Как распечатать: нажмите «Распечатать», в окне печати выберите формат А4 и книжную ориентацию. Картинка сама растянется на весь лист.</p>
</section>
${ad("bottom")}
<h2>Похожие раскраски</h2>
<div class="grid">${related.map(card).join("")}</div>`,
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

// sitemap.xml, robots.txt, ads.txt
const urls = ["/", ...categories.map(catUrl), ...pages.map(pageUrl), "/o-sajte/", "/kontakty/", "/privacy/"];
const lastmod = (u) => (pages.find((p) => pageUrl(p) === u) || {}).added || new Date().toISOString().slice(0, 10);
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${cfg.url}${B}${u}</loc><lastmod>${lastmod(u)}</lastmod></url>`)
    .join("\n")}\n</urlset>\n`
);
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${cfg.url}${B}/sitemap.xml\n`);
if (cfg.adsensePublisherId) write("ads.txt", `google.com, ${cfg.adsensePublisherId}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Готово: ${pages.length} раскрасок, тем: ${categories.length} → папка dist/`);
