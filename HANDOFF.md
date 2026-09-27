# Lexie 引き継ぎメモ

最終更新: 2026-09-22（キャラ数自動化・トップcanonical・favicon軽量化・シリウス追加） / 作業環境: Mac → Windows へ移行

---

## 1. このプロジェクトが今どうなっているか

**目的**: AI検索（ChatGPT / Perplexity / Google AI）に Lexie が引用されるようにする（GEO対策）。

**作業前の問題**: サイトは `index.html` 1枚のSPAで、91キャラ分のセリフは全部JavaScriptが後から読み込んでいた。クローラーはJSを実行しないので、**1ページ分・約5,400字しか認識されていなかった**。

**現在**: 各キャラが独立したHTMLページとして存在する MPA + SSG 構成。

| 項目 | 作業前 | 現在 |
|---|---|---|
| クローラーが読めるページ | 1 | 94 |
| 読めるテキスト量 | 約5,400字 | 約150万字 |
| sitemap.xml | なし | 95URL |
| robots.txt | なし | あり |
| 構造化データ | 0 | 186個（Article + FAQ × 93） |
| canonical | なし | 全94ページ |

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

#### 素材の置き場所（シリウス以降）

- 既存92キャラ: 音声は `https://Amphibian333.github.io/<id>.mp3`、アイコンは imgur
- **シリウス以降: 音声は `audio/<id>.mp3`、アイコンは `icons/<fileId>.png` としてこのリポジトリに置く**
  - JSON では `"audioUrl": "/audio/sirius_vl1.mp3"`、`"iconUrl": "/icons/sirius.png"` のように **`/` 始まり**で書く（キャラページは `/brawler/<id>/` の深さにあるため）
  - アイコンは表示が正方形・円形切り抜きなので、**正方形に切り抜いてから**置く（元画像が横長だと詳細ページで潰れる）

#### 新キャラ追加の自動化（2026-09-22〜）

1. デスクトップの `lexie_inbox/<英語名小文字>/` に3つ入れる
   - `voicelines.txt`（Fandom のセリフ欄をそのままコピペ）
   - `icon.png`（アイコン。横長でもOK）
   - `audio/`（Supercell Fan Kit の音声。zip のままでもOK）
   - 任意で `info.txt`（`日本語名: シリウス`）
2. Cowork で「lexie_inbox のキャラを追加して」と頼む（スキル **lexie-factory**）
3. Claude が test/<キャラ> ブランチに `git add` まで済ませるので、自分で commit → push → プレビュー確認 → main へ merge

仕組み:
- 音声の聞き取りは `lexie_factory/tools/lexie_match.py`（sherpa-onnx + Whisper base.en。PyTorch 不要で Cowork の中で動く。モデルは `lexie_factory/models/`）
  - シリウスで検証: 旧 run.py（Whisper small）と 55件中53件一致。旧版が取りこぼした vl10・vl36 も拾えた
- サイトへの組み込みは `lexie_factory/tools/lexie_publish.py`（音声コピー・アイコン切り抜き・JSON・index・お知らせバナー・ページ再生成）
- 元データは `lexie_factory/mp3_files/<キャラ>/`、名前付け後は `mp3_files/<キャラ>/<キャラ>_edited/`
- 旧 `run.py`（Windows の venv）は予備として残してある

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

1. **3〜7日後にインデックス数を確認** ← 次にやること（9/28 にリマインド設定済み）
   - Search Console → インデックス作成 → ページ
   - 「インデックス登録済み」が93前後に向かって増えていれば成功
   - 増えない場合は、除外理由（「クロール済み - インデックス未登録」など）を見る
2. AI検索での可視性を定期チェック（ミエルカGEO / AIOGeoScan など）
3. **サイトと TikTok のアイコンを統一する**
   - 現状: Lexie はオオカミ、TikTok はコルト（ブロスタ公式キャラ）。TikTok から来た人が同じ運営者だと気づけない
   - ⚠ 統一先は**オリジナルのアイコン**にすること。公式キャラをサイトの顔にすると、
     Supercell ファンコンテンツポリシーの「公認の印象を与えてはいけない」「ロゴ・商標に似たものを作ってはいけない」に抵触しうる
   - 方向性: 「セリフを聴いて訳すサイト」を表すもの（吹き出し・音の波形・翻訳記号など）
