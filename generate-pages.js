// キャラ別の静的HTMLページを生成するスクリプト
// 実行: node generate-pages.js

const fs = require("fs");
const path = require("path");

const SITE = "https://brawl-lexie.vercel.app";
const DATA_DIR = path.join(__dirname, "data", "brawlers");
const OUT_DIR = path.join(__dirname, "brawler");

// HTMLとして危険な文字を無害化する（" や < をそのまま書くと壊れるため）
const esc = (s) =>
  String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// explanation は元データが既にHTMLタグ入りなので、タグだけ残して整える
const stripTags = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
const all = files.map((f) => ({
  id: f.replace(/\.json$/, ""),
  data: JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8")),
}));

fs.mkdirSync(OUT_DIR, { recursive: true });

function buildPage({ id, data }) {
  const vls = Array.isArray(data.voicelines) ? data.voicelines : [];
  const title = `【ボイス付き】${data.name}（${data.nameEn}）の英語セリフ全${vls.length}個｜和訳・解説｜Lexie`;
  const desc = `ブロスタの${data.name}（${data.nameEn}）の英語ボイス全${vls.length}セリフを、音声・日本語訳・英語解説つきで掲載。代表セリフ「${stripTags(data.quote)}」の意味も解説。`;
  const url = `${SITE}/brawler/${id}/`;

  // 検索エンジン・AIに「このページは何か」を伝える構造化データ
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

  // FAQ形式：AIが引用しやすい「質問→答え」の形
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: vls.slice(0, 10).map((v) => ({
      "@type": "Question",
      name: `ブロスタの${data.name}のセリフ「${stripTags(v.quote)}」の意味は？`,
      acceptedAnswer: { "@type": "Answer", text: `${stripTags(v.translation)}という意味です。${stripTags(v.explanation).slice(0, 300)}` },
    })),
  };

  const lines = vls
    .map(
      (v, i) => `
      <article class="voiceline" id="${esc(v.id)}">
        <h3>${i + 1}. ${esc(stripTags(v.quote))}</h3>
        <p class="translation"><strong>和訳:</strong> ${esc(stripTags(v.translation))}</p>
        <div class="explanation">${v.explanation || ""}</div>
        ${v.audioUrl ? `<audio controls preload="none" src="${esc(v.audioUrl)}"></audio>` : ""}
      </article>`
    )
    .join("\n");

  const others = all
    .filter((b) => b.id !== id)
    .map((b) => `<li><a href="/brawler/${b.id}/">${esc(b.data.name)}（${esc(b.data.nameEn)}）のセリフ</a></li>`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:image" content="${SITE}/ogp.png">
<link rel="icon" href="/favicon.ico">
<link rel="stylesheet" href="/style.css">
<style>
  body { margin: 0; background: var(--bg-color); color: var(--text-primary); line-height: 1.7; }
  main, footer { max-width: 820px; margin: 0 auto; padding: 0 16px; }
  main { padding-top: 28px; padding-bottom: 60px; }
  header .site-logo { margin: 0; cursor: pointer; }
  header .site-logo a { color: inherit; text-decoration: none; }
  h1 { font-size: 1.7em; line-height: 1.4; margin: 0 0 16px; }
  h2 { font-size: 1.3em; margin: 40px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border-color); }
  .voiceline { background: var(--hero-search-bg); border: 1px solid var(--border-color); border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; }
  .voiceline h3 { margin: 0 0 10px; font-size: 1.15em; color: var(--accent-primary); }
  .translation { margin: 0 0 10px; font-weight: 700; }
  .explanation { color: var(--text-secondary); font-size: 0.95em; }
  .explanation ul { padding-left: 1.2em; }
  audio { width: 100%; margin-top: 14px; }
  nav ul { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
  nav a { color: var(--accent-primary); text-decoration: none; font-size: 0.9em; }
  footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--border-color); }
  footer a { color: var(--accent-primary); }
  @media (max-width: 560px) { nav ul { grid-template-columns: 1fr; } h1 { font-size: 1.4em; } }
</style>
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">${JSON.stringify(faq)}</script>
</head>
<body>
  <header>
    <div class="header-nav-container">
      <p class="site-logo">
        <a href="/">Lexie</a>
        <span class="header-seo-text">【ボイス再生】ブロスタセリフ集｜全91キャラ対応（順次更新中）</span>
      </p>
      <nav>
        <ul>
          <li><a href="/">ホーム</a></li>
          <li><a href="/" style="color: #ff4d4d">❤️ お気に入り</a></li>
          <li><a href="/">📚 単語帳</a></li>
          <li><a href="/" style="color: #ffc107">🎯 クイズ</a></li>
          <li><a href="/">📋 履歴</a></li>
          <li><a href="/">翻訳動画</a></li>
        </ul>
      </nav>
    </div>
  </header>
  <main>
    <h1>${esc(data.name)}（${esc(data.nameEn)}）の英語セリフ一覧・和訳つき</h1>
    <p>ブロスタのキャラクター<strong>${esc(data.name)}</strong>（英語名: ${esc(data.nameEn)}）の英語ボイスセリフ全${vls.length}個を、音声・日本語訳・英語表現の解説つきでまとめています。レアリティは${esc(data.rarity)}、ロールは${esc(data.role)}です。代表的なセリフは「${esc(stripTags(data.quote))}」です。</p>
    <section>
      <h2>${esc(data.name)}のセリフ全${vls.length}個</h2>
${lines}
    </section>
    <nav>
      <h2>他のキャラクターのセリフ</h2>
      <ul>
        ${others}
      </ul>
    </nav>
  </main>
  <footer><p><a href="/">Lexie トップページへ</a></p></footer>
</body>
</html>`;
}

let count = 0;
for (const b of all) {
  const dir = path.join(OUT_DIR, b.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), buildPage(b), "utf8");
  count++;
}
console.log(`生成完了: ${count} ページ -> /brawler/<id>/index.html`);
