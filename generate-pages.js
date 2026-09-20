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

// 自動生成したリンク集を index.html に差し込む目印。
// この目印の間だけを毎回作り直すので、何度実行しても結果は同じになる（＝安全）。
const LINKS_START = "<!-- AUTO_BRAWLER_LINKS:START -->";
const LINKS_END = "<!-- AUTO_BRAWLER_LINKS:END -->";
const LINKS_RE = new RegExp(
  LINKS_START.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&") +
    "[\\s\\S]*?" +
    LINKS_END.replace(/[-[\]{}()*+?.,\\^$|#]/g, "\\$&")
);

// ---- 読み込み ----
const rawIndex = fs.readFileSync(TEMPLATE_PATH, "utf8");
// キャラページの型紙からは自動生成リンク集を外す（各ページに二重で入らないように）
const template = rawIndex.replace(LINKS_RE, "");
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

  // (1-2) JavaScript が使える環境かどうかの印を、一番最初に付ける
  //       クローラー（JSを実行しない）には印が付かないので、焼き込み本文は見えたまま。
  //       人間のブラウザでは印が付くので、焼き込み本文を隠してチラつきを防げる。
  html = replaceOnce(
    html,
    /<head>/,
    '<head>\n    <script>document.documentElement.className += " js-on";</script>',
    "<head>"
  );

  // (1-3) ヘッダーのロゴ <h1> を <p> に変える
  //       <h1>は「このページの主題」を示すタグで1ページ1個が原則。
  //       キャラページの主題はキャラ名なので、ロゴ側を降格させる。
  //       見た目は style.css の「header h1, header .site-logo」が担保する。
  html = replaceOnce(
    html,
    /<h1>([\s\S]*?)<\/h1>/,
    '<p class="site-logo">$1</p>',
    "ヘッダーのh1をpに降格"
  );

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

  // (5-2) 詳細セクションを <main> の先頭へ移動する
  //       移動しないと、このページの主題である <h1> の前に、非表示セクション
  //       （お気に入り・単語帳・クイズなど）の見出しが10個並ぶ。
  //       クローラーやAIはHTMLの並び順で文書構造を読むので、
  //       アプリのUIラベルが主題より先に来ると内容の把握が弱くなる。
  //       app.js は "main > .page-section" をまとめて処理するだけで
  //       並び順に依存していないため、動作・見た目への影響はない。
  //       ※ index.html（トップページ）はこの処理の対象外
  const DETAIL_RE = /[ \t]*<section id="brawler-detail-page"[\s\S]*?<\/section>\n?/;
  const detail = html.match(DETAIL_RE);
  if (detail) {
    html = html.replace(DETAIL_RE, "");
    html = replaceOnce(
      html,
      /<main>/,
      `<main>\n      ${detail[0].trim()}\n`,
      "詳細セクションを<main>先頭へ移動"
    );
  } else if (!warned.has("詳細セクションの抽出")) {
    console.warn("  ⚠ 置換対象が見つかりません: 詳細セクションの抽出");
    warned.add("詳細セクションの抽出");
  }

  // (6) 焼き込み本文の最低限の見た目 ＋ 起動スクリプト
  //     JSが動かない環境でも読めるように、prerender-* に簡単なスタイルを当てる
  const boot = `
    <style>
      /* h1 から p に降格したロゴの余白を、元の h1 と同じに戻す */
      header .site-logo { margin: 0 0 10px; }
      /* JSが動く環境では焼き込み本文を隠す。JSなし（クローラー含む）では表示される */
      .js-on .prerender-body { display: none; }
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
        // 差し替えに失敗したときは、隠していた焼き込み本文を出して読めるようにする
        function showFallback() {
          document.documentElement.className =
            document.documentElement.className.replace(/\\s*js-on/, "");
        }
        function boot() {
          if (typeof displayBrawlerDetail !== "function") {
            if (tries++ < 200) setTimeout(boot, 20);
            else showFallback();
            return;
          }
          try { displayBrawlerDetail(data); } catch (e) { console.error("詳細表示に失敗:", e); showFallback(); return; }
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

// ---- トップページに、クローラーが辿れる静的リンク集を埋め込む ----
// キャラカードは JavaScript が作るため、クローラーには1本もリンクが見えない。
// そこで HTML に直接書かれたリンク集を置き、トップから92ページへの道を作る。
const linkItems = all
  .map(
    (b) =>
      `<li><a href="/brawler/${b.id}/" style="color:var(--accent-primary);text-decoration:none;font-size:0.85em">${esc(
        b.data.name
      )}（${esc(b.data.nameEn)}）のセリフ一覧</a></li>`
  )
  .join("\n          ");

const linkIndex = `${LINKS_START}
    <nav class="brawler-link-index" aria-label="全キャラクター一覧" style="max-width:1200px;margin:40px auto 0;padding:24px 16px 40px;border-top:1px solid var(--border-color)">
      <h2 style="font-size:1.1em;margin-bottom:14px">キャラクター別セリフ集（全${all.length}キャラ）</h2>
      <ul style="list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:6px 16px">
          ${linkItems}
      </ul>
    </nav>
    ${LINKS_END}`;

let newIndex;
if (LINKS_RE.test(rawIndex)) {
  newIndex = rawIndex.replace(LINKS_RE, linkIndex); // 2回目以降：中身だけ更新
} else {
  newIndex = rawIndex.replace(/<\/body>/, `${linkIndex}\n  </body>`); // 初回：末尾に追加
}
if (newIndex !== rawIndex) {
  fs.writeFileSync(TEMPLATE_PATH, newIndex, "utf8");
  console.log(`index.html にリンク集を埋め込みました（${all.length}件）`);
}

// ---- sitemap.xml ----
// 「このサイトにはこのURLがあります」という一覧表。検索エンジンに直接渡せる。
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: `${SITE}/`, priority: "1.0", changefreq: "daily" },
  ...all.map((b) => ({
    loc: `${SITE}/brawler/${b.id}/`,
    priority: "0.8",
    changefreq: "weekly",
  })),
  { loc: `${SITE}/privacy.html`, priority: "0.3", changefreq: "yearly" },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
  )
  .join("\n")}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), sitemap, "utf8");
console.log(`sitemap.xml を生成しました（${urls.length} URL）`);

// ---- robots.txt ----
// クローラーへの案内板。どこを見ていいか、地図(sitemap)はどこかを伝える。
const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;
fs.writeFileSync(path.join(ROOT, "robots.txt"), robots, "utf8");
console.log("robots.txt を生成しました");

if (warned.size > 0) {
  console.warn(`⚠ ${warned.size} 種類の置換が見つかりませんでした。index.html の構造が変わった可能性があります。`);
}
