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
      let brawlerObserver = null;

      async function loadBrawlersIndex() {
        try {
          const response = await fetch('data/brawlers-index.json');
          brawlers = await response.json();
        } catch (err) {
          console.error("Failed to load brawlers-index.json", err);
        }
      }

      function initBrawlerObserver() {
        if (!('IntersectionObserver' in window)) return;
        brawlerObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const card = entry.target;
              const brawlerId = card.dataset.brawlerId;
              const b = brawlers.find(x => x.fileId === brawlerId);
              if (b) prefetchBrawlerData(b);
              observer.unobserve(card);
            }
          });
        }, {
          rootMargin: "200px 0px"
        });
      }

      function prefetchBrawlerData(b) {
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

      // クイズ用：全キャラの voicelines を一括ロード（未ロード分だけ）
      async function ensureAllBrawlersLoaded() {
        const fetchPromises = [];
        brawlers.forEach(b => {
          if (!b.voicelines && !b.isFetching) {
            b.isFetching = true;
            const p = fetch(`data/brawlers/${b.fileId}.json`)
              .then(res => res.json())
              .then(detail => {
                b.voicelines = detail.voicelines;
                b.tiktokEmbed = detail.tiktokEmbed;
                b.isFetching = false;
              })
              .catch(err => {
                console.error(`Failed to load brawler ${b.nameEn}:`, err);
                b.isFetching = false;
              });
            fetchPromises.push(p);
          } else if (b.isFetching && b.fetchPromise) {
            fetchPromises.push(b.fetchPromise);
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
          "quiz",
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
        } else if (pageName === "quiz") {
          document.getElementById("quiz").classList.remove("hidden");
          document.querySelector('[data-target="quiz"]').classList.add("active");
          // 全キャラの voicelines を先読み（クイズは全データが必要）
          ensureAllBrawlersLoaded().then(() => {
            if (typeof showQuizHome === "function") showQuizHome();
          });
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
        card.dataset.brawlerId = b.fileId;
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

        if (brawlerObserver) {
          brawlerObserver.observe(card);
        }

        const prefetch = () => prefetchBrawlerData(b);
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
          // GA4 カスタムイベント：どのキャラが見られたか記録
          if (typeof gtag === "function") {
            gtag("event", "view_brawler", { brawler: b.name });
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

      // GA4 検索イベントを 500ms debounce で発火（途中経過ノイズを除去）
      let searchAnalyticsTimer;
      function trackSearchDebounced(query) {
        clearTimeout(searchAnalyticsTimer);
        if (!query) return;
        searchAnalyticsTimer = setTimeout(() => {
          if (typeof gtag === "function") {
            gtag("event", "translate_search", { query: query });
          }
        }, 500);
      }

      function filterBrawlers() {
        const rawQuery = searchInput.value.trim();
        const s = toKatakana(rawQuery.toLowerCase());
        const r = rarityFilter.value;
        const ro = roleFilter.value;
        trackSearchDebounced(rawQuery);
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
        initBrawlerObserver();
        loadBrawlersIndex().then(() => {
          filterBrawlers();
          const currentActiveLink = document.querySelector('.nav-link.active');
          if (currentActiveLink && currentActiveLink.dataset.target === 'favorites') {
            renderFavoritesPage();
          }
        });
        embedTikTokVideo("7507203728039070996", "tiktok-video-1");
        initQuizEvents();

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
      // ============================================================
      // 🎯 Quiz feature (v3.0 Phase 1: Mode 2 only)
      // ============================================================
      const QUIZ_MODES = {
        translation_jp: { name: '和訳クイズ', icon: '🇯🇵→🇬🇧' },
        translation_en: { name: '英訳クイズ', icon: '🇬🇧→🇯🇵' },
        listening: { name: 'リスニングクイズ', icon: '🎧' },
        character: { name: 'キャラ当てクイズ', icon: '🎮' },
        arrange: { name: '並び替えクイズ', icon: '🔤' },
      };

      const quizState = {
        mode: null,
        config: null,
        questions: [],
        currentIndex: 0,
        correctCount: 0,
        currentCombo: 0,
        maxCombo: 0,
        startTime: 0,
        wrongAnswers: [],
        timerInterval: null,
        timeLeft: 0,
        answered: false,
      };

      // --- localStorage helpers ---
      function getQuizStats() {
        return JSON.parse(localStorage.getItem('lexie_quiz_stats') || '{"totalQuizzes":0,"totalQuestions":0,"totalCorrect":0,"longestStreak":0,"dailyStreak":0,"lastPlayedAt":null}');
      }
      function saveQuizStats(s) { localStorage.setItem('lexie_quiz_stats', JSON.stringify(s)); }
      function getQuizHistory() { return JSON.parse(localStorage.getItem('lexie_quiz_history') || '[]'); }
      function pushQuizHistory(entry) {
        const h = getQuizHistory();
        h.unshift(entry);
        if (h.length > 50) h.length = 50;
        localStorage.setItem('lexie_quiz_history', JSON.stringify(h));
      }
      function getQuizWeak() { return JSON.parse(localStorage.getItem('lexie_quiz_weak') || '{}'); }
      function bumpQuizWeak(voicelineId) {
        const w = getQuizWeak();
        if (!w[voicelineId]) w[voicelineId] = { count: 0, addedToReview: false };
        w[voicelineId].count++;
        let justAdded = false;
        if (w[voicelineId].count >= 2 && !w[voicelineId].addedToReview) {
          let decks = getDecks();
          let reviewDeck = decks.find(d => d.name === '要復習');
          if (!reviewDeck) {
            reviewDeck = createDeck('要復習');
            decks = getDecks();
            reviewDeck = decks.find(d => d.name === '要復習');
          }
          if (reviewDeck && !reviewDeck.voicelineIds.includes(voicelineId)) {
            reviewDeck.voicelineIds.push(voicelineId);
            saveDecks(decks);
            justAdded = true;
          }
          w[voicelineId].addedToReview = true;
        }
        localStorage.setItem('lexie_quiz_weak', JSON.stringify(w));
        return justAdded;
      }
      function getQuizLastConfig() { return JSON.parse(localStorage.getItem('lexie_quiz_last_config') || 'null'); }
      function saveQuizLastConfig(c) { localStorage.setItem('lexie_quiz_last_config', JSON.stringify(c)); }
      function getQuizModeStats() { return JSON.parse(localStorage.getItem('lexie_quiz_mode_stats') || '{}'); }
      function updateQuizModeStats(mode, questionCount, correctCount) {
        const stats = getQuizModeStats();
        const key = `${mode}_${questionCount}`;
        const ratio = correctCount / questionCount;
        if (!stats[key]) stats[key] = { best: 0, played: 0, totalCorrect: 0 };
        const prevBest = stats[key].best;
        stats[key].played++;
        stats[key].totalCorrect += correctCount;
        const isNewBest = ratio > prevBest;
        if (isNewBest) stats[key].best = ratio;
        localStorage.setItem('lexie_quiz_mode_stats', JSON.stringify(stats));
        return { isNewBest, previousBest: prevBest };
      }
      function updateDailyStreak() {
        const stats = getQuizStats();
        const today = new Date().toISOString().slice(0, 10);
        if (stats.lastPlayedAt !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          stats.dailyStreak = (stats.lastPlayedAt === yesterday) ? stats.dailyStreak + 1 : 1;
          stats.lastPlayedAt = today;
          saveQuizStats(stats);
        }
      }

      // --- Toast ---
      let _quizToastTimer = null;
      function showQuizToast(msg) {
        let t = document.getElementById('quiz-toast');
        if (!t) {
          t = document.createElement('div');
          t.id = 'quiz-toast';
          document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('visible');
        if (_quizToastTimer) clearTimeout(_quizToastTimer);
        _quizToastTimer = setTimeout(() => t.classList.remove('visible'), 2400);
      }

      // --- Voiceline pool ---
      function getAllVoicelinesForQuiz() {
        const out = [];
        if (typeof brawlers === 'undefined') return out;
        brawlers.forEach(b => {
          if (!b.voicelines) return;
          b.voicelines.forEach(l => out.push({
            voiceline: l,
            brawlerName: b.name,
            brawlerRarity: b.rarity,
            brawlerRole: b.role,
          }));
        });
        return out;
      }
      function isInterjectionOnly(quote) {
        const cleaned = quote.replace(/[!.,?\-…¡¿]/g, '').trim();
        const words = cleaned.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return true;
        if (words.length === 1 && cleaned.length <= 6) return true;
        return false;
      }
      function getScopedVoicelines(scope, scopeIds) {
        const all = getAllVoicelinesForQuiz();
        if (scope === 'all') return all;
        if (scope === 'favorites') {
          const favs = getVoicelineFavorites();
          return all.filter(item => favs.includes(item.voiceline.id));
        }
        if (scope === 'deck') {
          const deck = getDecks().find(d => d.id === scopeIds);
          if (!deck) return [];
          return all.filter(item => deck.voicelineIds.includes(item.voiceline.id));
        }
        return all;
      }
      function filterForMode(pool, mode) {
        let filtered = pool.filter(item => !isInterjectionOnly(item.voiceline.quote));
        if (mode === 'translation_jp' || mode === 'translation_en') {
          filtered = filtered.filter(item => item.voiceline.translation && item.voiceline.translation.trim().length > 0);
        }
        if (mode === 'listening' || mode === 'character') {
          filtered = filtered.filter(item => item.voiceline.audioUrl);
        }
        if (mode === 'arrange') {
          filtered = filtered.filter(item => item.voiceline.quote.split(/\s+/).filter(w => w.length > 0).length >= 3);
        }
        return filtered;
      }
      function pickRandom(arr, n) {
        return shuffleArray(arr).slice(0, n);
      }

      // --- Hard distractor helpers (Phase 3) ---
      // 同キャラの他セリフから distractor を取る。揃わなければ null（呼び出し側が通常生成にフォールバック）
      function getHardTextDistractors(mode, correctItem, count) {
        if (typeof brawlers === 'undefined') return null;
        const brawler = brawlers.find(b => b.name === correctItem.brawlerName);
        if (!brawler || !brawler.voicelines) return null;
        const others = brawler.voicelines.filter(vl => vl.id !== correctItem.voiceline.id);
        let texts;
        if (mode === 'translation_jp') {
          texts = others.map(vl => vl.translation).filter(t => t && t !== correctItem.voiceline.translation);
        } else {
          // translation_en または listening
          texts = others.map(vl => vl.quote).filter(t => t && t !== correctItem.voiceline.quote);
        }
        const unique = [...new Set(texts)];
        if (unique.length < count) return null;
        return pickRandom(unique, count);
      }
      // Mode 4: C案(同レア度 AND 同役割) → A案(同レア度) → null
      function getHardBrawlerDistractors(correctItem, count) {
        if (typeof brawlers === 'undefined') return null;
        const r = correctItem.brawlerRarity;
        const ro = correctItem.brawlerRole;
        const cPool = brawlers.filter(b => b.name !== correctItem.brawlerName && b.rarity === r && b.role === ro);
        if (cPool.length >= count) return pickRandom(cPool, count);
        const aPool = brawlers.filter(b => b.name !== correctItem.brawlerName && b.rarity === r);
        if (aPool.length >= count) return pickRandom(aPool, count);
        return null;
      }

      // --- Question generation ---
      function generateQuestions(mode, config) {
        const pool = filterForMode(getScopedVoicelines(config.scope, config.scopeIds), mode);
        if (pool.length < 4) {
          return { error: '出題できるセリフが少なすぎます（最低4件必要）。出題範囲を広げてください。' };
        }
        const targetCount = Math.min(config.questionCount, pool.length);
        const selected = shuffleArray(pool).slice(0, targetCount);
        const isHard = config.difficulty === 'hard';

        const questions = selected.map(item => {
          const correctVl = item.voiceline;
          let choices, correctText, choiceMeta = null;
          if (mode === 'translation_jp') {
            correctText = correctVl.translation;
            let distractors = isHard ? getHardTextDistractors('translation_jp', item, 3) : null;
            if (!distractors) {
              const distractorPool = pool
                .filter(p => p.voiceline.id !== correctVl.id && p.voiceline.translation !== correctText)
                .map(p => p.voiceline.translation);
              distractors = pickRandom([...new Set(distractorPool)], 3);
            }
            choices = shuffleArray([correctText, ...distractors]);
          } else if (mode === 'translation_en' || mode === 'listening') {
            correctText = correctVl.quote;
            let distractors = isHard ? getHardTextDistractors(mode, item, 3) : null;
            if (!distractors) {
              const distractorPool = pool
                .filter(p => p.voiceline.id !== correctVl.id && p.voiceline.quote !== correctText)
                .map(p => p.voiceline.quote);
              distractors = pickRandom([...new Set(distractorPool)], 3);
            }
            choices = shuffleArray([correctText, ...distractors]);
          } else if (mode === 'character') {
            correctText = item.brawlerName;
            let distractorBrawlers = isHard ? getHardBrawlerDistractors(item, 3) : null;
            if (!distractorBrawlers) {
              const otherBrawlers = (typeof brawlers !== 'undefined')
                ? brawlers.filter(b => b.name !== item.brawlerName)
                : [];
              distractorBrawlers = pickRandom(otherBrawlers, 3);
            }
            const correctBrawlerObj = (typeof brawlers !== 'undefined')
              ? brawlers.find(b => b.name === item.brawlerName)
              : { name: item.brawlerName, iconUrl: '' };
            const choiceObjects = shuffleArray([correctBrawlerObj, ...distractorBrawlers]);
            choices = choiceObjects.map(b => b.name);
            choiceMeta = choiceObjects.map(b => ({ iconUrl: b.iconUrl || '' }));
          } else if (mode === 'arrange') {
            // Phase 3 では並び替えのハード難易度は通常と同じ（dummy単語追加はv3.1で検討）
            correctText = correctVl.quote;
            choices = [];
          } else {
            choices = [];
            correctText = '';
          }
          return {
            voiceline: correctVl,
            brawlerName: item.brawlerName,
            choices,
            choiceMeta,
            correctText,
            correctIndex: choices.indexOf(correctText),
          };
        });
        return { questions };
      }

      // --- View routing within #quiz ---
      function showQuizView(viewName) {
        ['quiz-home-view', 'quiz-settings-view', 'quiz-play-view', 'quiz-result-view'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.style.display = (id === viewName) ? 'block' : 'none';
        });
      }
      function showQuizHome() {
        showQuizView('quiz-home-view');
        renderQuizHomeStats();
        renderQuizModeBests();
      }
      function renderQuizModeBests() {
        const container = document.getElementById('quiz-mode-bests-section');
        if (!container) return;
        const modeStats = getQuizModeStats();
        const entries = Object.entries(modeStats);
        if (entries.length === 0) {
          container.style.display = 'none';
          return;
        }
        // mode別にグループ化: key = "<mode>_<count>"
        const byMode = {};
        entries.forEach(([key, data]) => {
          const m = key.match(/^(.+)_(\d+)$/);
          if (!m) return;
          const mode = m[1];
          const count = m[2];
          if (!byMode[mode]) byMode[mode] = {};
          byMode[mode][count] = Math.round(data.best * 100);
        });
        const modeOrder = ['translation_jp', 'translation_en', 'listening', 'character', 'arrange'];
        const playedModes = modeOrder.filter(m => byMode[m]);
        if (playedModes.length === 0) {
          container.style.display = 'none';
          return;
        }
        container.style.display = 'block';
        const rows = playedModes.map(m => {
          const counts = byMode[m];
          const cells = [5, 10, 20, 50].map(c => {
            const hasRecord = counts[c] !== undefined;
            return '<span class="quiz-best-cell' + (hasRecord ? ' has-record' : '') + '">' +
              c + '問: ' + (hasRecord ? counts[c] + '%' : '―') +
            '</span>';
          }).join('');
          const info = QUIZ_MODES[m] || { name: m, icon: '' };
          return '<div class="quiz-best-row">' +
            '<div class="quiz-best-mode">' + info.icon + ' ' + info.name + '</div>' +
            '<div class="quiz-best-cells">' + cells + '</div>' +
          '</div>';
        }).join('');
        container.innerHTML = '<h3 class="quiz-section-subtitle">🏆 モード別ベスト記録</h3>' + rows;
      }
      function renderQuizHomeStats() {
        const stats = getQuizStats();
        const summary = document.getElementById('quiz-stats-summary');
        if (!summary) return;
        if (stats.totalQuizzes === 0) {
          summary.innerHTML = '<div style="color:var(--text-tertiary); text-align:center; width:100%; padding:8px 0;">まだクイズを受けていません。下から好きなモードを選んでスタート！</div>';
          return;
        }
        const accuracy = Math.round((stats.totalCorrect / stats.totalQuestions) * 100);
        summary.innerHTML =
          '<div class="quiz-stat-item"><div class="quiz-stat-value">' + stats.totalQuizzes + '</div><div class="quiz-stat-label">受験回数</div></div>' +
          '<div class="quiz-stat-item"><div class="quiz-stat-value">' + accuracy + '%</div><div class="quiz-stat-label">累計正答率</div></div>' +
          '<div class="quiz-stat-item"><div class="quiz-stat-value">🔥' + stats.dailyStreak + '</div><div class="quiz-stat-label">連続学習日数</div></div>' +
          '<div class="quiz-stat-item"><div class="quiz-stat-value">' + stats.longestStreak + '</div><div class="quiz-stat-label">最長コンボ</div></div>';
      }

      // --- Settings ---
      function showQuizSettings(mode) {
        showQuizView('quiz-settings-view');
        document.getElementById('quiz-settings-mode-title').textContent = QUIZ_MODES[mode].icon + ' ' + QUIZ_MODES[mode].name;
        quizState.mode = mode;
        const deckSelect = document.getElementById('quiz-scope-deck-id');
        const decks = getDecks();
        deckSelect.innerHTML = decks.length === 0
          ? '<option value="">単語帳がありません</option>'
          : decks.map(d => '<option value="' + d.id + '">' + escapeHtml(d.name) + ' (' + d.voicelineIds.length + '件)</option>').join('');
        // 直近設定の反映
        const last = getQuizLastConfig();
        if (last && last.mode === mode) {
          const scopeRadio = document.querySelector('input[name="quiz-scope"][value="' + last.scope + '"]');
          if (scopeRadio) {
            scopeRadio.checked = true;
            document.getElementById('quiz-scope-deck-select').style.display = (last.scope === 'deck') ? 'block' : 'none';
            if (last.scope === 'deck' && last.scopeIds) deckSelect.value = last.scopeIds;
          }
          setPillActive('quiz-question-count', last.questionCount);
          setPillActive('quiz-timer', last.timer);
          if (last.difficulty) setPillActive('quiz-difficulty', last.difficulty);
        }
      }
      function setPillActive(groupId, value) {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.quiz-pill').forEach(b => {
          b.classList.toggle('active', String(b.dataset.value) === String(value));
        });
      }
      function readQuizSettings() {
        const scope = document.querySelector('input[name="quiz-scope"]:checked').value;
        const scopeIds = (scope === 'deck') ? document.getElementById('quiz-scope-deck-id').value : null;
        const questionCount = parseInt(document.querySelector('#quiz-question-count .quiz-pill.active').dataset.value);
        const timer = parseInt(document.querySelector('#quiz-timer .quiz-pill.active').dataset.value);
        const difficulty = document.querySelector('#quiz-difficulty .quiz-pill.active').dataset.value;
        return { scope, scopeIds, questionCount, timer, difficulty };
      }

      // --- Quiz play ---
      function startQuiz() {
        const config = readQuizSettings();
        if (config.scope === 'deck' && !config.scopeIds) {
          alert('単語帳を選んでください。');
          return;
        }
        const result = generateQuestions(quizState.mode, config);
        if (result.error) {
          alert(result.error);
          return;
        }
        quizState.config = config;
        quizState.questions = result.questions;
        quizState.currentIndex = 0;
        quizState.correctCount = 0;
        quizState.currentCombo = 0;
        quizState.maxCombo = 0;
        quizState.startTime = Date.now();
        quizState.wrongAnswers = [];
        saveQuizLastConfig({ ...config, mode: quizState.mode });
        showQuizView('quiz-play-view');
        showQuestion(0);
      }
      function showQuestion(idx) {
        const q = quizState.questions[idx];
        quizState.currentIndex = idx;
        quizState.answered = false;
        stopQuizQuestionAudio();
        const total = quizState.questions.length;
        document.getElementById('quiz-progress-text').textContent = (idx + 1) + ' / ' + total;
        document.getElementById('quiz-progress-bar-fill').style.width = ((idx) / total) * 100 + '%';
        const qc = document.getElementById('quiz-question-content');
        const m = quizState.mode;
        const hintAudioBtn = q.voiceline.audioUrl
          ? '<button class="quiz-hint-audio-btn" id="quiz-hint-audio-btn">🔊 音声を聞く</button>'
          : '';
        if (m === 'translation_jp') {
          qc.innerHTML =
            '<div class="quiz-question-prompt">この英文の和訳は？</div>' +
            '<div class="quiz-question-text">"' + escapeHtml(q.voiceline.quote) + '"</div>' +
            '<div class="quiz-question-brawler">— ' + escapeHtml(q.brawlerName) + '</div>' +
            hintAudioBtn;
        } else if (m === 'translation_en') {
          qc.innerHTML =
            '<div class="quiz-question-prompt">この和訳の英文は？</div>' +
            '<div class="quiz-question-text">' + escapeHtml(q.voiceline.translation) + '</div>' +
            '<div class="quiz-question-brawler">— ' + escapeHtml(q.brawlerName) + '</div>' +
            hintAudioBtn;
        } else if (m === 'listening') {
          qc.innerHTML =
            '<div class="quiz-question-prompt">音声を聞いて、正しい英文を選ぼう</div>' +
            '<button id="quiz-audio-play-btn" class="quiz-audio-btn">🔊 もう一度聞く (3/3)</button>' +
            '<div class="quiz-question-brawler">— ???</div>';
          setupQuizQuestionAudio(q.voiceline.audioUrl);
        } else if (m === 'character') {
          qc.innerHTML =
            '<div class="quiz-question-prompt">このセリフは誰が言ってる？</div>' +
            '<button id="quiz-audio-play-btn" class="quiz-audio-btn">🔊 もう一度聞く (3/3)</button>';
          setupQuizQuestionAudio(q.voiceline.audioUrl);
        } else if (m === 'arrange') {
          // 並び替えは音声が答えになるので事前ヒントは出さない（正解後にだけ feedback で表示）
          qc.innerHTML =
            '<div class="quiz-question-prompt">この和訳の英文を、単語をタップして並び替えよう</div>' +
            '<div class="quiz-question-text" style="font-size:1.2em;">' + escapeHtml(q.voiceline.translation) + '</div>' +
            '<div class="quiz-question-brawler">— ' + escapeHtml(q.brawlerName) + '</div>';
        }
        // テキスト系モードの音声ヒントボタンを配線
        const hintBtn = document.getElementById('quiz-hint-audio-btn');
        if (hintBtn) {
          hintBtn.onclick = () => playQuizQuestionAudio(q.voiceline.audioUrl);
        }
        // 並び替えは別UI、それ以外は4択UI
        const choicesEl = document.getElementById('quiz-choices');
        const arrangeEl = document.getElementById('quiz-arrange-area');
        if (m === 'arrange') {
          choicesEl.style.display = 'none';
          arrangeEl.style.display = 'block';
          setupArrangeQuestion(q);
        } else {
          choicesEl.style.display = 'grid';
          arrangeEl.style.display = 'none';
          if (m === 'character') {
            choicesEl.classList.add('quiz-choices-char');
            choicesEl.innerHTML = q.choices.map((name, i) => {
              const icon = (q.choiceMeta && q.choiceMeta[i] && q.choiceMeta[i].iconUrl) || '';
              return '<button class="quiz-choice quiz-choice-char" data-idx="' + i + '">' +
                (icon ? '<img src="' + icon + '" alt="" class="quiz-choice-char-icon">' : '') +
                '<span class="quiz-choice-char-name">' + escapeHtml(name) + '</span>' +
              '</button>';
            }).join('');
          } else {
            choicesEl.classList.remove('quiz-choices-char');
            choicesEl.innerHTML = q.choices.map((c, i) =>
              '<button class="quiz-choice" data-idx="' + i + '">' + escapeHtml(c) + '</button>'
            ).join('');
          }
          choicesEl.querySelectorAll('.quiz-choice').forEach(btn => {
            btn.onclick = () => answerQuestion(parseInt(btn.dataset.idx));
          });
        }
        document.getElementById('quiz-feedback').style.display = 'none';
        document.getElementById('quiz-next-btn-wrap').style.display = 'none';
        stopQuizTimer();
        if (quizState.config.timer > 0) startQuizTimer(quizState.config.timer);
        else document.getElementById('quiz-timer-display').textContent = '';
      }
      function startQuizTimer(seconds) {
        quizState.timeLeft = seconds;
        const disp = document.getElementById('quiz-timer-display');
        disp.textContent = '⏱ ' + seconds + '秒';
        disp.classList.remove('warning');
        quizState.timerInterval = setInterval(() => {
          quizState.timeLeft--;
          disp.textContent = '⏱ ' + quizState.timeLeft + '秒';
          if (quizState.timeLeft <= 5) disp.classList.add('warning');
          if (quizState.timeLeft <= 0) {
            stopQuizTimer();
            answerQuestion(-1);
          }
        }, 1000);
      }
      function stopQuizTimer() {
        if (quizState.timerInterval) { clearInterval(quizState.timerInterval); quizState.timerInterval = null; }
        const disp = document.getElementById('quiz-timer-display');
        if (disp) disp.classList.remove('warning');
      }
      function answerQuestion(chosenIdx, isCorrectOverride) {
        if (quizState.answered) return;
        quizState.answered = true;
        stopQuizTimer();
        stopQuizQuestionAudio();
        const q = quizState.questions[quizState.currentIndex];
        const correctIdx = q.correctIndex;
        const isCorrect = (typeof isCorrectOverride === 'boolean')
          ? isCorrectOverride
          : (chosenIdx === correctIdx);
        if (quizState.mode !== 'arrange') {
          document.querySelectorAll('#quiz-choices .quiz-choice').forEach((btn, i) => {
            btn.disabled = true;
            if (i === correctIdx) btn.classList.add(isCorrect && i === chosenIdx ? 'correct' : 'correct-revealed');
            else if (i === chosenIdx) btn.classList.add('incorrect');
          });
        }
        playQuizSound(isCorrect);
        if (isCorrect) {
          quizState.correctCount++;
          quizState.currentCombo++;
          if (quizState.currentCombo > quizState.maxCombo) quizState.maxCombo = quizState.currentCombo;
        } else {
          quizState.currentCombo = 0;
          quizState.wrongAnswers.push({ voiceline: q.voiceline, brawlerName: q.brawlerName });
          const justAdded = bumpQuizWeak(q.voiceline.id);
          if (justAdded) showQuizToast('「' + q.voiceline.quote.slice(0, 24) + '」を要復習に追加しました');
        }
        const fb = document.getElementById('quiz-feedback');
        const isTimeOut = chosenIdx === -1;
        // 並び替えクイズ回答後の音声ボタン（正解・不正解どちらでも表示）
        const arrangeRewardBtn = (quizState.mode === 'arrange' && q.voiceline.audioUrl)
          ? '<div style="margin-top:12px; text-align:center;"><button class="quiz-hint-audio-btn" id="quiz-arrange-reward-btn">🔊 音声を聞いてみる</button></div>'
          : '';
        fb.innerHTML =
          '<div class="quiz-feedback-title ' + (isCorrect ? 'correct' : 'incorrect') + '">' +
            (isCorrect ? '✅ 正解！' : (isTimeOut ? '⏰ 時間切れ' : '❌ 不正解')) +
          '</div>' +
          '<div class="quiz-feedback-detail">' +
            '<strong style="color:var(--accent-primary);">"' + escapeHtml(q.voiceline.quote) + '"</strong><br>' +
            escapeHtml(q.voiceline.translation) + '<br>' +
            '<span style="color:var(--text-tertiary); font-size:0.85em;">— ' + escapeHtml(q.brawlerName) + '</span>' +
          '</div>' +
          arrangeRewardBtn;
        fb.style.display = 'block';
        const rewardBtn = document.getElementById('quiz-arrange-reward-btn');
        if (rewardBtn) {
          rewardBtn.onclick = () => playQuizQuestionAudio(q.voiceline.audioUrl);
        }
        document.getElementById('quiz-next-btn-wrap').style.display = 'block';
      }
      function nextQuestion() {
        const nextIdx = quizState.currentIndex + 1;
        if (nextIdx >= quizState.questions.length) endQuiz();
        else showQuestion(nextIdx);
      }
      function endQuiz() {
        stopQuizTimer();
        stopQuizQuestionAudio();
        const timeSec = Math.round((Date.now() - quizState.startTime) / 1000);
        const total = quizState.questions.length;
        const correct = quizState.correctCount;
        const stats = getQuizStats();
        stats.totalQuizzes++;
        stats.totalQuestions += total;
        stats.totalCorrect += correct;
        if (quizState.maxCombo > stats.longestStreak) stats.longestStreak = quizState.maxCombo;
        saveQuizStats(stats);
        updateDailyStreak();
        pushQuizHistory({
          ts: Date.now(),
          mode: quizState.mode,
          score: correct,
          total,
          timeSec,
          scope: quizState.config.scope,
          difficulty: quizState.config.difficulty,
        });
        const { isNewBest, previousBest } = updateQuizModeStats(quizState.mode, total, correct);
        if (typeof gtag === "function") {
          gtag("event", "quiz_complete", {
            mode: quizState.mode,
            difficulty: quizState.config.difficulty,
            score: correct,
            total: total,
          });
        }
        showQuizResult({ correct, total, timeSec, isNewBest, previousBest });
      }
      function showQuizResult({ correct, total, timeSec, isNewBest, previousBest }) {
        showQuizView('quiz-result-view');
        const pct = Math.round((correct / total) * 100);
        const minutes = Math.floor(timeSec / 60);
        const secs = timeSec % 60;
        const timeStr = minutes > 0 ? (minutes + '分' + secs + '秒') : (secs + '秒');
        const prevBestPct = Math.round(previousBest * 100);
        const wrongHtml = quizState.wrongAnswers.length === 0
          ? '<div style="text-align:center; color:#4caf50; padding:20px;">🎉 全問正解！素晴らしい！</div>'
          : quizState.wrongAnswers.map(w =>
              '<div class="quiz-result-wrong-item">' +
                '<div class="quiz-result-wrong-text">' +
                  '<div class="quote-en">"' + escapeHtml(w.voiceline.quote) + '"</div>' +
                  '<div class="quote-jp">' + escapeHtml(w.voiceline.translation) + ' — ' + escapeHtml(w.brawlerName) + '</div>' +
                '</div>' +
                '<button class="add-to-deck-btn" data-id="' + w.voiceline.id + '" title="単語帳に追加">＋</button>' +
              '</div>'
            ).join('');
        const bestBanner = (isNewBest && previousBest > 0)
          ? '<div class="quiz-result-best-tag">✨ ベスト更新！（前回 ' + prevBestPct + '%）</div>'
          : (isNewBest && previousBest === 0)
          ? '<div class="quiz-result-best-tag">🏆 初回ベスト記録！</div>'
          : '';
        document.getElementById('quiz-result-view').innerHTML =
          '<div class="quiz-result-card">' +
            '<div class="quiz-result-score">' + correct + ' / ' + total + '</div>' +
            '<div class="quiz-result-percent">' + pct + '% 正解</div>' +
            bestBanner +
            '<div class="quiz-result-stats">' +
              '<span>⏱ ' + timeStr + '</span>' +
              '<span>🔥 最大コンボ ' + quizState.maxCombo + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="quiz-result-wrong-list">' +
            '<div class="quiz-result-wrong-title">' + (quizState.wrongAnswers.length === 0 ? '結果' : '間違えたセリフ (' + quizState.wrongAnswers.length + '件)') + '</div>' +
            wrongHtml +
          '</div>' +
          '<div class="quiz-result-actions">' +
            '<button class="btn" id="quiz-result-retry">🔁 もう一度</button>' +
            '<button class="btn btn-secondary" id="quiz-result-resettings">⚙️ 設定を変える</button>' +
            '<button class="btn btn-secondary" id="quiz-result-home">🏠 ホームに戻る</button>' +
          '</div>';
        document.querySelectorAll('#quiz-result-view .add-to-deck-btn').forEach(btn => {
          btn.onclick = (e) => {
            e.stopPropagation();
            showDeckPicker(btn.dataset.id);
          };
        });
        document.getElementById('quiz-result-retry').onclick = () => startQuiz();
        document.getElementById('quiz-result-resettings').onclick = () => showQuizSettings(quizState.mode);
        document.getElementById('quiz-result-home').onclick = () => showQuizHome();
      }

      // --- Sound effects (Web Audio API) ---
      let _quizAudioCtx = null;
      function getQuizAudioCtx() {
        if (!_quizAudioCtx) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (AC) _quizAudioCtx = new AC();
        }
        return _quizAudioCtx;
      }
      function playQuizSound(isCorrect) {
        try {
          const ctx = getQuizAudioCtx();
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          if (isCorrect) {
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
          } else {
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.setValueAtTime(165, ctx.currentTime + 0.12);
          }
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
        } catch (e) { /* ignore */ }
      }

      // --- Quiz question audio (Mode 1/4) ---
      let _quizQuestionAudio = null;
      let _quizReplaysLeft = 0;
      function playQuizQuestionAudio(url) {
        if (!url) return;
        try {
          if (_quizQuestionAudio) { _quizQuestionAudio.pause(); _quizQuestionAudio = null; }
          _quizQuestionAudio = new Audio(url);
          _quizQuestionAudio.play().catch(() => { /* autoplay ブロック等は無視 */ });
        } catch (e) { /* ignore */ }
      }
      function stopQuizQuestionAudio() {
        if (_quizQuestionAudio) {
          try { _quizQuestionAudio.pause(); } catch (e) {}
          _quizQuestionAudio = null;
        }
      }
      function setupQuizQuestionAudio(url) {
        _quizReplaysLeft = 3;
        // 出題時に1回自動再生（カウント外）
        playQuizQuestionAudio(url);
        // ボタンはDOM挿入後に紐付け（同じTickでOK、innerHTMLは同期）
        setTimeout(() => {
          const btn = document.getElementById('quiz-audio-play-btn');
          if (!btn) return;
          updateReplayBtnLabel();
          btn.onclick = () => {
            if (_quizReplaysLeft <= 0 || quizState.answered) return;
            _quizReplaysLeft--;
            playQuizQuestionAudio(url);
            updateReplayBtnLabel();
          };
        }, 0);
      }
      function updateReplayBtnLabel() {
        const btn = document.getElementById('quiz-audio-play-btn');
        if (!btn) return;
        btn.textContent = '🔊 もう一度聞く (' + _quizReplaysLeft + '/3)';
        btn.disabled = _quizReplaysLeft <= 0;
      }

      // --- Quiz arrange (Mode 5) ---
      let _arrangeState = null;
      function setupArrangeQuestion(q) {
        const words = q.voiceline.quote.split(/\s+/).filter(w => w.length > 0);
        const tokens = words.map((w, i) => ({ id: i, text: w }));
        // 並び替え順とぴったり同じ並びは避ける
        let poolOrder;
        let attempts = 0;
        do {
          poolOrder = shuffleArray(tokens.map(t => t.id));
          attempts++;
        } while (
          attempts < 8 &&
          tokens.length > 1 &&
          poolOrder.every((id, i) => id === i)
        );
        _arrangeState = {
          correctOrder: tokens.map(t => t.id),
          tokens,
          pool: poolOrder,
          answer: [],
        };
        renderArrangeUI();
      }
      function renderArrangeUI() {
        const answerEl = document.getElementById('quiz-arrange-answer');
        const poolEl = document.getElementById('quiz-arrange-pool');
        const submitBtn = document.getElementById('quiz-arrange-submit');
        if (!answerEl || !poolEl || !submitBtn) return;

        if (_arrangeState.answer.length === 0) {
          answerEl.innerHTML = '<span class="quiz-arrange-placeholder">↓ タップした単語がここに並びます ↓</span>';
        } else {
          answerEl.innerHTML = _arrangeState.answer.map(id => {
            const tok = _arrangeState.tokens.find(t => t.id === id);
            return '<button class="quiz-arrange-token quiz-arrange-token-answer" data-id="' + id + '" data-source="answer">' + escapeHtml(tok.text) + '</button>';
          }).join('');
        }
        poolEl.innerHTML = _arrangeState.pool.length === 0
          ? '<span class="quiz-arrange-placeholder" style="opacity:0.5;">（プールは空）</span>'
          : _arrangeState.pool.map(id => {
              const tok = _arrangeState.tokens.find(t => t.id === id);
              return '<button class="quiz-arrange-token quiz-arrange-token-pool" data-id="' + id + '" data-source="pool">' + escapeHtml(tok.text) + '</button>';
            }).join('');

        const ready = _arrangeState.pool.length === 0 && _arrangeState.answer.length === _arrangeState.tokens.length;
        submitBtn.disabled = !ready;

        document.querySelectorAll('#quiz-arrange-area .quiz-arrange-token').forEach(btn => {
          btn.onclick = () => {
            if (quizState.answered) return;
            const id = parseInt(btn.dataset.id);
            const source = btn.dataset.source;
            if (source === 'pool') {
              _arrangeState.pool = _arrangeState.pool.filter(x => x !== id);
              _arrangeState.answer.push(id);
            } else {
              _arrangeState.answer = _arrangeState.answer.filter(x => x !== id);
              _arrangeState.pool.push(id);
            }
            renderArrangeUI();
          };
        });
      }
      function submitArrangeAnswer() {
        if (quizState.answered || !_arrangeState) return;
        const correct = _arrangeState.correctOrder;
        const user = _arrangeState.answer;
        const isCorrect = user.length === correct.length && user.every((id, i) => id === correct[i]);
        document.querySelectorAll('#quiz-arrange-answer .quiz-arrange-token').forEach((btn, i) => {
          btn.disabled = true;
          if (user[i] === correct[i]) btn.classList.add('correct');
          else btn.classList.add('incorrect');
        });
        document.querySelectorAll('#quiz-arrange-pool .quiz-arrange-token').forEach(btn => { btn.disabled = true; });
        document.getElementById('quiz-arrange-submit').disabled = true;
        document.getElementById('quiz-arrange-reset').disabled = true;
        answerQuestion(null, isCorrect);
      }
      function resetArrangeAnswer() {
        if (quizState.answered || !_arrangeState) return;
        _arrangeState.pool = shuffleArray(_arrangeState.tokens.map(t => t.id));
        _arrangeState.answer = [];
        renderArrangeUI();
      }

      // --- Wire up event listeners ---
      function initQuizEvents() {
        document.querySelectorAll('.quiz-mode-card').forEach(card => {
          card.addEventListener('click', () => {
            if (card.dataset.status === 'coming-soon') {
              showQuizToast('このモードは近日公開です。お楽しみに！');
              return;
            }
            showQuizSettings(card.dataset.mode);
          });
        });
        document.querySelectorAll('input[name="quiz-scope"]').forEach(r => {
          r.addEventListener('change', () => {
            document.getElementById('quiz-scope-deck-select').style.display =
              (r.value === 'deck' && r.checked) ? 'block' : 'none';
          });
        });
        ['quiz-question-count', 'quiz-timer', 'quiz-difficulty'].forEach(groupId => {
          document.querySelectorAll('#' + groupId + ' .quiz-pill').forEach(b => {
            b.addEventListener('click', () => {
              if (b.disabled) return;
              document.querySelectorAll('#' + groupId + ' .quiz-pill').forEach(x => x.classList.remove('active'));
              b.classList.add('active');
            });
          });
        });
        document.getElementById('quiz-settings-back').onclick = () => showQuizHome();
        document.getElementById('quiz-start-btn').onclick = () => startQuiz();
        document.getElementById('quiz-next-btn').onclick = () => nextQuestion();
        document.getElementById('quiz-arrange-submit').onclick = () => submitArrangeAnswer();
        document.getElementById('quiz-arrange-reset').onclick = () => resetArrangeAnswer();
        document.getElementById('quiz-play-quit').onclick = () => {
          if (confirm('クイズを中断しますか？スコアは保存されません。')) {
            stopQuizTimer();
            stopQuizQuestionAudio();
            showQuizHome();
          }
        };
      }
