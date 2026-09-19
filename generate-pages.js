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
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script type="application/ld+json">${JSON.stringify(faq)}</script>
</head>
<body>
  <header><a href="/">Lexie ブロスタセリフ集</a></header>
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