4. フォームのラベル欠落（94ページ）
   - クイズ・検索の入力欄に `<label>` がない。アクセシビリティの指摘で、SEOには直接効かない
5. CSP（Content-Security-Policy）の追加。**保留中**
   - 理由: サイトがインラインscript・インラインstyle・Google Tag Manager を多用しており、
     `'unsafe-inline'` を許可しないと動かない。許可すると防御効果がほぼ無くなる
   - SiteOne はこれを critical と出すが、承知のうえで見送っている判断
   - やるならブランチを切って、Vercelプレビューではなく本番相当で要検証

### 2026-09-27 に完了した分

- **ナジア（Najia / アタッカー / ウルトラレア）を追加** — 105体目。69セリフ・**欠番なし**（ブランチ `test/najia`）
  - 日本語名「ナジア」は `info.txt` 指定。GameWith・ゲームラインとも一致。2026年3月実装の Mythic ダメージディーラー（101体目のブロウラー）。
    設定は「ピラミッドクエスト」3人組（フィンクス／タンブル／ナジア）の一員で、フィンクスに雇われて謎を難しくする役だったが、
    根が善良なので閉じ込められた人を助ける側に回った（Fandom / Brawlify）
  - ⚠️ **ブランチの親が `main` ではなく `test/bolt`**。作業開始時、ボルトは commit 済みだが **main には未マージ**だった。
    main から切ると生成ページとキャラ数がボルト抜きで再生成され、2本を merge するときに全ページ規模の衝突になるため、
    `test/bolt` の上に積んだ。**`test/najia` を merge すればボルトも一緒に入る**
  - Fandom・Fan Kit とも**旧命名**（`Najia start vo 01.ogg` / `najia_start_vo_01.wav`）で 1:1 対応。
    `unreliable_scenes` は空、`missing` 0 で**一発完全一致（69/69）**。内訳は start13 / lead10 / hurt8 / kill14 / die9 / ulti15。
    Fandom の Attacking 列は空で Fan Kit にも攻撃ボイスなし
  - **セリフ69行中22行がアラビア語（エジプト方言）**。`{{Translate|A|B}}` の A側（アラビア語＋音写＝実音声と一致するほう）を採用。
    `clean_quote()` が外側の `"` だけを外すため `ايه ده؟ وجع." ("eh dah? wagae` と**引用符が壊れた形**になるので、
    22本すべて `ايه ده؟ وجع. (eh dah? wagae)` の形に整えた（既存キャラの quote に外側引用符を付けない慣例にも合わせた）。英語47本は Fandom 原文どおり
    - Fandom 側の記述ミスが2件（`كيف كده!؟` と `أنا الأقوى.` は `{{Translate}}` の A側の閉じ引用符が欠落）。整形で吸収済み
    - アラビア語と英語で**同じ内容のペアが2組**ある（`The snakes say hi.`↔`الثعابين بتسلم.` / `The result is clear.`↔`النتيجة واضحة.`）。
      表記が違うので wikimap の重複統合には掛からず、4本とも別セリフとして残した（正しい）
  - **スキン「バック・トゥ・スクール」の音声9本が本体と同じ `najia_` 接頭辞**（ダミアンの `BS_SpaceDamian_` と違いブロウラー名では弾けない）。
    ただし9本とも `_vo` を含まない効果音名（`najia_back_to_school_kill_01.ogg` など）なので、
    **`key_of()` の命名規則フィルタで候補に入る前に落ちる**。`brawler_names_seen` には計上されないので **`{najia: 69}` の表示だけでは証明にならない**。
    全94ファイルに `key_of()` / `name_of()` を直接かけて、候補69本が全て `najia` 本体・`back_to_school` が0件であることを実測確認した
  - `.sfk` 5本（Sound Forge の波形インデックス）は `AUDIO_EXT` に含まれないため拡張子の時点で除外。BGM `najia_theme_01.wav` と効果音16個も命名規則で除外
  - アイコンは inbox の `icon.png`（`Portrait_Najia` 345×220）。crop は `5,0,200`。
    もう1案の `0,0,220` は右下に壺の黄色が入るので不採用
  - 検証: 音声69本を元wavと**尺で全数照合**（全件一致）、**全69本を whisper で書き起こして突き合わせ**。
    英語47本は**47/47 が期待セリフと一致**。アラビア語22本は多言語モデルで20本が音韻的に一致、
    残り2本（`ده مش هيوقفني` / `مش كان في شك`）は base モデルがエジプト方言を取れなかっただけで取り違えではない
    （割り当てはファイル名の 1:1 対応が根拠、かつ英語47本が全て一致して順序が確定している）。
    公開後の mp3 は工場側と **md5 一致（69/69）**。既存104ページの差分は「全104→全105」「バナー ボルト→ナジア」
    「リンク一覧に najia 1行」のみで**退行なし**。audio/ icons/ の既存ファイルは1件も変化なし
  - 📝 サイトの `phinks.json`（nameEn: `Phinks`）は**公式表記が `Finx`** と判明。ナジアのセリフ側は Fandom 原文どおり `Finx`、
    和訳は既存サイトに合わせて「フィンクス」で統一した。`phinks.json` 自体は**今回触っていない**（要判断）
  - ⚠️ **今回も削除許可が下りなかった**（`rm` が `Operation not permitted`）。`mv` は通る。
    `lexie_factory/_tmp/` に najia の確認用 png 5枚とスクリプト2本、`tools/__pycache__/` が残っている

