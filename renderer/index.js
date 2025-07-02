window.addEventListener('DOMContentLoaded', () => {
  const jpInput = document.getElementById('jpInput');
  const enInput = document.getElementById('enInput');
  const searchBtn = document.getElementById('searchBtn');
  const translateBtn = document.getElementById('translateBtn');
  const applyTranslationBtn = document.getElementById('applyTranslationBtn');
  const webview = document.getElementById('danbooruView');
  const backBtn = document.getElementById('backBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const addressDisplay = document.getElementById('addressDisplay');
  const randomPostBtn = document.getElementById('randomPostBtn');
  const sidePanel = document.getElementById('sidePanel');
  const resizer = document.getElementById('resizer');
  const danbooruContainer = document.getElementById('danbooruContainer');
  const tagStock = document.getElementById('tagStock');
  const selectAllBtn = document.getElementById('selectAllBtn');
  const deselectAllBtn = document.getElementById('deselectAllBtn');
  const favoritesList = document.getElementById('favoritesList');
  const favoritesPanel = document.getElementById('favoritesPanel');
  const categoryFilters = document.getElementById('categoryFilters');
  const promptOutput = document.getElementById('promptOutput');
  const copyPromptBtn = document.getElementById('copyPromptBtn');
  const savePromptBtn = document.getElementById('savePromptBtn');
  const savedPromptList = document.getElementById('savedPromptList');
  const titleModal = document.getElementById('titleModal');
  const titleInput = document.getElementById('titleInput');
  const titleOk = document.getElementById('titleOk');
  const titleCancel = document.getElementById('titleCancel');


  const savedWidth = parseInt(localStorage.getItem('sidePanelWidth'), 10);
  if (savedWidth) {
    sidePanel.style.width = savedWidth + 'px';
  }

  const favOpenState = localStorage.getItem('favoritesPanelOpen');
  if (favoritesPanel) {
    if (favOpenState === 'false') {
      favoritesPanel.open = false;
    } else if (favOpenState === 'true') {
      favoritesPanel.open = true;
    }
    favoritesPanel.addEventListener('toggle', () => {
      localStorage.setItem('favoritesPanelOpen', favoritesPanel.open ? 'true' : 'false');
    });
  }

  const filterState = JSON.parse(localStorage.getItem('tagFilterState') || '{}');
  if (categoryFilters) {
    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const type = cb.dataset.type || '';
      if (Object.prototype.hasOwnProperty.call(filterState, type)) {
        cb.checked = filterState[type];
      }
    });
    applyFilters();
  }

  webview.addEventListener('dom-ready', () => {
    if (window.electronAPI && window.electronAPI.registerContextMenu) {
      const id = webview.getWebContentsId();
      window.electronAPI.registerContextMenu(id);
    }
  });

  function updateAddress(url) {
    if (addressDisplay) {
      addressDisplay.textContent = url || webview.getURL();
    }
  }

  // Load simple Japanese-to-English tag dictionary from the project root
  let tagDict = {};
  fetch('../dictionary.json')
    .then(res => res.json())
    .then(data => {
      tagDict = data || {};
      translateInput();
    })
    .catch(() => {});

  function translateInput() {
    const words = jpInput.value.split(/[、,\s]+/);
    const translated = words.map(w => tagDict[w] || w).join(' ');
    enInput.value = translated;
  }

  // Auto-translate Japanese keywords to English tags when typing
  jpInput.addEventListener('input', translateInput);

  backBtn.addEventListener('click', () => {
    if (webview.canGoBack()) webview.goBack();
  });

  forwardBtn.addEventListener('click', () => {
    if (webview.canGoForward()) webview.goForward();
  });

  addressDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(addressDisplay.textContent);
  });

  randomPostBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('https://danbooru.donmai.us/posts.json?limit=1');
      const data = await res.json();
      if (data && data[0] && data[0].id) {
        const latestId = data[0].id;
        const randId = latestId - Math.floor(Math.random() * 5000);
        const url = `https://danbooru.donmai.us/posts/${randId}`;
        webview.loadURL(url);
        updateAddress(url);
      }
    } catch (e) {
      console.error(e);
    }
  });

  // Map of tag name -> { count, type }
  const selectedTags = new Map();
  let favorites = new Map();

  async function loadFavorites() {
    try {
      if (window.electronAPI && window.electronAPI.loadFavorites) {
        const data = await window.electronAPI.loadFavorites();
        favorites = new Map(
          Array.isArray(data[0])
            ? data.map(([name, type]) => [name, (type || 'general').toLowerCase().trim()])
            : data.map(name => [name, 'general'])
        );
      } else {
        const favData = JSON.parse(localStorage.getItem('favoriteTags') || '[]');
        favorites = new Map(
          Array.isArray(favData[0])
            ? favData.map(([name, type]) => [name, (type || 'general').toLowerCase().trim()])
            : favData.map(name => [name, 'general'])
        );
      }
    } catch {
      favorites = new Map();
    }
  }

  function saveFavorites() {
    if (window.electronAPI && window.electronAPI.saveFavorites) {
      window.electronAPI.saveFavorites(Array.from(favorites.entries()));
    } else {
      localStorage.setItem('favoriteTags', JSON.stringify(Array.from(favorites.entries())));
    }
  }

  function renderFavoritesList() {
    if (!favoritesList) return;
    favoritesList.innerHTML = '';
    favorites.forEach((type, name) => {
      const div = document.createElement('div');
      div.className = 'favorite-item';
      div.dataset.type = type;
      const star = document.createElement('span');
      star.className = 'favorite active';
      star.textContent = '★';
      star.addEventListener('click', () => {
        favorites.delete(name);
        saveFavorites();
        fetchTags();
        renderFavoritesList();
      });
      const label = document.createElement('label');
      label.textContent = name;
      label.addEventListener('click', () => {
        const tag = name.replace(/\s+/g, '_');
        const url = `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(tag)}`;
        webview.loadURL(url);
        updateAddress(url);
      });
      div.appendChild(star);
      div.appendChild(label);
      favoritesList.appendChild(div);
    });
  }

  // initial render of favorites from storage
  renderFavoritesList();

  function updatePromptFromChecks() {
    const text = Array.from(selectedTags.keys()).join(', ');
    promptOutput.value = text;
  }

  function applyFilters() {
    if (!categoryFilters) return;
    const activeTypes = new Set();
    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const type = (cb.dataset.type || '').toLowerCase();
      if (cb.checked) {
        activeTypes.add(type);
      }
    });

    const stateObj = {};
    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const type = cb.dataset.type || '';
      stateObj[type] = cb.checked;
    });
    localStorage.setItem('tagFilterState', JSON.stringify(stateObj));

    tagStock.querySelectorAll('.tag-item').forEach(div => {
      const type = (div.dataset.type || 'general').toLowerCase();
      div.style.display = activeTypes.has(type) ? '' : 'none';
    });
  }

  function loadPromptTags(prompt) {
    selectedTags.clear();
    prompt.split(',').forEach(t => {
      const tag = t.trim();
      if (tag) {
        selectedTags.set(tag, { count: '0', type: 'general' });
      }
    });
    updatePromptFromChecks();
    fetchTags();
  }

  async function refreshSavedPromptList() {
    savedPromptList.innerHTML = '';
    if (!window.electronAPI || !window.electronAPI.loadPrompts) return;
    const list = await window.electronAPI.loadPrompts();
    list.forEach(item => {
      const li = document.createElement('li');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name + ' ';
      li.appendChild(nameSpan);

      const copyBtn = document.createElement('button');
      copyBtn.textContent = '📋';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(item.prompt);
      });
      li.appendChild(copyBtn);

      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'ロード';
      loadBtn.addEventListener('click', () => {
        loadPromptTags(item.prompt);
      });
      li.appendChild(loadBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑';
      delBtn.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.deletePrompt) {
          await window.electronAPI.deletePrompt(item.name);
          refreshSavedPromptList();
        }
      });
      li.appendChild(delBtn);

      savedPromptList.appendChild(li);
    });
  }

  refreshSavedPromptList();

  loadFavorites().then(() => {
    renderFavoritesList();
  });

  if (categoryFilters) {
    categoryFilters.addEventListener('change', applyFilters);
  }

  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', () => {
      Array.from(tagStock.querySelectorAll('input[type="checkbox"]:not(:checked)')).forEach(cb => {
        cb.checked = true;
        selectedTags.set(cb.dataset.tag, {
          count: cb.dataset.count || '0',
          type: cb.dataset.type || 'general'
        });
        cb.parentElement.classList.add('checked');
      });
      updatePromptFromChecks();
    });
  }

  if (deselectAllBtn) {
    deselectAllBtn.addEventListener('click', () => {
      Array.from(tagStock.querySelectorAll('input[type="checkbox"]:checked')).forEach(cb => {
        cb.checked = false;
        selectedTags.delete(cb.dataset.tag);
        cb.parentElement.classList.remove('checked');
      });
      updatePromptFromChecks();
    });
  }

  // Search Danbooru with translated tags
  searchBtn.addEventListener('click', () => {
    const tags = enInput.value.trim().replace(/\s+/g, '+');
    const url = `https://danbooru.donmai.us/posts?tags=${tags}`;
    webview.loadURL(url);
    updateAddress(url);
  });

  translateBtn.addEventListener('click', () => {
    const jp = jpInput.value.trim();
    if (!jp) return;
    const encoded = encodeURIComponent(jp);
    const url = `https://translate.google.com/?sl=ja&tl=en&text=${encoded}&op=translate`;

    // Request main process to open translation window
    if (window.electronAPI && window.electronAPI.openTranslate) {
      window.electronAPI.openTranslate(url);
    }
  });

  applyTranslationBtn.addEventListener('click', async () => {
    if (window.electronAPI && window.electronAPI.getTranslation) {
      const result = await window.electronAPI.getTranslation();
      if (result) {
        const sanitized = result.trim().replace(/\s+/g, '_');
        enInput.value = sanitized;
        const url = `https://danbooru.donmai.us/posts?tags=${sanitized}`;
        webview.loadURL(url);
        updateAddress(url);
        if (window.electronAPI && window.electronAPI.addDictionaryEntry) {
          const jp = jpInput.value.trim();
          if (jp) {
            window.electronAPI.addDictionaryEntry(jp, sanitized);
            tagDict[jp] = sanitized;
          }
        }
      }
    }
  });

  async function fetchTags() {
    const tags = await webview.executeJavaScript(`
      (async () => {
        await new Promise(r => setTimeout(r, 1000));
        const tagElements = Array.from(document.querySelectorAll('li[class*="tag-type-"]'));
        // Map numeric tag categories used by Danbooru to names
        const map = {
          '0': 'general',
          '1': 'artist',
          '3': 'copyright',
          '4': 'character',
          '5': 'meta'
        };
        return tagElements.map(el => {
          const nameEl = el.querySelector('a.search-tag');
          const countEl = el.querySelector('.post-count');
          const cls = Array.from(el.classList).find(c => c.startsWith('tag-type-')) || '';
          const raw = cls.replace('tag-type-', '');
          return {
            name: nameEl ? nameEl.textContent.trim() : '',
            count: countEl ? countEl.textContent.replace(/[, ]/g, '') : '0',
            type: (map[raw] || raw).toLowerCase()
          };
        });
      })();
    `).catch(() => []);

    // Merge current selected tags with newly scraped tags
    const combined = [];
    const seen = new Set();
    selectedTags.forEach((data, name) => {
      combined.push({ name, count: data.count, type: data.type || 'general' });
      seen.add(name);
    });
    tags.forEach(t => {
      if (!t.name) return;
      if (selectedTags.has(t.name)) {
        selectedTags.set(t.name, { count: t.count, type: t.type });
      }
      if (!seen.has(t.name)) {
        combined.push(t);
        seen.add(t.name);
      }
    });

    // Favorites no longer add items to the main list; they appear only in the
    // separate favorites panel. The stock shows tags scraped from the page or
    // ones the user has checked previously.

    combined.sort((a, b) => a.name.localeCompare(b.name));

    tagStock.innerHTML = '';
    combined.forEach(t => {
      const div = document.createElement('div');
      div.className = 'tag-item';
      const tagType = (t.type || 'general').toLowerCase().trim();
      div.dataset.type = tagType;
      div.dataset.favorite = favorites.has(t.name) ? 'true' : 'false';
      const star = document.createElement('span');
      star.className = 'favorite' + (favorites.has(t.name) ? ' active' : '');
      star.textContent = '★';
      star.addEventListener('click', () => {
        if (favorites.has(t.name)) {
          favorites.delete(t.name);
          star.classList.remove('active');
          div.dataset.favorite = 'false';
        } else {
          favorites.set(t.name, tagType);
          star.classList.add('active');
          div.dataset.favorite = 'true';
        }
        saveFavorites();
        fetchTags();
        renderFavoritesList();
      });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.tag = t.name;
      cb.dataset.count = t.count;
      cb.dataset.type = tagType;
      cb.checked = selectedTags.has(t.name);
      if (cb.checked) div.classList.add('checked');
      cb.addEventListener('change', () => {
        if (cb.checked) {
          selectedTags.set(t.name, { count: t.count, type: tagType });
          div.classList.add('checked');
        } else {
          selectedTags.delete(t.name);
          div.classList.remove('checked');
        }
        updatePromptFromChecks();
      });

      const label = document.createElement('label');
      const stored = selectedTags.get(t.name);
      const cnt = t.count || (stored && stored.count) || '0';
      label.textContent = `${t.name} (${cnt})`;
      div.appendChild(star);
      div.appendChild(cb);
      div.appendChild(label);
      label.addEventListener('click', () => {
        const tag = t.name.replace(/\s+/g, '_');
        const url = `https://danbooru.donmai.us/posts?tags=${encodeURIComponent(tag)}`;
        webview.loadURL(url);
        updateAddress(url);
      });
      tagStock.appendChild(div);
    });
    updatePromptFromChecks();
    applyFilters();
    renderFavoritesList();
  }

  // Fetch tags whenever the webview finishes loading or navigates
  const loadEvents = ['dom-ready', 'did-finish-load', 'did-navigate-in-page', 'did-navigate', 'did-stop-loading'];
  loadEvents.forEach(ev => {
    webview.addEventListener(ev, () => {
      fetchTags();
      updateAddress();
    });
  });

  // Try to load tags and address for the initial page
  setTimeout(() => {
    fetchTags();
    updateAddress();
  }, 1000);

  copyPromptBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(promptOutput.value);
  });

  savePromptBtn.addEventListener('click', () => {
    titleInput.value = '';
    titleModal.style.display = 'flex';
    titleInput.focus();
  });

  titleOk.addEventListener('click', async () => {
    const name = titleInput.value.trim();
    if (!name) return;
    titleModal.style.display = 'none';
    if (window.electronAPI && window.electronAPI.savePrompt) {
      await window.electronAPI.savePrompt(name, promptOutput.value);
      refreshSavedPromptList();
    }
  });

  titleCancel.addEventListener('click', () => {
    titleModal.style.display = 'none';
  });

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = sidePanel.offsetWidth;
    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    let newWidth = startWidth - dx;
    newWidth = Math.min(Math.max(newWidth, 150), 800);
    sidePanel.style.width = newWidth + 'px';
  }

  function onMouseUp() {
    if (!isResizing) return;
    isResizing = false;
    document.body.style.cursor = '';
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    localStorage.setItem('sidePanelWidth', parseInt(sidePanel.style.width, 10));
  }
});
