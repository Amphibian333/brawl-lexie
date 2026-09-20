# Lexie 引き継ぎメモ

最終更新: 2026-09-21（sitemap提出・見出し構造・セキュリティヘッダー） / 作業環境: Mac → Windows へ移行

---

## 1. このプロジェクトが今どうなっているか

**目的**: AI検索（ChatGPT / Perplexity / Google AI）に Lexie が引用されるようにする（GEO対策）。

**作業前の問題**: サイトは `index.html` 1枚のSPAで、91キャラ分のセリフは全部JavaScriptが後から読み込んでいた。クローラーはJSを実行しないので、**1ページ分・約5,400字しか認識されていなかった**。

**現在**: 各キャラが独立したHTMLページとして存在する MPA + SSG 構成。

| 項目 | 作業前 | 現在 |
|---|---|---|
| クローラーが読めるページ | 1 | 93 |
| 読めるテキスト量 | 約5,400字 | 約150万字 |
| sitemap.xml | なし | 94URL |
| robots.txt | なし | あり |
| 構造化データ | 0 | 184個（Article + FAQ × 92） |
| canonical | なし | 全93ページ |

検証済み（SiteOne Crawler、localhost）: トップページ起点で93ページ全部に到達可能。

---

## 2. 仕組み（最重要）

```
index.html（骨格・全機能）  ＋  data/brawlers/*.json（中身）
                    ↓  node generate-pages.js
        brawler/<id>/index.html × 92 ＋ sitemap.xml ＋ robots.txt
```

- 各キャラページは **index.html と同じ骨格**を持つ。だから `app.js` がそのまま動き、本体と同じUI・機能になる
- セリフ本文はHTMLに**焼き込まれている**ので、JSを実行しないクローラーにも読める
- JSが動く環境では、焼き込み本文は `js-on` クラスで隠され、`displayBrawlerDetail()` が本体UIに差し替える（プログレッシブ・エンハンスメント）
- `index.html` の `<!-- AUTO_BRAWLER_LINKS:START/END -->` の間は生成スクリプトが毎回作り直す。**手で編集しないこと**

**直す場所は3つだけ:**

| 変えたいもの | 直すファイル |
|---|---|
| 見た目 | `style.css` |
| 機能・動き | `app.js` |
| ページ構造・メタ情報 | `generate-pages.js` |
| キャラのデータ | `data/brawlers/<id>.json` |

---

## 3. 日常の運用

### 新キャラを追加したとき

```bash
# 1. data/brawlers/<新キャラ>.json を追加
# 2. data/brawlers-index.json にも追加
node generate-pages.js
git add -A
git commit -m "feat: <新キャラ>を追加"
git push
```

これだけ。HTMLは一切触らない。

### 見た目や機能を変えたとき

`style.css` または `app.js` を編集 → `node generate-pages.js` → commit → push

---

## 4. git 運用ルール

- **本番に影響する変更はブランチを切ってから**

```bash
git switch -c feature/<作業名>
# 作業・commit
git push -u origin feature/<作業名>
# Vercelがプレビューurlを自動生成 → 検証
git switch main
git merge feature/<作業名>
git push
```

- 2台で作業する場合: 作業前に必ず `git pull`、終わったら必ず `git push`

---

## 5. 残タスク（優先順）

1. **【2026-09-21 完了】Google Search Console に sitemap.xml を提出**
   - プロパティは登録・所有権確認ともに済みだった（URL prefix 方式）
   - サイトマップ送信ステータス「成功しました」を確認
2. **3〜7日後にインデックス数を確認** ← 次にやること
   - Search Console → インデックス作成 → ページ
   - 「インデックス登録済み」が93前後に向かって増えていれば成功
   - 増えない場合は、除外理由（「クロール済み - インデックス未登録」など）を見る
3. AI検索での可視性を定期チェック（ミエルカGEO / AIOGeoScan など）
4. CSP（Content-Security-Policy）の追加。**保留中**
   - 理由: サイトがインラインscript・インラインstyle・Google Tag Manager を多用しており、
     `'unsafe-inline'` を許可しないと動かない。許可すると防御効果がほぼ無くなる
   - やるならブランチを切って、Vercelプレビューではなく本番相当で要検証

### 2026-09-21 に完了した分

- **見出し構造**（旧タスク2）
  - SiteOne の実際の指摘は「見出しレベルの飛び」ではなく **`<h1>` が1ページに2個**だった。
    HANDOFF の記述が誤り。ヘッダーロゴの h1→p 降格で解決済み（本番確認済み）
  - 追加で、`generate-pages.js` に **(5-2) 詳細セクションを `<main>` 先頭へ移動**する処理を追加。
    これをしないと、ページの主題である h1 の前に、非表示セクション
    （お気に入り・単語帳・クイズ等）の見出しが10個並ぶ。
    移動後は h1 が文書内の1番目の見出しになる
- **セキュリティヘッダー**（旧タスク3）
  - `vercel.json` を新規作成。nosniff / Referrer-Policy / X-Frame-Options /
    Permissions-Policy / HSTS の5つ。CSPは上記の理由で見送り

---

## 6. 検証方法

### ローカルで全ページをクロール

```bash
python3 -m http.server 8080 &
siteone-crawler --url=http://localhost:8080/
pkill -f http.server
```

HTMLが93個出れば正常。

### クローラーが見ているHTMLを直接確認

ブラウザでページを開き `Ctrl + U`（Windows）/ `Cmd + U`（Mac）。JSを実行しない生のHTMLが見える。

※ Vercelのプレビューurlは認証保護がかかっていてクローラーが入れない。検証はローカルか本番で行うこと。

---

## 7. 注意点・ハマったこと

- **`.git/index.lock` が残ることがある** → `rm -f .git/index.lock` で解消
- **`git add .` ではなく `git add -A`** を使う。削除されたファイルも記録するため
- `tmp/` はクロールレポートの出力先。`.gitignore` 済み
- `app.js` の `fetch` は `/data/...` とルート始まりに修正済み。相対パスに戻すと深い階層から読めなくなる
- `<h1>` は1ページ1個。ヘッダーのロゴは生成時に `<p class="site-logo">` へ降格させている

---

## 8. Windows での再開手順

```bash
git clone https://github.com/Amphibian333/brawl-lexie.git
cd brawl-lexie
node generate-pages.js   # 動作確認
```

必要なもの: `git`, `node`

Cowork（Claude）で再開する場合は、このフォルダを連携してから「HANDOFF.md を読んで」と伝えれば文脈が復元される。

※ 2026-09-21 時点の制約: 9/8 の Windows 更新の影響で、Cowork のシェルが連携フォルダを
マウントできない（`no Plan9 drive shares mounted` エラー）。Claude はファイルの読み書きは
できるが、**このPC上でコマンドを実行できない**。`node generate-pages.js` や git 操作は
自分のターミナルで行うこと。Claude Code は影響を受けない。
