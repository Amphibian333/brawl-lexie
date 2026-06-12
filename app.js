      // ■ 変数定義
      let brawlers = [];
      let filteredBrawlers = [];
      let lastScrollPosition = 0;
      let currentAudio = null;
      let playlist = [];
      let currentIndex = 0;
      let isShuffle = false;
      let isSequentialPlaying = false;
      let isJpHidden = localStorage.getItem('lexie_jp_hidden') === 'true';
      let playbackRate = parseFloat(localStorage.getItem('lexie_playback_rate') || '1');
      let fontSize = localStorage.getItem('lexie_font_size') || 'md';

      async function loadBrawlersIndex() {
        try {
          const response = await fetch('data/brawlers-index.json');
          brawlers = await response.json();
        } catch (err) {
          console.error("Failed to load brawlers-index.json", err);
        }
      }

      async function ensureBrawlersLoaded(voicelineIds) {
        if (!voicelineIds || voicelineIds.length === 0) return;
        const fetchPromises = [];
        brawlers.forEach(b => {
          const needsLoad = voicelineIds.some(vid => b.voicelineIds && b.voicelineIds.includes(vid));
          if (needsLoad && !b.voicelines) {
            const p = fetch(`data/brawlers/${b.fileId}.json`)
              .then(res => res.json())
              .then(detail => {
                b.voicelines = detail.voicelines;
                b.tiktokEmbed = detail.tiktokEmbed;
              })
              .catch(err => console.error(`Failed to preload brawler ${b.nameEn}:`, err));
            fetchPromises.push(p);
          }
        });
        await Promise.all(fetchPromises);
      }

      // ■ 要素の取得
      const searchInput = document.getElementById("brawler-search");
      const rarityFilter = document.getElementById("rarity-filter");
      const roleFilter = document.getElementById("role-filter");
      const brawlerGrid = document.getElementById("brawler-grid");
      const noResults = document.getElementById("no-results");
      const brawlerDetailPage = document.getElementById("brawler-detail-page");
      const brawlerDetailContent = document.getElementById(
        "brawler-detail-content"
      );

      // ■ お気に入り用の要素
      const favSearchInput = document.getElementById("fav-search");
      const showVoicelinesOnlyCheckbox = document.getElementById(
        "show-voicelines-only"
      );

      // ----------------------------------------------------
      // 1. ページ切り替えシステム（紙芝居のめくり役）
      // ----------------------------------------------------

      // ▼▼▼ 修正版 switchPage（ここから） ▼▼▼
      function switchPage(pageName) {
        // ★追加：ページを切り替える瞬間、強制的に一番上に戻す！
        window.scrollTo(0, 0);

        // すべてのセクションを一旦隠す
        const sections = [
          "hero",
          "brawler-spotlight",
          "lessons",
          "about",
          "favorites",
          "decks",
          "changelog",
        ];
        sections.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.classList.add("hidden");
        });

        // 詳細ページも隠す
        brawlerDetailPage.classList.add("hidden");

        // ナビゲーションのアクティブ表示をリセット
        document
          .querySelectorAll(".nav-link")
          .forEach((link) => link.classList.remove("active"));

        // 指定されたページだけを表示する
        if (pageName === "home") {
          document.getElementById("hero").classList.remove("hidden");
          document
            .getElementById("brawler-spotlight")
            .classList.remove("hidden");
          document.getElementById("about").classList.remove("hidden");
          document
            .querySelector('[data-target="home"]')
            .classList.add("active");
        } else if (pageName === "lessons") {
          document.getElementById("lessons").classList.remove("hidden");
          document
            .querySelector('[data-target="lessons"]')
            .classList.add("active");
        } else if (pageName === "favorites") {
          document.getElementById("favorites").classList.remove("hidden");
          document
            .querySelector('[data-target="favorites"]')
            .classList.add("active");
          renderFavoritesPage(); // お気に入りページを再描画
        } else if (pageName === "decks") {
          document.getElementById("decks").classList.remove("hidden");
          document.querySelector('[data-target="decks"]').classList.add("active");
          renderDecksPage();
        } else if (pageName === "changelog") {
          document.getElementById("changelog").classList.remove("hidden");
          document.querySelector('[data-target="changelog"]').classList.add("active");
          renderChangelogPage();
        }
      }
      // ▲▲▲ 修正版 switchPage（ここまで） ▲▲▲

      // ----------------------------------------------------
      // 1b. バナー管理（アップデート速報）
      // ----------------------------------------------------
      const LATEST_VERSION = (typeof CHANGELOG_DATA !== 'undefined' && CHANGELOG_DATA.length > 0)
        ? CHANGELOG_DATA[0].version
        : 'v2.0';

      // バナーを初期化（未閲覧なら表示）
      function initBanner() {
        const seenVersion = localStorage.getItem('lexie_seen_version');
        if (seenVersion !== LATEST_VERSION) {
          document.getElementById('update-banner').style.display = 'flex';
        }
      }

      // バナーを閉じる（localStorage に閲覧済み記録）
      function closeBanner() {
        document.getElementById('update-banner').style.display = 'none';
        localStorage.setItem('lexie_seen_version', LATEST_VERSION);
      }

      // ----------------------------------------------------
      // 1c. アップデート履歴ページ描画
      // ----------------------------------------------------
      function renderChangelogPage() {
        const grid = document.getElementById('changelog-grid');
        if (!grid || typeof CHANGELOG_DATA === 'undefined') return;
        grid.innerHTML = CHANGELOG_DATA.map((entry, i) => `
          <div class="changelog-card">
            <div class="changelog-card-header">
              <span class="changelog-version">${escapeHtml(entry.version)}</span>
              ${i === 0 ? '<span class="changelog-badge">最新</span>' : ''}
              <span class="changelog-date">${escapeHtml(entry.date)}</span>
            </div>
            <h3 class="changelog-title">${escapeHtml(entry.title)}</h3>
            <ul class="changelog-features">
              ${entry.features.map(f => `<li>${f.icon} ${escapeHtml(f.text)}</li>`).join('')}
            </ul>
          </div>
        `).join('');
      }

      // ----------------------------------------------------
      // 2. お気に入り機能（保存・読み込み）
      // ----------------------------------------------------
      function getFavorites() {
        const favs = localStorage.getItem("lexie_favorites");
        return favs ? JSON.parse(favs) : [];
      }
      function toggleFavorite(brawlerName) {
        let favs = getFavorites();
        if (favs.includes(brawlerName)) {
          favs = favs.filter((name) => name !== brawlerName);
        } else {
          favs.push(brawlerName);
        }
        localStorage.setItem("lexie_favorites", JSON.stringify(favs));
        return favs.includes(brawlerName);
      }
      function getVoicelineFavorites() {
        const favs = localStorage.getItem("lexie_fav_voicelines");
        return favs ? JSON.parse(favs) : [];
      }
      function toggleVoicelineFavorite(id) {
        let favs = getVoicelineFavorites();
        if (favs.includes(id)) {
          favs = favs.filter((favId) => favId !== id);
        } else {
          favs.push(id);
        }
        localStorage.setItem("lexie_fav_voicelines", JSON.stringify(favs));
        return favs.includes(id);
      }

      // ----------------------------------------------------
      // 3a. 単語帳（デッキ）システム — CRUD
      // ----------------------------------------------------
      function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, m =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
        );
      }
      function getDecks() {
        const data = localStorage.getItem('lexie_decks');
        return data ? JSON.parse(data) : [];
      }
      function saveDecks(decks) {
        localStorage.setItem('lexie_decks', JSON.stringify(decks));
      }
      function createDeck(name) {
        const deck = { id: 'deck_' + Date.now(), name: name.trim(), createdAt: new Date().toISOString(), voicelineIds: [] };
        const decks = getDecks();
        decks.push(deck);
        saveDecks(decks);
        return deck;
      }
      function deleteDeck(deckId) {
        saveDecks(getDecks().filter(d => d.id !== deckId));
      }
      function renameDeck(deckId, name) {
        const decks = getDecks();
        const deck = decks.find(d => d.id === deckId);
        if (deck) { deck.name = name.trim(); saveDecks(decks); }
      }
      function migrateMemorizeHard() {
        if (localStorage.getItem('lexie_migration_v1') === 'done') return;
        const raw = localStorage.getItem('lexie_memorize_hard');
        if (raw) {
          const ids = JSON.parse(raw);
          if (ids.length > 0) {
            const deck = { id: 'deck_' + Date.now(), name: '要復習', createdAt: new Date().toISOString(), voicelineIds: ids };
            const decks = getDecks();
            decks.unshift(deck);
            saveDecks(decks);
          }
        }
        localStorage.setItem('lexie_migration_v1', 'done');
      }

      function addToDeck(deckId, voicelineId) {
        const decks = getDecks();
        const deck = decks.find(d => d.id === deckId);
        if (!deck || deck.voicelineIds.includes(voicelineId)) return false;
        deck.voicelineIds.push(voicelineId);
        saveDecks(decks);
        return true;
      }
      function removeFromDeck(deckId, voicelineId) {
        const decks = getDecks();
        const deck = decks.find(d => d.id === deckId);
        if (!deck) return;
        deck.voicelineIds = deck.voicelineIds.filter(id => id !== voicelineId);
        saveDecks(decks);
      }
      function getVoicelineDecks(voicelineId) {
        return getDecks().filter(d => d.voicelineIds.includes(voicelineId)).map(d => d.id);
      }

      let _pickerVoicelineId = null;
      function showDeckPicker(voicelineId) {
        _pickerVoicelineId = voicelineId;
        const overlay = document.getElementById('deck-picker-overlay');
        const list = document.getElementById('deck-picker-list');
        const decks = getDecks();
        const inDecks = getVoicelineDecks(voicelineId);
        list.innerHTML = '';
        if (decks.length === 0) {
          list.innerHTML = '<p style="color:var(--text-tertiary); text-align:center; padding:12px 0; font-size:0.9em;">単語帳がありません。下から作ってください。</p>';
        } else {
          decks.forEach(deck => {
            const isIn = inDecks.includes(deck.id);
            const item = document.createElement('div');
            item.className = 'deck-picker-item';
            item.innerHTML = `<span class="deck-picker-item-name">${escapeHtml(deck.name)}</span><span class="deck-picker-item-check">${isIn ? '✓' : ''}</span>`;
            item.addEventListener('click', () => {
              if (isIn) removeFromDeck(deck.id, voicelineId);
              else addToDeck(deck.id, voicelineId);
              // ＋ボタンの状態を更新
              document.querySelectorAll(`.add-to-deck-btn[data-id="${voicelineId}"]`).forEach(btn => {
                btn.classList.toggle('in-deck', getVoicelineDecks(voicelineId).length > 0);
              });
              showDeckPicker(voicelineId);
            });
            list.appendChild(item);
          });
        }
        document.getElementById('deck-picker-new-btn').onclick = () => {
          const name = prompt('単語帳の名前を入力してください');
          if (name && name.trim()) {
            const deck = createDeck(name);
            addToDeck(deck.id, voicelineId);
            document.querySelectorAll(`.add-to-deck-btn[data-id="${voicelineId}"]`).forEach(btn => btn.classList.add('in-deck'));
            showDeckPicker(voicelineId);
          }
        };
        overlay.style.display = 'flex';
      }
      function hideDeckPicker() {
        document.getElementById('deck-picker-overlay').style.display = 'none';
        _pickerVoicelineId = null;
      }

      // 単語帳一覧ページ描画
      function renderDecksPage() {
        const decks = getDecks();
        const grid = document.getElementById('deck-grid');
        const emptyState = document.getElementById('empty-decks-state');
        const listView = document.getElementById('deck-list-view');
        const detailView = document.getElementById('deck-detail-view');

        listView.style.display = 'block';
        detailView.style.display = 'none';
        grid.innerHTML = '';

        if (decks.length === 0) {
          emptyState.style.display = 'block';
        } else {
          emptyState.style.display = 'none';
          decks.forEach(deck => {
            const card = document.createElement('div');
            card.className = 'deck-card';
            card.innerHTML = `
              <div class="deck-card-name">${escapeHtml(deck.name)}</div>
              <div class="deck-card-meta">${deck.voicelineIds.length}件のセリフ</div>
              <div class="deck-card-actions">
                <button class="deck-card-btn rename-deck-btn" data-id="${deck.id}">✏️ 名前変更</button>
                <button class="deck-card-btn danger delete-deck-btn" data-id="${deck.id}">🗑 削除</button>
              </div>
            `;
            card.addEventListener('click', (e) => {
              if (e.target.closest('.deck-card-btn')) return;
              renderDeckDetail(deck.id);
            });
            card.querySelector('.rename-deck-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              const newName = prompt('単語帳の名前を変更', deck.name);
              if (newName && newName.trim()) { renameDeck(deck.id, newName); renderDecksPage(); }
            });
            card.querySelector('.delete-deck-btn').addEventListener('click', (e) => {
              e.stopPropagation();
              if (confirm(`「${escapeHtml(deck.name)}」を削除しますか？`)) { deleteDeck(deck.id); renderDecksPage(); }
            });
            grid.appendChild(card);
          });
        }

        document.getElementById('create-deck-btn').onclick = () => {
          const name = prompt('単語帳の名前を入力してください');
          if (name && name.trim()) { createDeck(name); renderDecksPage(); }
        };
      }

      async function renderDeckDetail(deckId) {
        const deck = getDecks().find(d => d.id === deckId);
        if (!deck) return;
        const detailView = document.getElementById('deck-detail-view');
        const listView = document.getElementById('deck-list-view');
        listView.style.display = 'none';
        detailView.style.display = 'block';

        detailView.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <button id="back-to-decks-btn" class="btn btn-secondary">← 一覧に戻る</button>
          </div>
          <div style="text-align: center; padding: 40px; color: var(--accent-primary); font-weight: bold;">
            ⏳ データを読み込み中...
          </div>
        `;
        document.getElementById('back-to-decks-btn').onclick = () => {
          detailView.style.display = 'none';
          listView.style.display = 'block';
        };

        await ensureBrawlersLoaded(deck.voicelineIds);

        // brawlers から voicelineIds に一致するセリフを収集
        const tracks = [];
        if (typeof brawlers !== 'undefined') {
          brawlers.forEach(b => {
            if (!b.voicelines) return;
            b.voicelines.forEach(l => {
              if (deck.voicelineIds.includes(l.id)) tracks.push({ ...l, brawlerName: b.name });
            });
          });
          tracks.sort((a, b) => deck.voicelineIds.indexOf(a.id) - deck.voicelineIds.indexOf(b.id));
        }
        const validTracks = tracks.filter(t => t.audioUrl);

        detailView.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <button id="back-to-decks-btn" class="btn btn-secondary">← 一覧に戻る</button>
            <div style="display:flex; gap:8px;">
              <button class="deck-card-btn" id="deck-rename-btn">✏️ 名前変更</button>
              <button class="deck-card-btn danger" id="deck-delete-btn">🗑 削除</button>
            </div>
          </div>
          <h2 style="font-size:1.4em; color:var(--accent-primary); margin-bottom:16px;">${escapeHtml(deck.name)}</h2>
          ${validTracks.length > 0 ? `
          <div class="detail-actions-box" id="deck-player-controls" style="margin-bottom:20px;">
            <button id="deck-play-all-btn">▶ 全音声再生</button>
            <button id="deck-shuffle-btn">🔀 OFF</button>
            <button class="speed-btn${isJpHidden ? ' active' : ''}" id="deck-toggle-jp-btn">🙈 暗記</button>
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 0;">${renderSpeedButtons()}</div>
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 0;">${renderFontSizeButtons()}</div>
          </div>` : ''}
          <div id="deck-voiceline-container" class="font-size-target${isJpHidden ? ' jp-hidden' : ''}">
            ${tracks.map(track => `
              <div class="voiceline-item" id="dvl-${track.id}">
                <div style="font-size:0.78em; color:var(--text-tertiary); margin-bottom:4px;">${escapeHtml(track.brawlerName)}</div>
                <div class="voiceline-main">
                  <div class="voiceline-quotes">
                    <p class="quote-en">"${track.quote}"</p>
                    <p class="quote-jp">${track.translation}</p>
                  </div>
                  <div class="voiceline-actions">
                    <button class="voiceline-play-btn" data-audio-src="${track.audioUrl || ''}" ${!track.audioUrl ? 'disabled' : ''}>再生 ▶</button>
                    <button class="deck-remove-btn" data-id="${track.id}" data-deck="${deck.id}" style="border:1px solid var(--border-color); background:none; color:var(--text-tertiary); padding:5px 9px; border-radius:6px; cursor:pointer; font-size:0.85em;" title="単語帳から削除">✕</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          ${tracks.length === 0 ? `
          <div style="text-align:center; padding:60px 20px;">
            <p style="font-size:1.8em; margin-bottom:12px;">📭</p>
            <p style="color:var(--text-secondary);">セリフが登録されていません</p>
            <p style="color:var(--text-tertiary); font-size:0.9em; margin-top:8px;">キャラ詳細の「＋」から追加しよう！</p>
          </div>` : ''}
        `;

        setupDeckDetailEvents(deck, validTracks);
      }

      function setupDeckDetailEvents(deck, validTracks) {
        document.getElementById('back-to-decks-btn').onclick = renderDecksPage;

        document.getElementById('deck-rename-btn').onclick = () => {
          const newName = prompt('単語帳の名前を変更', deck.name);
          if (newName && newName.trim()) { renameDeck(deck.id, newName); renderDeckDetail(deck.id); }
        };
        document.getElementById('deck-delete-btn').onclick = () => {
          if (confirm(`「${escapeHtml(deck.name)}」を削除しますか？`)) { deleteDeck(deck.id); renderDecksPage(); }
        };

        if (validTracks.length > 0) {
          const playAllBtn = document.getElementById('deck-play-all-btn');
          playAllBtn.onclick = () => {
            if (isSequentialPlaying) {
              stopAllPlayback();
            } else {
              playlist = isShuffle ? shuffleArray([...validTracks]) : [...validTracks];
              playTrackByIndex(0);
            }
          };
          const shufBtn = document.getElementById('deck-shuffle-btn');
          shufBtn.innerText = isShuffle ? '🔀 ON' : '🔀 OFF';
          shufBtn.style.color = isShuffle ? 'var(--accent-secondary)' : 'var(--accent-primary)';
          shufBtn.onclick = () => {
            isShuffle = !isShuffle;
            shufBtn.innerText = isShuffle ? '🔀 ON' : '🔀 OFF';
            shufBtn.style.color = isShuffle ? 'var(--accent-secondary)' : 'var(--accent-primary)';
            if (isSequentialPlaying) playlist = isShuffle ? shuffleArray([...validTracks]) : [...validTracks];
          };
          bindSpeedButtons();
          bindFontSizeButtons();
          setFontSize(fontSize);
        }

        // 暗記モードトグル
        const toggleJpBtn = document.getElementById('deck-toggle-jp-btn');
        const vlContainer = document.getElementById('deck-voiceline-container');
        if (toggleJpBtn && vlContainer) {
          toggleJpBtn.onclick = () => {
            isJpHidden = !isJpHidden;
            localStorage.setItem('lexie_jp_hidden', isJpHidden);
            vlContainer.classList.toggle('jp-hidden', isJpHidden);
            toggleJpBtn.classList.toggle('active', isJpHidden);
            if (!isJpHidden) vlContainer.querySelectorAll('.quote-jp.revealed').forEach(el => el.classList.remove('revealed'));
          };
          vlContainer.querySelectorAll('.quote-jp').forEach(el => {
            el.addEventListener('click', () => { if (isJpHidden) el.classList.toggle('revealed'); });
          });
        }

        // 個別再生
        document.querySelectorAll('#deck-voiceline-container .voiceline-play-btn').forEach(btn => {
          btn.onclick = () => {
            const url = btn.dataset.audioSrc;
            if (!url) return;
            isSequentialPlaying = false;
            if (currentAudio) currentAudio.pause();
            currentAudio = new Audio(url);
            currentAudio.playbackRate = playbackRate;
            currentAudio.play();
          };
        });

        // ✕ セリフ削除
        document.querySelectorAll('.deck-remove-btn').forEach(btn => {
          btn.onclick = () => {
            removeFromDeck(btn.dataset.deck, btn.dataset.id);
            const item = document.getElementById(`dvl-${btn.dataset.id}`);
            if (item) item.remove();
            const updated = getDecks().find(d => d.id === deck.id);
            if (updated && updated.voicelineIds.length === 0) renderDeckDetail(deck.id);
          };
        });
      }

      // ----------------------------------------------------
      // 3. お気に入りページの表示（レンダリング）
      // ----------------------------------------------------
      // ▼▼▼ 2. 修正版 renderFavoritesPage（ここからコピー） ▼▼▼
      async function renderFavoritesPage() {
        const favBrawlersList = getFavorites();
        const favVoicelinesList = getVoicelineFavorites();
        const voicelinesContainer = document.getElementById("fav-voicelines-section");
        if (voicelinesContainer && favVoicelinesList.length > 0) {
          voicelinesContainer.style.display = "block";
          voicelinesContainer.innerHTML = `
            <div class="voicelines-section-header">
              <h3 style="color: var(--accent-secondary);">セリフ</h3>
            </div>
            <div style="text-align: center; padding: 40px; color: var(--accent-primary); font-weight: bold;">
              ⏳ データを読み込み中...
            </div>
          `;
        }
        await ensureBrawlersLoaded(favVoicelinesList);
        const searchText = favSearchInput.value.toLowerCase();
        const onlyVoicelines = showVoicelinesOnlyCheckbox.checked;

        const brawlersContainer = document.getElementById(
          "fav-brawlers-section"
        );
        const emptyState = document.getElementById("empty-favorites-state");

        // 何も登録がない場合
        if (favBrawlersList.length === 0 && favVoicelinesList.length === 0) {
          brawlersContainer.style.display = "none";
          voicelinesContainer.style.display = "none";
          emptyState.style.display = "block";
          return;
        } else {
          emptyState.style.display = "none";
        }

        // ■■ キャラクター一覧の表示制御 ■■
        if (onlyVoicelines) {
          brawlersContainer.style.display = "none";
        } else {
          brawlersContainer.style.display = "block";
          const grid = document.getElementById("fav-brawlers-grid");
          grid.innerHTML = "";
          let hasHit = false;

          // brawlers変数が読み込まれているか確認
          if (typeof brawlers !== "undefined") {
            brawlers.forEach((b) => {
              if (favBrawlersList.includes(b.name)) {
                if (searchText && !b.name.toLowerCase().includes(searchText))
                  return;
                grid.appendChild(createBrawlerCard(b));
                hasHit = true;
              }
            });
          }
          document.getElementById("no-fav-brawlers-msg").style.display = hasHit
            ? "none"
            : "block";
          if (favBrawlersList.length === 0)
            document.getElementById("no-fav-brawlers-msg").style.display =
              "none";
        }

        // ■■ セリフ一覧の表示制御（プレーヤー機能付き） ■■
        voicelinesContainer.style.display = "block";

        // HTMLをセット（プレーヤーボタンを追加）
        voicelinesContainer.innerHTML = `
    <div class="voicelines-section-header">
      <h3 style="color: var(--accent-secondary);">セリフ</h3>
      <div class="voiceline-display-controls">
        <button class="speed-btn${isJpHidden ? ' active' : ''}" id="fav-toggle-jp-btn">🙈 暗記</button>
        ${renderFontSizeButtons()}
      </div>
    </div>

    <div class="detail-actions-box" id="fav-player-controls" style="margin-bottom: 20px; display: none;">
        <button id="fav-play-all-btn">▶ 全音声再生</button>
        <button id="fav-shuffle-btn">🔀 OFF</button>
        <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 0;">${renderSpeedButtons()}</div>
    </div>

    <div id="fav-voicelines-list" class="font-size-target"></div>
    <p id="no-fav-voicelines-msg" style="text-align: center; color: var(--text-tertiary); display: none;">登録されたセリフはいません。</p>
  `;

        const vList = document.getElementById("fav-voicelines-list");
        const playerControls = document.getElementById("fav-player-controls");

        // 再生リスト（プレイリスト）を作成
        let tempPlaylist = [];
        if (typeof brawlers !== "undefined") {
          brawlers.forEach((b) => {
            if (!b.voicelines) return;
            b.voicelines.forEach((l) => {
              if (favVoicelinesList.includes(l.id)) {
                if (
                  searchText &&
                  !l.quote.toLowerCase().includes(searchText) &&
                  !l.translation.includes(searchText)
                )
                  return;

                tempPlaylist.push({
                  audioUrl: l.audioUrl,
                  quote: l.quote,
                  id: l.id,
                  translation: l.translation,
                  brawlerName: b.name,
                });
              }
            });
          });
        }

        // セリフが1つ以上あればプレーヤーボタンを表示して動くようにする
        if (tempPlaylist.length > 0) {
          playerControls.style.display = "flex";
          playerControls.style.gap = "10px";

          // 全再生ボタン
          document.getElementById("fav-play-all-btn").onclick = () => {
            if (isSequentialPlaying) {
              stopAllPlayback();
            } else {
              // グローバルのプレイリストを書き換え
              playlist = isShuffle
                ? shuffleArray(tempPlaylist)
                : [...tempPlaylist];
              playTrackByIndex(0);
            }
          };

          // シャッフルボタン
          const shufBtn = document.getElementById("fav-shuffle-btn");
          shufBtn.innerText = isShuffle ? "🔀 ON" : "🔀 OFF";
          shufBtn.style.color = isShuffle
            ? "var(--accent-secondary)"
            : "var(--accent-primary)";

          shufBtn.onclick = () => {
            isShuffle = !isShuffle;
            shufBtn.innerText = isShuffle ? "🔀 ON" : "🔀 OFF";
            shufBtn.style.color = isShuffle
              ? "var(--accent-secondary)"
              : "var(--accent-primary)";
            // 再生中なら混ぜ直す
            if (isSequentialPlaying) {
              playlist = isShuffle
                ? shuffleArray(tempPlaylist)
                : [...tempPlaylist];
            }
          };

          // 暗記モードボタン（お気に入りページ）
          const favToggleJpBtn = document.getElementById('fav-toggle-jp-btn');
          if (favToggleJpBtn) {
            favToggleJpBtn.onclick = () => {
              isJpHidden = !isJpHidden;
              localStorage.setItem('lexie_jp_hidden', isJpHidden);
              favToggleJpBtn.classList.toggle('active', isJpHidden);
              vList.classList.toggle('jp-hidden', isJpHidden);
              if (!isJpHidden) {
                vList.querySelectorAll('.quote-jp.revealed').forEach(el => el.classList.remove('revealed'));
              }
            };
          }

          bindSpeedButtons();
          bindFontSizeButtons();
          setFontSize(fontSize);
        } else {
          document.getElementById("no-fav-voicelines-msg").style.display =
            "block";
        }

        // 個別のセリフカードを作成して並べる
        tempPlaylist.forEach((track, index) => {
          const item = document.createElement("div");
          item.className = "voiceline-item";
          item.style.position = "relative";
          item.id = `vl-item-${track.id}`;

          item.innerHTML = `
        <div style="font-size:0.8em; color:var(--text-tertiary); margin-bottom:5px;">${track.brawlerName}</div>
        <button class="fav-btn active" style="position:absolute!important; top:10px!important; right:10px!important; width:40px!important; height:40px!important; min-width:40px!important; min-height:40px!important; flex-shrink:0!important; border-radius:50%; background:rgba(0,0,0,0.6)!important; border:2px solid #ff4d4d!important; color:#ff4d4d!important; font-size:20px!important; display:flex; justify-content:center; align-items:center; z-index:100; cursor:pointer; padding:0;">♥</button>
        <div class="voiceline-main" style="padding-right: 50px!important;">
          <div class="voiceline-quotes">
            <p class="quote-en" style="font-weight:bold; color:var(--accent-primary);">"${track.quote}"</p>
            <p class="quote-jp">${track.translation}</p>
          </div>
          <button class="voiceline-play-btn" style="margin-top:10px; border:2px solid var(--accent-secondary); color:var(--accent-secondary); background:none; padding:5px 15px; border-radius:20px; font-weight:bold; cursor:pointer;">再生 ▶</button>
        </div>
      `;

          // 個別再生ボタン：ここを押しても「連続再生モード」に入る
          item.querySelector(".voiceline-play-btn").onclick = () => {
            playlist = [...tempPlaylist];
            isShuffle = false;
            // シャッフルボタンの見た目をリセット
            const shufBtn = document.getElementById("fav-shuffle-btn");
            if (shufBtn) {
              shufBtn.innerText = "🔀 OFF";
              shufBtn.style.color = "var(--accent-primary)";
            }
            playTrackByIndex(index);
          };

          // ハート解除ボタン
          item.querySelector(".fav-btn").onclick = (e) => {
            e.stopPropagation();
            toggleVoicelineFavorite(track.id);
            renderFavoritesPage(); // 画面を更新して消す
          };

          vList.appendChild(item);
        });

        // 暗記モードの初期状態を適用し、タップ個別表示を設定
        if (isJpHidden) vList.classList.add('jp-hidden');
        vList.querySelectorAll('.quote-jp').forEach(el => {
          el.addEventListener('click', () => {
            if (isJpHidden) el.classList.toggle('revealed');
          });
        });
      }
      // ▲▲▲ 2. 修正版 renderFavoritesPage（ここまでコピー） ▲▲▲

      // ----------------------------------------------------
      // 4. 基本機能（カード作成、詳細表示など）
      // ----------------------------------------------------
      function getRarityText(k) {
        const m = {
          starting: "初期",
          rare: "レア",
          "super-rare": "スーパーレア",
          "hyper-rare": "ハイパーレア",
          "ultra-rare": "ウルトラレア",
          "legend-rare": "レジェンドレア",
          "ultra-legend-rare": "ウルトラレジェンドレア",
        };
        return m[k.toLowerCase().replace(/\s+/g, "-")] || k;
      }
      function getRoleText(k) {
        const m = {
          "damage-dealer": "ダメージディーラー",
          tank: "タンク",
          support: "サポート",
          assassin: "アサシン",
          thrower: "スロワー",
          marksman: "マークスマン",
          unknown: "不明",
        };
        return m[k.toLowerCase().replace(/\s+/g, "-")] || k;
      }

      function createBrawlerCard(b) {
        const card = document.createElement("div");
        card.className = "brawler-card";
        const favs = getFavorites();
        const isFav = favs.includes(b.name);
        const img = b.iconUrl || `https://placehold.co/80x80?text=${b.name}`;

        card.innerHTML = `
          <button class="fav-btn ${isFav ? "active" : ""}">♥</button>
          <img src="${img}">
          <h3>${b.name}</h3>
          <div class="rarity ${b.rarity
            .toLowerCase()
            .replace(/\s+/g, "-")}">${getRarityText(b.rarity)}</div>
          <div class="role">${getRoleText(b.role)}</div>
          <div class="quote">"${b.quote}"</div>
        `;

        const prefetch = () => {
          if (!b.voicelines && !b.isFetching) {
            b.isFetching = true;
            b.fetchPromise = fetch(`data/brawlers/${b.fileId}.json`)
              .then(res => res.json())
              .then(detail => {
                b.voicelines = detail.voicelines;
                b.tiktokEmbed = detail.tiktokEmbed;
                b.isFetching = false;
              })
              .catch(err => {
                console.error("Prefetch failed:", err);
                b.isFetching = false;
              });
          }
        };

        card.addEventListener("mouseenter", prefetch);
        card.addEventListener("touchstart", prefetch, { passive: true });

        card.onclick = async () => {
          lastScrollPosition = window.scrollY;
          if (b.isFetching && b.fetchPromise) {
            card.classList.add("loading-card");
            await b.fetchPromise;
            card.classList.remove("loading-card");
          } else if (!b.voicelines) {
            card.classList.add("loading-card");
            try {
              const response = await fetch(`data/brawlers/${b.fileId}.json`);
              const detail = await response.json();
              b.voicelines = detail.voicelines;
              b.tiktokEmbed = detail.tiktokEmbed;
            } catch (err) {
              console.error("Failed to load brawler details:", err);
            }
            card.classList.remove("loading-card");
          }
          displayBrawlerDetail(b);
        };
        const favBtn = card.querySelector(".fav-btn");
        favBtn.onclick = (e) => {
          e.stopPropagation();
          toggleFavorite(b.name);
          favBtn.classList.toggle("active");
        };
        return card;
      }

      function displayBrawlerDetail(b) {
        const lines = b.voicelines || [];
        const valid = lines.filter((l) => l.audioUrl);
        const img = b.iconUrl || `https://placehold.co/120x120?text=${b.name}`;
        const favVoicelines = getVoicelineFavorites();

        const videoHtml = b.tiktokEmbed
          ? `<div class="tiktok-special-view" style="margin-top: 30px; text-align: center;"><h3 style="color: var(--accent-primary); margin-bottom: 15px; border-bottom: 2px solid var(--accent-primary); display: inline-block; padding-bottom: 5px;">🎬 スペシャル動画解説</h3><div style="display: flex; justify-content: center; background: #000; border-radius: 15px; padding: 10px;">${b.tiktokEmbed}</div></div>`
          : "";

        brawlerDetailContent.innerHTML = `
          <div class="brawler-detail-main-layout">
            <div class="brawler-detail-left">
              <img src="${img}" class="brawler-detail-icon">
              <h2 class="brawler-detail-name-jp">${b.name}</h2>
              <div class="brawler-detail-tags"><span class="rarity">${getRarityText(
                b.rarity
              )}</span><span class="role">${getRoleText(b.role)}</span></div>
              <div class="brawler-detail-primary-quote"><p class="quote-text">"${
                b.quote
              }"</p></div>
            </div>
            <div class="brawler-detail-right">
              <div class="detail-actions-box">
                ${
                  lines.length > 0
                    ? `<button id="play-all-master-btn">▶ 全音声再生</button><div style="display: flex; gap: 5px;"><button id="prev-track-btn" style="flex:1">⏮ 前へ</button><button id="next-track-btn" style="flex:1">⏭ 次へ</button></div><button id="shuffle-toggle-btn">🔀 OFF</button><div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:4px 0;">${renderSpeedButtons()}</div>`
                    : `<p style="color: var(--accent-primary);">音声準備中...</p>`
                }
              </div>
              <button class="btn btn-secondary back-to-list-button" style="width: 100%;">一覧へ戻る</button>
            </div>
          </div>
          ${videoHtml}
          <div class="voicelines-section" ${
            lines.length === 0 ? 'style="display:none;"' : ""
          }>
            <div class="voicelines-section-header">
              <h3>セリフ一覧 (${valid.length}件)</h3>
              <div class="voiceline-display-controls">
                <button class="speed-btn${isJpHidden ? ' active' : ''}" id="toggle-jp-btn">🙈 暗記</button>
                ${renderFontSizeButtons()}
              </div>
            </div>
            <div id="voiceline-list-container" class="font-size-target">
              ${lines
                .map((l) => {
                  const isVlFav = favVoicelines.includes(l.id);
                  return `<div class="voiceline-item" id="vl-item-${l.id}">
                  <button class="fav-btn voiceline-fav-btn ${
                    isVlFav ? "active" : ""
                  }" data-id="${l.id}">♥</button>
                  <div class="voiceline-main">
                    <div class="voiceline-quotes"><p class="quote-en">"${
                      l.quote
                    }"</p><p class="quote-jp">${l.translation}</p></div>
                    <div class="voiceline-actions"><button class="voiceline-play-btn" data-audio-src="${
                      l.audioUrl || ""
                    }" ${
                    !l.audioUrl ? "disabled" : ""
                  }>再生 ▶</button><button class="voiceline-toggle" data-target="${
                    l.id
                  }">解説 ▼</button><button class="add-to-deck-btn${getVoicelineDecks(l.id).length > 0 ? ' in-deck' : ''}" data-id="${l.id}" title="単語帳に追加">＋</button></div>
                  </div>
                  <div class="voiceline-explanation" id="${l.id}">${
                    l.explanation
                  }</div>
                </div>`;
                })
                .join("")}
            </div>
          </div>`;

        if (b.tiktokEmbed) {
          const s = document.createElement("script");
          s.src = "https://www.tiktok.com/embed.js";
          document.body.appendChild(s);
        }

        // 画面切り替え：詳細ページを表示
        document
          .querySelectorAll("main > .page-section")
          .forEach((s) => s.classList.add("hidden"));
        brawlerDetailPage.classList.remove("hidden");
        window.scrollTo({ top: 0, behavior: "instant" });

        setupDetailEvents(valid);
      }

      function setupDetailEvents(valid) {
        const playBtn = document.getElementById("play-all-master-btn");
        if (playBtn) {
          playBtn.onclick = () => {
            if (isSequentialPlaying) stopAllPlayback();
            else {
              playlist = isShuffle ? shuffleArray(valid) : [...valid];
              if (playlist.length > 0) playTrackByIndex(0);
            }
          };
        }
        const nextBtn = document.getElementById("next-track-btn");
        if (nextBtn) nextBtn.onclick = playNextTrack;
        const prevBtn = document.getElementById("prev-track-btn");
        if (prevBtn)
          prevBtn.onclick = () => {
            if (currentIndex > 0) {
              currentIndex--;
              playTrackByIndex(currentIndex);
            }
          };
        const shufBtn = document.getElementById("shuffle-toggle-btn");
        if (shufBtn)
          shufBtn.onclick = () => {
            isShuffle = !isShuffle;
            playlist = isShuffle ? shuffleArray(valid) : [...valid];
            updatePlayerUI();
          };

        document.querySelectorAll(".voiceline-toggle").forEach(
          (btn) =>
            (btn.onclick = () => {
              const exp = document.getElementById(btn.dataset.target);
              const isH =
                exp.style.display === "none" || exp.style.display === "";
              exp.style.display = isH ? "block" : "none";
              btn.innerText = isH ? "解説 ▲" : "解説 ▼";
            })
        );

        document.querySelectorAll(".voiceline-fav-btn").forEach(
          (btn) =>
            (btn.onclick = (e) => {
              e.stopPropagation();
              const id = btn.dataset.id;
              toggleVoicelineFavorite(id);
              btn.classList.toggle("active");
            })
        );

        document.querySelectorAll(".voiceline-play-btn").forEach((btn) => {
          btn.onclick = (e) => {
            const url = e.target.dataset.audioSrc;
            if (!url) return;
            isSequentialPlaying = false;
            if (currentAudio) currentAudio.pause();
            currentAudio = new Audio(url);
            currentAudio.playbackRate = playbackRate;
            currentAudio.play();
          };
        });

        bindSpeedButtons();

        document.querySelectorAll(".back-to-list-button").forEach((btn) => {
          btn.onclick = () => {
            switchPage("home");
            window.scrollTo({ top: lastScrollPosition, behavior: "instant" });
          };
        });

        // 暗記モード：日本語訳トグル（セリフ一覧ヘッダー横に移動済み）
        const toggleJpBtn = document.getElementById('toggle-jp-btn');
        const vlContainer = document.getElementById('voiceline-list-container');
        if (toggleJpBtn && vlContainer) {
          if (isJpHidden) vlContainer.classList.add('jp-hidden');
          toggleJpBtn.onclick = () => {
            isJpHidden = !isJpHidden;
            localStorage.setItem('lexie_jp_hidden', isJpHidden);
            vlContainer.classList.toggle('jp-hidden', isJpHidden);
            toggleJpBtn.classList.toggle('active', isJpHidden);
            if (!isJpHidden) {
              vlContainer.querySelectorAll('.quote-jp.revealed').forEach(el => el.classList.remove('revealed'));
            }
          };
          vlContainer.querySelectorAll('.quote-jp').forEach(el => {
            el.addEventListener('click', () => {
              if (isJpHidden) el.classList.toggle('revealed');
            });
          });
        }

        // ＋ 単語帳に追加ボタン
        document.querySelectorAll('.add-to-deck-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showDeckPicker(btn.dataset.id);
          });
        });

        bindFontSizeButtons();
        setFontSize(fontSize);
      }

      // ----------------------------------------------------
      // 5. プレイヤー制御（既存の機能）
      // ----------------------------------------------------

      // 再生スピードボタンのHTML文字列を生成
      function renderSpeedButtons() {
        const rates = [0.5, 0.75, 1.0, 1.25, 1.5];
        const btns = rates.map(r =>
          `<button class="speed-btn${r === playbackRate ? ' active' : ''}" data-rate="${r}">${r}x</button>`
        ).join('');
        return `<span style="font-size:0.8em; color:var(--text-tertiary); margin-right:4px;">速度</span><div class="speed-btn-group">${btns}</div>`;
      }

      // スピード変更・保存・再生中なら即時反映
      function setPlaybackRate(rate) {
        playbackRate = rate;
        localStorage.setItem('lexie_playback_rate', rate);
        if (currentAudio) currentAudio.playbackRate = rate;
        document.querySelectorAll('.speed-btn').forEach(btn =>
          btn.classList.toggle('active', parseFloat(btn.dataset.rate) === rate)
        );
      }

      // スピードボタンのイベントを配線（コンテナ内の.speed-btnに一括設定）
      function bindSpeedButtons() {
        document.querySelectorAll('.speed-btn').forEach(btn => {
          btn.onclick = () => setPlaybackRate(parseFloat(btn.dataset.rate));
        });
      }

      // フォントサイズボタンのHTML文字列を生成（speed-btnと同じデザイン）
      function renderFontSizeButtons() {
        const sizes = [{ key: 'sm', label: '小' }, { key: 'md', label: '中' }, { key: 'lg', label: '大' }];
        const btns = sizes.map(s =>
          `<button class="speed-btn font-size-btn${s.key === fontSize ? ' active' : ''}" data-size="${s.key}">${s.label}</button>`
        ).join('');
        return `<span style="font-size:0.8em; color:var(--text-tertiary); margin-right:2px;">文字</span><div class="speed-btn-group">${btns}</div>`;
      }

      // フォントサイズ変更・保存・DOM即時反映
      function setFontSize(size) {
        fontSize = size;
        localStorage.setItem('lexie_font_size', size);
        document.querySelectorAll('.font-size-target').forEach(el => {
          el.classList.remove('font-size-sm', 'font-size-lg');
          if (size !== 'md') el.classList.add(`font-size-${size}`);
        });
        document.querySelectorAll('.font-size-btn').forEach(btn =>
          btn.classList.toggle('active', btn.dataset.size === size)
        );
      }

      // フォントサイズボタンのイベント配線
      function bindFontSizeButtons() {
        document.querySelectorAll('.font-size-btn').forEach(btn => {
          btn.onclick = () => setFontSize(btn.dataset.size);
        });
      }

      function shuffleArray(array) {
        const newArr = [...array];
        for (let i = newArr.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
        }
        return newArr;
      }
      function playNextTrack() {
        if (!isSequentialPlaying) return;
        currentIndex++;
        if (currentIndex < playlist.length) playTrackByIndex(currentIndex);
        else stopAllPlayback();
      }
      function playTrackByIndex(index) {
        currentIndex = index;
        const track = playlist[currentIndex];
        if (!track || !track.audioUrl) return;
        if (currentAudio) {
          currentAudio.pause();
          currentAudio.currentTime = 0;
        }
        currentAudio = new Audio(track.audioUrl);
        currentAudio.playbackRate = playbackRate;
        document
          .querySelectorAll(".voiceline-item")
          .forEach((el) => el.classList.remove("playing"));
        const currentEl = document.getElementById(`vl-item-${track.id}`);
        if (currentEl) currentEl.classList.add("playing");
        document.getElementById("sticky-now-playing-text").innerText =
          track.quote;
        document.getElementById("sticky-audio-player").classList.add("visible");
        isSequentialPlaying = true;
        updatePlayerUI();
        currentAudio.play().catch((e) => console.error(e));
        currentAudio.onended = () => {
          if (isSequentialPlaying) playNextTrack();
        };
      }
      function stopAllPlayback() {
        isSequentialPlaying = false;
        if (currentAudio) currentAudio.pause();
        updatePlayerUI();
      }
      function updatePlayerUI() {
        const playBtn = document.getElementById("play-all-master-btn");
        const stickyPlayBtn = document.getElementById("sticky-play-pause");
        const shuffleBtn = document.getElementById("shuffle-toggle-btn");
        const icon = isSequentialPlaying ? "⏸" : "▶";
        if (playBtn)
          playBtn.innerText = isSequentialPlaying
            ? "⏸ 一時停止"
            : "▶ 全音声再生";
        if (stickyPlayBtn) stickyPlayBtn.innerText = icon;
        if (shuffleBtn) {
          shuffleBtn.innerText = isShuffle ? "🔀 ON" : "🔀 OFF";
          shuffleBtn.style.color = isShuffle
            ? "var(--accent-secondary)"
            : "var(--accent-primary)";
        }
      }

      // ひらがな → カタカナ変換（検索の正規化用）
      // U+3041–U+3096（ひらがな）を +0x60 シフトしてカタカナへ
      function toKatakana(str) {
        return str.replace(/[ぁ-ゖ]/g, (ch) =>
          String.fromCharCode(ch.charCodeAt(0) + 0x60)
        );
      }

      function filterBrawlers() {
        const s = toKatakana(searchInput.value.toLowerCase().trim());
        const r = rarityFilter.value;
        const ro = roleFilter.value;
        const source = typeof brawlers !== "undefined" ? brawlers : [];
        filteredBrawlers = source.filter(
          (b) =>
            toKatakana(b.name.toLowerCase()).includes(s) &&
            (!r || b.rarity === r) &&
            (!ro || b.role === ro)
        );
        const grid = document.getElementById("brawler-grid");
        const noRes = document.getElementById("no-results");
        grid.innerHTML = "";
        if (filteredBrawlers.length === 0) noRes.style.display = "block";
        else {
          noRes.style.display = "none";
          filteredBrawlers.forEach((b) =>
            grid.appendChild(createBrawlerCard(b))
          );
        }
      }

      // ----------------------------------------------------
      // 6. 初期化（ページの準備）
      // ----------------------------------------------------
      document.addEventListener("DOMContentLoaded", () => {
        // ナビゲーションのボタン設定
        document.querySelectorAll(".nav-link").forEach((link) => {
          link.addEventListener("click", (e) => {
            const target = link.dataset.target;
            switchPage(target);
          });
        });

        // バナー初期化・イベント設定
        initBanner();
        document.getElementById('update-banner-close').addEventListener('click', closeBanner);
        document.getElementById('update-banner-link').addEventListener('click', () => {
          switchPage('changelog');
          closeBanner();
        });

        // お気に入りページのイベント
        favSearchInput.addEventListener("input", renderFavoritesPage);
        showVoicelinesOnlyCheckbox.addEventListener(
          "change",
          renderFavoritesPage
        );

        if (searchInput) searchInput.oninput = filterBrawlers;
        if (rarityFilter) rarityFilter.onchange = filterBrawlers;
        if (roleFilter) roleFilter.onchange = filterBrawlers;

        const themeToggleButton = document.createElement("button");
        themeToggleButton.id = "theme-toggle-btn";
        document.body.appendChild(themeToggleButton);
        const currentTheme = localStorage.getItem("theme");
        if (currentTheme === "light") {
          document.body.classList.add("light-theme");
          themeToggleButton.innerHTML = "🌙";
        } else {
          themeToggleButton.innerHTML = "☀️";
        }
        themeToggleButton.onclick = () => {
          document.body.classList.toggle("light-theme");
          let t = document.body.classList.contains("light-theme")
            ? "light"
            : "dark";
          themeToggleButton.innerHTML = t === "light" ? "🌙" : "☀️";
          localStorage.setItem("theme", t);
        };

        document.getElementById("sticky-play-pause").onclick = () => {
          if (isSequentialPlaying) stopAllPlayback();
          else if (currentAudio) {
            isSequentialPlaying = true;
            currentAudio.play();
            updatePlayerUI();
          }
        };
        document.getElementById("sticky-next").onclick = playNextTrack;
        document.getElementById("sticky-prev").onclick = () => {
          if (currentIndex > 0) {
            currentIndex--;
            playTrackByIndex(currentIndex);
          }
        };
        document.getElementById("sticky-shuffle").onclick = () => {
          isShuffle = !isShuffle;
          updatePlayerUI();
        };

        // ▼▼▼ ページトップへ戻る ＆ ヘッダーの変形（ここを修正） ▼▼▼
        const pageTopBtn = document.createElement("div");
        pageTopBtn.id = "page-top-btn";
        pageTopBtn.innerHTML = "▲";
        document.body.appendChild(pageTopBtn);

        // スクロール時の動き（rAF スロットル＋状態変化ガードでjitter防止）
        const headerEl = document.querySelector("header");
        let ticking = false;
        window.addEventListener("scroll", () => {
          if (ticking) return;
          ticking = true;
          requestAnimationFrame(() => {
            // 1. トップへ戻るボタンの表示・非表示
            pageTopBtn.classList.toggle("visible", window.scrollY > 300);

            // 2. ヘッダーのコンパクト化（ヒステリシスで自己ループ防止）
            //    ON閾値(150px)とOFF閾値(20px)を分けることで、
            //    ヘッダー縮小(~70px)による scroll anchoring の影響でループしなくなる
            const SCROLL_ENTER = 100;
            const SCROLL_LEAVE = 20;
            const y = window.scrollY;
            const isScrolled = headerEl.classList.contains("scrolled");
            if (!isScrolled && y > SCROLL_ENTER) {
              headerEl.classList.add("scrolled");
            } else if (isScrolled && y < SCROLL_LEAVE) {
              headerEl.classList.remove("scrolled");
            }

            ticking = false;
          });
        }, { passive: true });

        pageTopBtn.onclick = () =>
          window.scrollTo({ top: 0, behavior: "smooth" });

        migrateMemorizeHard();
        loadBrawlersIndex().then(() => {
          filterBrawlers();
          const currentActiveLink = document.querySelector('.nav-link.active');
          if (currentActiveLink && currentActiveLink.dataset.target === 'favorites') {
            renderFavoritesPage();
          }
        });
        embedTikTokVideo("7507203728039070996", "tiktok-video-1");

        // デッキ選択ドロワー：オーバーレイ外クリックで閉じる
        document.getElementById('deck-picker-overlay').addEventListener('click', (e) => {
          if (e.target === document.getElementById('deck-picker-overlay')) hideDeckPicker();
        });
        document.getElementById('deck-picker-close-btn').addEventListener('click', hideDeckPicker);
      });

      function embedTikTokVideo(videoId, targetElementId) {
        const targetElement = document.getElementById(targetElementId);
        if (targetElement) {
          targetElement.style.backgroundColor = "#1f1f1f";
          targetElement.innerHTML = `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@bion329/video/${videoId}" data-video-id="${videoId}" style="max-width: 605px;min-width: 325px;"><section><a target="_blank" title="@bion329" href="https://www.tiktok.com/@bion329?refer=embed">@bion329</a></section></blockquote>`;
        }
      }
