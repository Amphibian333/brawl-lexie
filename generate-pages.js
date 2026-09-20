// キャラ別の静的HTMLページを生成するスクリプト（index.html を型紙として使う）
// 実行: node generate-pages.js
//
// 仕組み:
//   index.html（骨格・全機能）＋ data/brawlers/*.json（中身）→ brawler/<id>/index.html
//   生成されたページは index.html と同じ骨格を持つので、app.js がそのまま動く。
//   セリフ本文はHTMLに焼き込まれるので、JavaScriptを待たないクローラーにも読める。
//   ※ index.html 自体は一切変更しない（本体を壊さないため）

const fs = require("fs");
const path = require("path");

const SITE = "https://brawl-lexie.vercel.app";
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data", "brawlers");
const OUT_DIR = path.join(ROOT, "brawler");
const TEMPLATE_PATH = path.join(ROOT, "index.html");

// ---- 読み込み ----
const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
const all = files.map((f) => ({
  id: f.replace(/\.json$/, ""),
  data: JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8")),
}));

// ---- 小道具 ----
// HTMLとして危険な文字を無害化する（" や < をそのまま書くと壊れるため）
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// HTMLタグを取り除いて素のテキストにする（meta説明文などに使う）
const stripTags = (s) =>
  String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// 置換に失敗したら気づけるようにする（黙って壊れるのを防ぐ）
let warned = new Set();
function replaceOnce(html, pattern, replacement, label) {
  if (!pattern.test(html)) {
    if (!warned.has(label)) {
      console.warn(`  ⚠ 置換対象が見つかりません: ${label}`);
      warned.add(label);
    }
    return html;
  }
  return html.replace(pattern, replacement);
}