- **ボルト（Bolt / タンク / ハイパーレア）を追加** — 104体目。36セリフ・**欠番なし**（ブランチ `test/bolt`）
  - 日本語名「ボルト」は `info.txt` 指定。GameWith・ゲームラインとも一致。2026年実装の Epic タンク。
    設定は Battle Bumperz というおもちゃシリーズの一体で、レースカーになりたがっている（Brawlify）
  - Fandom・Fan Kit とも**旧命名**（`bolt start vo 01.ogg` / `bolt_start_vo_01.wav`）で 1:1 対応。
    `unreliable_scenes` は空、`missing` 0 で**一発完全一致**
  - Fandom の Ogg は37件。うち `hurt06` と `ulti03` が同じ "Road rage!" で wikimap が統合して **36本**。
    採用したのは `ulti03`（ページ上の出現が先）、`hurt06` は `kit_files_unused` に落ちた
  - 内訳は start7 / lead4 / hurt7(→6) / kill6 / die5 / ulti8。Fandom の Attacking 列は空で Fan Kit にも攻撃ボイスなし
  - **zip に別ブロウラーのファイルが1件混入**: `max lightning bolt spawn 01mix.wav`（MAXの音声が "bolt" 検索に引っかかったもの）。
    `key_of()` がファイル名の形（`_vo_` が無い）で弾くため `skipped_other_brawler` には計上されず**0件表示**になるが、
    実際には候補に入っていないことを確認済み。**名前フィルタではなく命名規則フィルタで落ちている**点に注意
  - **半角スペース区切りのファイルが1件**: `bolt theme load 01.wav`（BGM）。同じく命名規則フィルタで除外され、処理は落ちなかった
  - スキン音声は0件。`brawler_names_seen` は `{bolt: 37}` のみ
  - アイコンは inbox の `icon.png`（2400×1602）。crop は `250,400,1200`
  - 検証: 音声36本を元wavと**尺で全数照合**（全件一致）、さらに**全36本を whisper で書き起こして期待セリフと突き合わせ**、
    34本が音韻的に一致。残り2本（`Engine failure!` / `Road rage!`）は加工が強く認識自体が失敗しただけで、
    他のセリフとの取り違えではないことを多言語モデルでも再確認。元wav・出力mp3とも md5 重複0。
    公開後の mp3 は工場側と **md5 一致**。既存103ページの差分は「全103→全104」「バナー ジギー→ボルト」
    「リンク一覧に bolt 1行」のみで**退行なし**。audio/ icons/ の既存ファイルは1件も変化なし
  - ⚠️ **今回も削除許可が下りなかった**（`rm` が `Operation not permitted`）。`mv` は通る

