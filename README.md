# Lexie — ブロスタ英語ボイス図鑑

> **あのキャラ、何て言ってるの？**　音声再生＆和訳で、ブロスタ英語をもっと楽しく。

[![サイトを開く](https://img.shields.io/badge/▶%20Live%20Demo-brawl--lexie.vercel.app-00d1ff?style=for-the-badge)](https://brawl-lexie.vercel.app/)

---

## このサイトについて

**Lexie** は、ブロスタ（Brawl Stars）の全91キャラクターの英語ボイスを再生しながら、日本語訳・文法解説を一緒に学べるファンサイトです。

「あのキャラクターが試合中に何を喋っているのか知りたい」というブロスタプレイヤーの疑問を、音声付きで解決します。

- 🌐 本番URL: **https://brawl-lexie.vercel.app/**
- 👤 制作: [Amphibian333](https://github.com/Amphibian333)（あんふぃ）
- 📱 TikTok: [@bion329](https://www.tiktok.com/@bion329)

---

## 主な機能

| 機能 | 説明 |
|---|---|
| 🔊 **ボイス再生** | 個別再生・全曲連続再生・シャッフル再生に対応 |
| 📖 **日本語訳 + 文法解説** | 各セリフの和訳とスラング・文法ポイントを解説 |
| 🙈 **暗記モード** | 日本語訳を黒塗りで隠し、タップで1行ずつ確認できる（英語学習用） |
| 🐢 **再生速度変更** | 0.5x / 0.75x / 1.0x / 1.25x / 1.5x から選択可能 |
| ❤️ **お気に入り登録** | キャラクター・セリフ単位でお気に入りを保存（localStorage） |
| 🔍 **検索・フィルター** | キャラ名検索、レア度・役割での絞り込み |
| 🌙 **ダーク / ライトテーマ** | テーマ設定を保存（localStorage） |
| 📺 **TikTok動画埋め込み** | キャラ解説動画をサイト内で視聴 |

---

## スクリーンショット

> 📸 準備中 — `docs/images/` にスクリーンショットを追加予定

<!--
追加する際はここのコメントを外してください：
![ホーム画面](docs/images/screenshot-home.png)
![キャラ詳細](docs/images/screenshot-detail.png)
-->

---

## 技術スタック

```
HTML / CSS / Vanilla JavaScript
├── フレームワーク : なし（ゼロ依存）
├── ホスティング  : Vercel（mainブランチへのmergeで自動デプロイ）
├── データ        : brawlers.js（91キャラの全セリフデータ）
├── 分析          : Google Analytics 4
└── ビルドツール  : なし（index.htmlをそのままブラウザで開ける）
```

---

## ローカル開発

ビルドツールは不要です。`git clone` してブラウザで開くだけで動きます。

```bash
git clone https://github.com/Amphibian333/brawl-lexie.git
cd brawl-lexie

# ブラウザで index.html を直接開く
open index.html          # macOS
start index.html         # Windows
```

> **Note:** 音声ファイルは外部URL（GitHub Pages）から配信されているため、インターネット接続が必要です。

---

## デプロイフロー

このリポジトリは **main / develop / feature** の3層ブランチ構成で運用しています。

```
main          ← 本番。merge = Vercel 即デプロイ
 └─ develop   ← 統合ブランチ
     └─ feat/xxx, fix/xxx, docs/xxx ...  ← 作業ブランチ
```

1. `develop` からフィーチャーブランチを切る
2. 実装 → push → **Vercel プレビューURL** で動作確認
3. `develop` に向けて PR を作成、レビュー後 merge
4. 機能が一定量貯まったら `develop → main` の大型 PR でリリース

---

## リクエスト・フィードバック

新キャラのボイス追加リクエストや機能のご要望はこちらから：

- 📢 **リクエストフォーム（Google Forms）**: [フォームを開く](https://docs.google.com/forms/d/e/1FAIpQLSd4jicnyFLtY7ydADYmBi7TpVp64VKlC24Ty1voCgiwHGJihg/viewform?usp=dialog)
- 📱 **TikTok**: [@bion329](https://www.tiktok.com/@bion329)

---

## ライセンス・クレジット

> ⚠️ このサイトはブロスタのファンコンテンツです。Supercell による公式承認はありません。

- **セリフデータ引用元**: [Brawl Stars Wiki (Fandom)](https://brawlstars.fandom.com/wiki/Brawl_Stars_Wiki)
- **キャラクター著作権**: © Supercell — [ファンコンテンツポリシー](https://www.supercell.com/fan-content-policy)
- **コードのライセンス**: TBD

---

## English Summary

**Lexie** is a fan-made web app for Brawl Stars players who want to understand what their favorite characters are saying. It features audio playback of all 91 characters' voice lines with Japanese translations, grammar notes, and study tools like a memorization mode and playback speed control.

- 🌐 **Live Demo**: https://brawl-lexie.vercel.app/
- 🛠 **Stack**: Vanilla HTML/CSS/JS — no frameworks, no build step
- 🚀 **Hosting**: Vercel (auto-deploy from `main` branch)

> This is an unofficial fan project and is not affiliated with or endorsed by Supercell.