// ---- 1ページ分を組み立てる ----
function buildPage({ id, data }) {
  const vls = Array.isArray(data.voicelines) ? data.voicelines : [];
  const title = `【ボイス付き】${data.name}（${data.nameEn}）の英語セリフ全${vls.length}個｜和訳・解説｜Lexie`;
  const desc = `ブロスタの${data.name}（${data.nameEn}）の英語ボイス全${vls.length}セリフを、音声・日本語訳・英語解説つきで掲載。代表セリフ「${stripTags(data.quote)}」の意味も解説。`;
  const url = `${SITE}/brawler/${id}/`;

  let html = template;

  // (1) 相対パスを絶対パスに直す
  //     /brawler/shelly/ から "app.js" を探すと /brawler/shelly/app.js になって失敗するため
  html = html
    .replace(/href="style\.css"/g, 'href="/style.css"')
    .replace(/src="app\.js"/g, 'src="/app.js"')
    .replace(/src="data\/changelog\.js"/g, 'src="/data/changelog.js"');

  // (2) タイトル・説明文をこのキャラ用に差し替える
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`, "title");
  html = replaceOnce(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${esc(desc)}" />`,
    "meta description"
  );
  html = replaceOnce(
    html,
    /<meta property="og:title"[^>]*>/,
    `<meta property="og:title" content="${esc(title)}" />`,
    "og:title"
  );
  html = replaceOnce(
    html,
    /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${esc(desc)}" />`,
    "og:description"
  );
  html = replaceOnce(
    html,
    /<meta property="og:url"[^>]*>/,
    `<meta property="og:url" content="${url}" />`,
    "og:url"
  );
  html = replaceOnce(
    html,
    /<meta name="twitter:title"[^>]*>/,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    "twitter:title"
  );
  html = replaceOnce(
    html,
    /<meta name="twitter:description"[^>]*>/,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    "twitter:description"
  );

  // (3) canonical と構造化データ（JSON-LD）を head に足す
  const jsonld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: desc,
    inLanguage: "ja",
    url,
    isPartOf: { "@type": "WebSite", name: "Lexie", url: SITE },
    about: { "@type": "Thing", name: `${data.name} (${data.nameEn}) - ブロスタ` },
    author: { "@type": "Person", name: "あんふぃ" },
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vls.slice(0, 10).map((v) => ({
      "@type": "Question",
      name: `ブロスタの${data.name}のセリフ「${stripTags(v.quote)}」の意味は？`,
      acceptedAnswer: {
        "@type": "Answer",
        text: `${stripTags(v.translation)}という意味です。${stripTags(v.explanation).slice(0, 300)}`,
      },
    })),
  };
  const headExtra = `
    <link rel="canonical" href="${url}" />
    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
    <script type="application/ld+json">${JSON.stringify(faq)}</script>
  </head>`;
  html = replaceOnce(html, /<\/head>/, headExtra, "</head>");

  // (4) クローラー用の本文を器に焼き込む
  //     JavaScript が動くとここは本体のリッチUIで上書きされる
  const staticLines = vls
    .map(
      (v, i) => `
          <article class="prerender-voiceline">
            <h3>${i + 1}. ${esc(stripTags(v.quote))}</h3>
            <p><strong>和訳:</strong> ${esc(stripTags(v.translation))}</p>
            <div>${v.explanation || ""}</div>
          </article>`
    )
    .join("");

  const staticContent = `<div id="brawler-detail-content">
        <div class="prerender-body">
          <h1>${esc(data.name)}（${esc(data.nameEn)}）の英語セリフ一覧・和訳つき</h1>
          <p>ブロスタのキャラクター<strong>${esc(data.name)}</strong>（英語名: ${esc(data.nameEn)}）の英語ボイスセリフ全${vls.length}個を、音声・日本語訳・英語表現の解説つきでまとめています。代表的なセリフは「${esc(stripTags(data.quote))}」です。</p>
          <h2>${esc(data.name)}のセリフ全${vls.length}個</h2>${staticLines}
          <nav class="prerender-nav">
            <h2>他のキャラクターのセリフ</h2>
            <ul>${all
              .filter((b) => b.id !== id)
              .map(
                (b) =>
                  `<li><a href="/brawler/${b.id}/">${esc(b.data.name)}（${esc(b.data.nameEn)}）のセリフ</a></li>`
              )
              .join("")}</ul>
          </nav>
        </div>
      </div>`;
  html = replaceOnce(
    html,
    /<div id="brawler-detail-content"><\/div>/,
    staticContent,
    "brawler-detail-content"
  );

  // (5) 開いた瞬間に詳細ページが見えている状態にする
  //     hero（キャラ一覧）は隠し、詳細セクションの hidden を外す
  //     まず全セクションを隠す（hero だけでなく about なども対象。隠し漏れがあると
  //     ページを開いた瞬間にトップの中身がちらつく）
  let hiddenCount = 0;
  html = html.replace(
    /(<section id="[^"]*" class="page-section)([^"]*)">/g,
    (m, head, rest) => {
      if (rest.includes("hidden")) return m;
      hiddenCount++;
      return `${head}${rest} hidden">`;
    }
  );
  //     そのうえで詳細ページだけを表示状態にする
  html = replaceOnce(
    html,
    /<section id="brawler-detail-page" class="page-section hidden">/,
    '<section id="brawler-detail-page" class="page-section">',
    "詳細ページを表示"
  );

  // (6) 焼き込み本文の最低限の見た目 ＋ 起動スクリプト
  //     JSが動かない環境でも読めるように、prerender-* に簡単なスタイルを当てる
  const boot = `
    <style>
      .prerender-body { max-width: 900px; margin: 0 auto; padding: 20px 16px 60px; }
      .prerender-body h1 { font-size: 1.8em; line-height: 1.4; margin-bottom: 16px; }
      .prerender-body h2 { font-size: 1.3em; margin: 32px 0 14px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
      .prerender-voiceline { border: 1px solid var(--border-color); border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; }
      .prerender-voiceline h3 { color: var(--accent-primary); margin: 0 0 8px; font-size: 1.1em; }
      .prerender-nav ul { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 16px; }
      .prerender-nav a { color: var(--accent-primary); text-decoration: none; font-size: 0.9em; }
      @media (max-width: 560px) { .prerender-nav ul { grid-template-columns: 1fr; } }
    </style>
    <script type="application/json" id="brawler-prerender-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>
    <script>
      // このページのキャラを、本体と同じUIで開き直す。
      // 失敗しても焼き込み済みの本文がそのまま残るので、ページが壊れることはない。
      (function () {
        var el = document.getElementById("brawler-prerender-data");
        if (!el) return;
        var data;
        try { data = JSON.parse(el.textContent); } catch (e) { return; }
        var tries = 0;
        function boot() {
          if (typeof displayBrawlerDetail !== "function") {
            if (tries++ < 200) setTimeout(boot, 20);
            return;
          }
          try { displayBrawlerDetail(data); } catch (e) { console.error("詳細表示に失敗:", e); }
          // 「一覧へ戻る」を本物のページ遷移にする（URLを残さないため）
          try {
            document.querySelectorAll(".back-to-list-button, #back-to-list-btn").forEach(function (btn) {
              btn.onclick = function (e) { e.preventDefault(); location.href = "/"; };
            });
          } catch (e) {}
        }
        // 画像や音声の読み込みは待たない。DOMが組み上がった直後に差し替える
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 0); });
        } else {
          setTimeout(boot, 0);
        }
      })();
    </script>
  </body>`;
  html = replaceOnce(html, /<\/body>/, boot, "</body>");

  return html;
}

// ---- 書き出し ----
fs.mkdirSync(OUT_DIR, { recursive: true });
let count = 0;
for (const b of all) {
  const dir = path.join(OUT_DIR, b.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), buildPage(b), "utf8");
  count++;
}
console.log(`生成完了: ${count} ページ -> /brawler/<id>/index.html`);
if (warned.size > 0) {
  console.warn(`⚠ ${warned.size} 種類の置換が見つかりませんでした。index.html の構造が変わった可能性があります。`);
}