- **ジギー（Ziggy / コントローラー / ウルトラレア）を追加** — 103体目。50セリフ・**欠番なし**（ブランチ `test/ziggy`）
  - 日本語名「ジギー」は GameWith系サイトで一致。表記揺れなし。2025/10/17 実装（10/18 早期解禁）
  - Fandom・Fan Kit とも**旧命名**（`Ziggy start vo 01.ogg` / `ziggy_start_vo_01.ogg`）で 1:1 対応。
    `unreliable_scenes` は空、`missing` 0 で**一発完全一致**
  - Fandom の Ogg は 56件。ト書き2件（`Ziggy screams` / `Ziggy laughs`）を除外、
    完全一致の重複3組（`Sizzle!` / `Thunderous applause!` / `Sparkles!`）を wikimap が統合、
    さらに**句読点だけ違う `Oh, behave.` / `Oh, behave!` をあんふぃの判断で1本に統合**して **50本**
    - 統合は wikitext の作業用コピー（`voicelines_wiki_merged.txt`）で `!` を `.` に寄せて実施。
      `lexie_inbox/_done/ziggy-20260927/voicelines_wiki.txt` は Fandom と**バイト単位で同一**（SHA-256 照合済み）
    - 残した近似ペア: `That felt real?` / `That felt real.`（疑問↔断定）、
      `Curtain call, already? Ugh.` / `Curtain call, already?`（`Ugh.` の有無）
  - 内訳は start7 / lead6(→5) / hurt9(→8) / kill11 / die7(→6) / atk8(→6) / ulti8(→7)
  - **スキン・別ブロウラーの混入は0件**。`brawler_names_seen` は `{ziggy: 56}` のみ。
    スキンは3種（Warlock / Zap It Up / Dark Wizard）あるが Fan Kit に音声なし
  - アイコンは**音声 zip に同梱されていた** `Ziggy_portrait.png`（2400×1602）を使用。crop は `0,0,1400`
  - 検証: 音声50本を元oggと**波形エンベロープで全数照合**（全件で正しい元ファイルが最類似・類似度1.0）、
    公開後の mp3 も元ファイルと **md5 一致**。既存102ページの差分は
    「全102→全103」「バナー トランク→ジギー」「リンク一覧に ziggy 1行」のみで**退行なし**
  - ⚠️ **この環境では削除許可が下りなかった**（`rm` が `Operation not permitted`）。
    `mv` は同一フォルダ内なら通る。後片付けで消し残したものは下記「手作業」参照

- **トランク（Trunk / タンク / ハイパーレア）を追加** — 102体目。58セリフ・**欠番なし**
  - 日本語名「トランク」は GameWith・ゲームラインで一致。表記揺れなし。2025/08/21 実装（08/28 スターロード解禁）
  - Fandom・Fan Kit とも**旧命名**（`trunk start vo 01.ogg` / `trunk_start_vo_01.ogg`）。命名の新しい揺れは無し
  - Fandom のセリフは 61行だが、うち3本（kill08 / die10 / start12）が start01 と同じ "I am Trunk!" で、
    wikimap が正しく統合して **58本**。`missing` 0・`skipped_stage_directions` 0 で**一発完全一致**
  - 内訳は start13 / lead10 / hurt9 / kill8 / die12 / ulti9。Fandom の Attacking 列は空で、Fan Kit にも攻撃ボイスは無い
  - **スキン音声は0件**（スキン自体は Swimming Trunk が存在するが Fan Kit に音声なし）。`_skin/` 退避は不要だった
  - アイコンは**音声 zip に同梱されていた** `portrait_brawler_trunk.png` を使用。crop は `0,0,220`
  - ⚠️ **`Portrait_Trunk` だけ 345×220 と極端に低解像度**（他は 2400×1602 や 1759×1110）。
    Supercell 側のアップロードが低解像度なだけで、アセット種別・ライセンスは他キャラと同一。
    sirius.png が 220×220、alli.png が 180×180 なので既存の枠内と判断してそのまま採用
  - 高解像度化は検討して**見送り**: `Trunk@4x` はキャラ絵ではなくネオンの紋章グリフ、
    `trunk_default`（1556×1468）は 3D レンダーで既存のフラットなセル画と画風が合わない。
    超解像（Real-ESRGAN / waifu2x）はサンドボックスから重みと torch を取得できず実行不能。
    古典手法4種を比較したが、bilateral+アンシャープのみ輪郭に偽ディテールが出て失格、他は素の Lanczos と差がなかった。
    そもそもサイトの表示は一覧80px・詳細120px なので 220×220 で足りている

- **⚠️ Audio セクションの検索にポートレート png が混ざる**
  - `?q=Trunk` の Audio 検索（document 373）の結果68件に `portrait_brawler_trunk.png` が1件含まれていた
  - おかげで音声 zip にアイコンが同梱され、ダウンロード1回で済んだ。今後も**まず zip の中を見る**と手数が減る

- **⚠️ `.git` 配下の一時ファイルを消せなかった（未解決）**
  - この環境では削除許可が下りず、`git add -A` 後に `.git/index.lock` と `.git/objects/**/tmp_obj_*` 339件が残存
  - `git add` 自体は成功（166ファイル staged）だが、**index.lock を消さないと commit が失敗する**
  - 手動削除が必要: `Remove-Item "$HOME\brawl-lexie\.git\index.lock"` と
    `Get-ChildItem "$HOME\brawl-lexie\.git\objects" -Recurse -Filter tmp_obj_* | Remove-Item`

- **ダミアン（Damian / タンク / ウルトラレア）を追加** — 101体目。65セリフ・**欠番なし**
  - 日本語名「ダミアン」は GameWith と公式Xの表記が一致。表記揺れなし
  - Fandom は**旧命名**（`damian start vo 01.ogg`）、Fan Kit は**新命名**（`bs_damian_dies_002_001.wav`）という
    初めての組み合わせ。`key_of` が場面名＋番号に正規化するので wikimap はそのまま通った
  - 内訳は start12 / lead9 / hurt10 / kill12 / die10 / ulti12。Fandom の Attacking 列は空で、Fan Kit 側にも攻撃ボイスは無い
  - wikimap で **56/65 を確定**。`unreliable_scenes` は `lead` だけ（Fan Kit が isinlead 001–008 と **010** の9本で、
    009 が欠番。wiki の lead 01–09 と件数は合うのに番号が1つずれる例）。この9本は聞き取りに回して **9/9 一致（スコア100）**。
    結果は lead01–08 → isinlead 001–008、**lead09 → isinlead 010** で、素朴な番号合わせなら最後の1本を取り違えていた
  - アイコンは音声 zip に**同梱されていない**ので Game Assets の `Portrait_Damian`（2400×1602）を使用。crop は `100,150,1300`

- **⚠️ 新しい命名の揺れ: テイク番号が付かないファイル**
  - ulti 12本のうち10本が `bs_damian_specialpower_004.wav` という形で、末尾の `_MMM`（テイク番号）が無かった
  - 旧 `BS_RE` は数字2つを必須にしていたためこの10本が**どこにも現れず**（`kit_files_unused` にも出ない）、
    残る2本だけで「002〜009が欠番」と誤判定され、ulti が丸ごと unreliable に落ちていた
  - **`lexie_match.py` と `lexie_wikimap.py` の `BS_RE` を恒久対応**: 末尾を `(?:[-_](\d+))?$` にしてテイク番号を任意に
  - 退行検証: 既存8キャラ（alli/cosmo/gigi/glowy/mina/nori/pierce/sirius）の**747ファイル全部**について
    旧・新の正規表現で `key_of` / `is_voice` / `take_group` / `scene_of` の結果を突き合わせ、**差分0件**。
    コスモを新しい正規表現で再実行しても確定26本・unreliable は lead/die/hurt/ulti の41本で、当時の記録と一致

- **⚠️ スキンのボイスが本体と衝突する（コード未修正・運用で回避）**
  - `BS_RE` の `^BS_[^_]+_` は**ブロウラー名を検証していない**ので、`bs_spacedamian_dies_004_004` が
    本体の die と同じ照合キーになる。複数テイクから「一番大きいファイル」を選ぶ仕様上、
    **スキンの音声が本体のセリフに割り当てられる事故**が起こりうる
  - 今回は照合前に `bs_spacedamian_*`（56本）を `_skin/` へ退避して回避した（ピアスの `_wav/` と同じ手口）
  - 衝突するのは綴りが一致する `dies` / `getshurt` / `killssomeone` / `intobattle` / `specialpower`。
    スキン側の `inthelead` / `attack` は綴りが違うので当たらない
  - **次にスキン持ちのキャラを入れるときも、まず `bs_<スキン名><id>_*` を退避すること。**
    根本的に直すなら `BS_RE` の `[^_]+` を実際の id で縛る（`--id` を正規表現に差し込む）のが筋

- **場面名の綴りはコスモから元に戻っていた**: `getshurt` / `isinlead`（コスモは `gettinghurt` / `inlead`）。
  どちらも SCENE_ALIAS に入っているので対応不要

- **`.git/index.lock` がまた消せなかった**（コスモと同じ。Cowork 側で削除許可が下りない）。
  今回は `GIT_INDEX_FILE` に一時 index を指して `git add -A` し、その index を `.git/index` に**上書きコピー**して回避した。
  staged 172件（新規68・変更104）はそのまま残っているので、**`del .git\index.lock` してから `git commit` すればよい**。
  `.git/objects/*/tmp_obj_*` も172個残っているが中身には影響しない（`git fsck` は dangling blob 1件のみ）

### 2026-09-26 に完了した分（2件目）

- **コスモ（Cosmo / コントローラー / ウルトラレア）を追加** — 100体目。67セリフ・**欠番なし**
  - 依頼は「Cosmos」だったが Fandom に該当ページなし。実在するのは **Cosmo**（2026年9月実装）。日本語名はGameWith表記の「コスモ」
  - **Fan Kit の新命名がまた変わっていた**: `bs_cosmo_dies_007_003.wav`。数字の区切りがハイフンから `_` に、
    場面名も `GetsHurt` → `gettinghurt`、`IsInLead` → `inlead` に変化。旧来の正規表現は数字区切りが
    ハイフン前提だったため `lexie_match.py` が 1件もマッチせず、`lexie_wikimap.py` も 0/67 だった。
    **lexie_factory/tools 側を恒久対応済み**（下の「工場ツールの修正」参照）。当日の作業は
    `_norm/` にリネームしたコピーを作って回避したが、**その回避はもう不要**
  - 聞き取りは66/67一致。残る vl24「Gravity, please cooperate!」は base.en が「R-E-V-E-E-E-」と誤認したため、
    多言語モデル（`models/sherpa-onnx-whisper-base` + `tools/_pt.py`）で聞き直して
    `bs_cosmo_specialpower_005_001.wav` と確定し、ffmpeg で手動書き出し
  - **Wiki に無いボイスが1件**: `BS_Cosmo_KillsSomeone_012-002.wav` =「Case closed! Lab notes updated!」。未使用のまま
  - アイコン: 音声 zip 同梱の `portrait_brawler_cosmo.png`（＝Game Assets の `Portrait_Cosmo` と同一、1759×1110）を使用。
    コスモは**望遠鏡が頭**なので、このレンズのクローズアップが顔にあたる。crop は `780,60,900`。
    全身が要るときは Game Assets の `BS_Portrait_COSMO_FULL_V2`（5000×5000）
  - vl47 は Fandom 表記が "Do my chalkboard. I tried!" だが、音声は "Tell my chalkboard, I tried!" に近い。
    quote は原文どおり、和訳は後者の読みに寄せた
  - **`git add` は未実行**: `.git/index.lock`（0バイト）が残り、Cowork 側で削除許可が下りず消せなかった。
    手元で `del .git\index.lock` してから `git add -A` → commit すること

- **工場ツールの修正**（`~/Desktop/lexie_factory/tools/`、このリポジトリの外）
  - `lexie_match.py`: `BS_RE` の数字区切りを `[-_]` 許容に。`BS_SCENE` に `gettinghurt` を追加
  - `lexie_wikimap.py`: 同じく `BS_RE` を `[-_]` 許容に。`SCENE_ALIAS` に `gettinghurt` と `inlead` を追加。
    さらに `key_of` を**フォールバック方式**に変更（未知の場面名を `None` で捨てず、綴りをそのまま場面として使う。
    `lexie_match.py` の `scene_of` と同じ方針）。次に場面名が変わっても丸ごと落ちない
  - `lexie_wikimap.py` に**欠番チェック**を追加（下記）

- **⚠️ 次回の自分へ: wikimap の数字を信用しすぎないこと**
  - 新命名（`bs_<id>_<場面>_NNN_MMM`）では、wiki 側と Fan Kit 側の番号は**別々に振られていて、
    たまたま揃っているだけ**。Fan Kit 側に欠番があると、その番号から先が丸ごと1つずつずれる
  - コスモで実測: 素朴に照合すると 60/67 が「割り当て成功」と出たが、**そのうち21本は別のセリフの音声**だった。
    0/67 で失敗するより、60/67 で成功したように見えるほうが危ない
  - 対策として `lexie_wikimap.py` に欠番チェックを入れた。場面ごとに Fan Kit の番号が 1 から連番かを見て、
    欠番があればその場面を**丸ごと missing に落とし**、レポートの `unreliable_scenes` に欠番の番号と理由を出す
  - **運用**: `unreliable_scenes` に出た場面は wikimap の結果を使わず、`lexie_match.py` の聞き取りで割り当てる。
    出なかった場面だけ確定として扱ってよい
  - コスモでの実績: 欠番なしの intobattle 15 + killssomeone 11 = **26本を確定**（聞き取り結果と26/26一致）。
    欠番のあった lead / die / hurt / ulti の41本は missing に落ち、聞き取りに回った
  - 旧命名（`<id>_<場面>_vo_NN`）は wiki と Fan Kit が**同じファイル名**で突き合わせるのでずれない。
    欠番チェックの対象外にしてある（グローウィーの6件のような「本当に音声が無い」欠番はそのまま missing に出る）

### 2026-09-26 に完了した分

- **アリー・ミナ・ジジ・グローウィーの4体を一括追加** — 96〜99体目。全員ウルトラレア（Mythic）
  - アリー（Alli / アサシン）77セリフ・欠番なし。オージー英語のスラングが中心
  - ミナ（Mina / ダメージディーラー）48セリフ・欠番なし。ポルトガル語のセリフ多数
  - ジジ（Gigi / アサシン）58セリフ・欠番なし。SP（低い声）とVB（人形の声）の2系統、バレエ用語はフランス語
  - グローウィー（Glowy / サポート）42セリフ。**6行は Fan Kit に音声が無く欠番**（vl4/11/16/17/24/30）
  - **多言語 Whisper を導入**: `models/sherpa-onnx-whisper-base`（多言語版）を追加。`tools/_pt.py` に
    「未一致ファイルを指定言語で聞き直す」使い捨てスクリプトを置いた。ミナのポルトガル語17行と
    ジジのフランス語系22行は、これで聞き直して手動割り当て
  - ピアスと同じく zip に mp3 と wav が両方入っている場合があるので、wav は `_wav/` に退避してから照合
  - バナーと更新履歴（v3.4）は4体まとめての文言に手で書き換えた

### 2026-09-25 に完了した分（2件目）

- **ピアス（Pierce）を追加** — 95体目。lexie-factory スキルで処理
  - レジェンダリー / マークスマン。セリフ56個すべてに音声あり（欠番なし）
  - Fan Kit は旧命名（pierce_<場面>_vo_NN）。zip に mp3 と wav の両方が入っていたので wav は `_wav/` に退避して mp3 だけ照合
  - アイコンも zip 同梱（BS_Portrait_PIERCE_Export_V1.png）
  - 自動で53個一致。vl2 / vl11 / vl36 は未使用ファイルの聞き取りから手動で割り当て
  - Fandom のセリフ欄で「Ha, looks like crime is out of business.」が2回出ていたので1つにまとめた（音声は2ファイルあり、片方は未使用）

### 2026-09-25 に完了した分

- **ノリ（Nori）を追加** — 94体目。lexie-factory スキルで処理
  - レジェンダリー / アサシン。セリフ41個すべてに音声あり（欠番なし）
  - Fan Kit は新命名（BS_Nori_<場面>_NNN-MMM.wav、186ファイル・複数テイク）。
    `tools/lexie_match.py` で39個が自動一致、vl18「う、やった！」と vl39「Been a bit boring!」は手動で割り当て
  - Fandom のセリフ欄にある「Nori cries」2件と重複していた「Diving in!」1件は一覧から除外

### 2026-09-22 に完了した分

- **シリウス（Sirius）を追加** — 93体目。ユーザー投票1位（24.1%）
  - ウルトラレジェンダリー / コントローラー。セリフ57個中55個（vl10・vl36 は音声が聞き取れず欠番）
  - 和訳・解説は Claude が作成。ダジャレ（serious/Sirius、Brawl Star）やフランス語（ma petite étincelle）も解説済み
  - `app.js` の役職名に `controller`（コントローラー）と `artillery`（アーティラリー）を追加。
    それまでジュジュ・フィンクス・ボウは英語のまま表示されていた

- **キャラ数表記の自動化**
  - `index.html` に手書きの「全91キャラ」が5箇所残っていた（実際は92）
  - `generate-pages.js` の読み込み直後で `/全\d+キャラ/g` を JSON の数に置き換えるようにした。
    **キャラを追加して `node generate-pages.js` を叩けば、数字は勝手に追いつく**
  - 保存判定を `newIndex !== original`（ディスク上の中身）との比較に修正。
    `rawIndex` と比べると、数字だけ変わった日に「変化なし」と判定されて保存されないバグになる
- **トップページに canonical を追加**
  - `index.html` の `<head>` に `<link rel="canonical" href="https://brawl-lexie.vercel.app/" />`
  - ⚠ `index.html` はキャラページの型紙なので、そのままだと92ページ全部に
    「正式URLはトップ」という canonical が複製される → Googleがキャラページを
    トップの複製と判断して検索結果から外す恐れがあった。
    `generate-pages.js` で**型紙を作るときに canonical を取り除く**処理を入れて回避
- **`favicon.svg` を 1.2MB → 約17KB に軽量化**
  - 中身はベクターではなく、1080×1080 のPNG（443KB）を base64 で**2回**埋め込んだだけのファイルだった
    （ライト/ダークモード用に同じ画像が2つ）
  - 128×128・256色に縮小したPNGを1回だけ埋め込み、`<use>` で2箇所から参照する形に作り直した
  - 角丸の白背景（ライト）/ 透過（ダーク）の見た目は維持。Chromium で両モードを描画比較して確認済み

### 2026-09-21 に完了した分

- **sitemap.xml を Search Console に提出**（送信成功）
- **見出し構造**
  - SiteOne の実際の指摘は「見出しレベルの飛び」ではなく **`<h1>` が1ページに2個**だった。
    ヘッダーロゴの h1→p 降格で解決済み
  - `generate-pages.js` に **(5-2) 詳細セクションを `<main>` 先頭へ移動**する処理を追加。
    移動後は h1 が文書内の1番目の見出しになる
- **セキュリティヘッダー**
  - `vercel.json` を新規作成。nosniff / Referrer-Policy / X-Frame-Options /
    Permissions-Policy / HSTS の5つ。CSPは上記の理由で見送り

#### 本番クロール実測（2026-09-21 / SiteOne Crawler v2.5.1）

```
Total of 100 visited URLs  = HTML 93（トップ1 + キャラ92）+ CSS 1 + JS 2 + 画像 4
SEO 10.0/10 ／ Performance 10.0/10 ／ Best Practices 9.1/10
✅ multiple <h1> なし ／ 見出しの飛びなし ／ title・description 93件すべて一意
⛔ Security 6.5/10 ← 中身はほぼ全部 CSP 未設定（上記5の判断どおり、想定内）
```

**注意**: クロールは必ず本番URL `https://brawl-lexie.vercel.app/` で行うこと。
デプロイ固有のプレビューURL（`brawl-lexie-xxxxx-amphibians-projects.vercel.app`）は
Vercelの認証保護で vercel.com のログイン画面に飛ばされ、
「ログイン画面を1枚クロールしただけ」のレポートができあがる（実際に一度やってしまった）。

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
- **`index.html` に何かを足すときは、92ページ全部に複製されて困らないかを必ず考える**（canonical の件）
- 「全〇〇キャラ」は手で書き換えない。`generate-pages.js` が JSON の数から自動で書く

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
