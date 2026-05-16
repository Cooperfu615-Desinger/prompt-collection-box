// ===== State =====
let prompts = [];
let editingId = null;
let deleteId = null;
let modalVariants = []; // Each: { tabName, prompt, imageUrl, _pendingFile }
let activeModalTabIdx = 0;
let currentUser = null;
let initialFormState = null;
let currentSortMode = 'updatedAt';
let modalTags = []; // Current tags in modal editor
let selectedFilterTags = []; // Active filter tags on main screen
let customTags = {}; // Custom tags from Firestore, same structure as FIXED_TAG_POOL
let unsubscribePrompts = null;
let unsubscribeCustomTags = null;

// ===== DOM Elements =====
const elements = {
    // Auth Elements
    loginOverlay: document.getElementById('loginOverlay'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),
    loginError: document.getElementById('loginError'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Existing Elements
    filterBtn: document.getElementById('filterBtn'),
    filterSidebar: document.getElementById('filterSidebar'),
    filterCategoriesContainer: document.getElementById('filterCategoriesContainer'),
    clearFilterBtn: document.getElementById('clearFilterBtn'),
    addBtn: document.getElementById('addBtn'),
    cardsContainer: document.getElementById('cardsContainer'),
    emptyState: document.getElementById('emptyState'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalClose: document.getElementById('modalClose'),
    promptForm: document.getElementById('promptForm'),
    promptId: document.getElementById('promptId'),
    promptTitle: document.getElementById('promptTitle'),
    modalTagChips: document.getElementById('modalTagChips'),
    openTagPickerBtn: document.getElementById('openTagPickerBtn'),
    tagPickerModalOverlay: document.getElementById('tagPickerModalOverlay'),
    closeTagPickerBtn: document.getElementById('closeTagPickerBtn'),
    tagPickerContent: document.getElementById('tagPickerContent'),
    tagPickerDoneBtn: document.getElementById('tagPickerDoneBtn'),
    modalTabsList: document.getElementById('modalTabsList'),
    modalTabsPanels: document.getElementById('modalTabsPanels'),
    addTabBtn: document.getElementById('addTabBtn'),
    deleteTabBtn: document.getElementById('deleteTabBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    deleteModalOverlay: document.getElementById('deleteModalOverlay'),
    deletePromptId: document.getElementById('deletePromptId'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModalOverlay: document.getElementById('settingsModalOverlay'),
    settingsModalClose: document.getElementById('settingsModalClose'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    imageModelSelect: document.getElementById('imageModelSelect'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    aiGenerateBtn: document.getElementById('aiGenerateBtn'),
    generatePreviewBtn: document.getElementById('generatePreviewBtn'),
    importBtn: document.getElementById('importBtn'),
    importFileInput: document.getElementById('importFileInput'),
    backupBtn: document.getElementById('backupBtn'),
    sortSelect: document.getElementById('sortSelect')
};

function handlePromptsLoaded(loadedPrompts) {
    prompts = loadedPrompts;
    console.log(`Loaded ${prompts.length} prompts from Firestore.`);
    populateTagFilter();
    renderCards();
}

function handlePromptsError(error) {
    console.error("Firestore Error (Snapshot):", error);
    showToast("無法載入資料，請檢查網路連線");
}

function handleCustomTagsLoaded(loadedCustomTags) {
    customTags = loadedCustomTags;
    console.log('Custom tags loaded:', customTags);
    populateTagFilter();
}

function handleCustomTagsError(error) {
    console.error('Custom tags subscription error:', error);
}

function stopRealtimeSubscriptions() {
    if (typeof unsubscribePrompts === 'function') {
        unsubscribePrompts();
        unsubscribePrompts = null;
    }
    if (typeof unsubscribeCustomTags === 'function') {
        unsubscribeCustomTags();
        unsubscribeCustomTags = null;
    }
}

function startRealtimeSubscriptions() {
    stopRealtimeSubscriptions();
    unsubscribePrompts = subscribeToPrompts(handlePromptsLoaded, handlePromptsError);
    unsubscribeCustomTags = subscribeToCustomTags(handleCustomTagsLoaded, handleCustomTagsError);
}

async function migrateLocalStorage() {
    try {
        const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!localData) return;
        showToast("正在遷移舊資料至雲端...");
        console.log("Migrating local prompts...");
        const count = await migrateLocalStoragePrompts();
        if (count > 0) {
            console.log("Migration complete.");
            showToast(`成功遷移 ${count} 筆咒語！`);
        }
    } catch (e) {
        console.error("Migration failed:", e);
        showToast("資料遷移失敗，請聯繫管理員");
    }
}

// ===== API Key Functions =====
function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveApiKey(key) {
    const trimmedKey = key ? key.trim() : '';
    if (trimmedKey) {
        localStorage.setItem(API_KEY_STORAGE, trimmedKey);
    } else {
        localStorage.removeItem(API_KEY_STORAGE);
    }
    return true;
}

function getImageModel() {
    const storedModel = localStorage.getItem(IMAGE_MODEL_STORAGE);
    return GEMINI_IMAGE_MODELS.includes(storedModel) ? storedModel : DEFAULT_GEMINI_IMAGE_MODEL;
}

function saveImageModel(model) {
    const selectedModel = GEMINI_IMAGE_MODELS.includes(model) ? model : DEFAULT_GEMINI_IMAGE_MODEL;
    localStorage.setItem(IMAGE_MODEL_STORAGE, selectedModel);
    return selectedModel;
}

// ===== Utility Functions =====
function parseTags(tagString) {
    if (!tagString || !tagString.trim()) return [];
    return tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
}

function formatTags(tags) {
    return tags ? tags.join(', ') : '';
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== Toast Notification =====
function showToast(message = '已複製到剪貼簿！') {
    elements.toastMessage.textContent = message;
    elements.toast.classList.add('visible');
    setTimeout(() => {
        elements.toast.classList.remove('visible');
    }, 2500);
}

// ===== Modal Functions (Variants Tab Logic) =====
function renderModalTabs() {
    elements.modalTabsList.innerHTML = '';
    elements.modalTabsPanels.innerHTML = '';

    modalVariants.forEach((variant, index) => {
        // --- Tab Button ---
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tab-btn ${index === activeModalTabIdx ? 'active' : ''}`;
        btn.draggable = true;
        btn.dataset.idx = index;
        btn.textContent = variant.tabName || `Tab ${index + 1}`;
        btn.onclick = () => switchModalTab(index);
        btn.ondragstart = (e) => handleModalTabDragStart(e, index);
        btn.ondragover = handleModalTabDragOver;
        btn.ondragleave = handleModalTabDragLeave;
        btn.ondrop = (e) => handleModalTabDrop(e, index);
        btn.ondragend = handleModalTabDragEnd;

        elements.modalTabsList.appendChild(btn);

        // --- Tab Panel ---
        const panel = document.createElement('div');
        panel.className = `tab-panel ${index === activeModalTabIdx ? 'active' : ''}`;

        // Tab Name Input
        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'version-label-input';
        labelInput.placeholder = '頁籤名稱 (例如: ChatGPT, Midjourney)';
        labelInput.value = variant.tabName;
        labelInput.oninput = (e) => {
            variant.tabName = e.target.value;
            btn.childNodes[0].textContent = e.target.value || `Tab ${index + 1}`;
        };
        panel.appendChild(labelInput);

        // Prompt Textarea
        const textarea = document.createElement('textarea');
        textarea.required = (index === 0);
        textarea.placeholder = '請輸入你的 Prompt 內容...';
        textarea.value = variant.prompt;
        textarea.id = `modal-variant-prompt-${index}`;
        textarea.oninput = (e) => {
            variant.prompt = e.target.value;
        };
        panel.appendChild(textarea);

        // --- Per-tab Image Upload Section ---
        const imgSection = document.createElement('div');
        imgSection.className = 'variant-image-section';

        const imgLabel = document.createElement('label');
        imgLabel.className = 'variant-image-label';
        imgLabel.textContent = '📷 此頁籤的圖片';
        imgSection.appendChild(imgLabel);

        const imgRow = document.createElement('div');
        imgRow.className = 'variant-image-row';

        // File input
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.className = 'file-input variant-file-input';
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                variant._pendingFile = file;
                const objectUrl = URL.createObjectURL(file);
                updatePreview(objectUrl);
                // Clear URL input if file selected
                urlInput.value = '';
                variant.imageUrl = ''; // Will be replaced after upload
            }
        };
        imgRow.appendChild(fileInput);

        // URL input
        const urlInput = document.createElement('input');
        urlInput.type = 'url';
        urlInput.className = 'variant-url-input';
        urlInput.placeholder = '或貼上圖片連結...';
        urlInput.value = variant.imageUrl || '';
        urlInput.oninput = (e) => {
            variant.imageUrl = e.target.value.trim();
            variant._pendingFile = null;
            fileInput.value = '';
            if (index === activeModalTabIdx) {
                updatePreview(variant.imageUrl);
            }
        };
        imgRow.appendChild(urlInput);

        imgSection.appendChild(imgRow);

        // Show current image thumbnail if exists
        if (variant.imageUrl) {
            const thumb = document.createElement('div');
            thumb.className = 'variant-thumb';
            thumb.innerHTML = `<img src="${escapeHtml(variant.imageUrl)}" alt="thumb" onerror="this.parentElement.style.display='none'">`;
            imgSection.appendChild(thumb);
        }

        panel.appendChild(imgSection);

        // --- Version Control Buttons ---
        const btnContainer = document.createElement('div');
        btnContainer.className = 'version-controls';

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'version-control-btn copy-btn-version';
        copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            複製
        `;
        copyBtn.onclick = () => {
            copyToClipboard(variant.prompt);
        };
        btnContainer.appendChild(copyBtn);

        panel.appendChild(btnContainer);

        elements.modalTabsPanels.appendChild(panel);
    });

    elements.addTabBtn.disabled = modalVariants.length >= MAX_VARIANTS;
    elements.deleteTabBtn.disabled = modalVariants.length <= 1;

    // Update left preview to current tab's image
    const currentVariant = modalVariants[activeModalTabIdx];
    if (currentVariant) {
        if (currentVariant._pendingFile) {
            updatePreview(URL.createObjectURL(currentVariant._pendingFile));
        } else {
            updatePreview(currentVariant.imageUrl || '');
        }
    }
}

function switchModalTab(index) {
    activeModalTabIdx = index;
    renderModalTabs();
}

function moveModalTab(fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    const activeVariant = modalVariants[activeModalTabIdx];
    const [movedVariant] = modalVariants.splice(fromIndex, 1);
    modalVariants.splice(toIndex, 0, movedVariant);
    activeModalTabIdx = modalVariants.indexOf(activeVariant);
    renderModalTabs();
}

function handleModalTabDragStart(e, index) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    e.currentTarget.classList.add('dragging');
}

function handleModalTabDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleModalTabDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleModalTabDrop(e, toIndex) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    clearModalTabDragClasses();
    if (Number.isInteger(fromIndex)) {
        moveModalTab(fromIndex, toIndex);
    }
}

function handleModalTabDragEnd() {
    clearModalTabDragClasses();
}

function clearModalTabDragClasses() {
    elements.modalTabsList.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('dragging', 'drag-over');
    });
}

function addModalTab() {
    if (modalVariants.length >= MAX_VARIANTS) return;
    const nextNum = modalVariants.length + 1;
    modalVariants.push({ tabName: `Tab ${nextNum}`, prompt: '', imageUrl: null, _pendingFile: null });
    activeModalTabIdx = modalVariants.length - 1;
    renderModalTabs();
}

function deleteActiveModalTab() {
    if (modalVariants.length <= 1) return;
    modalVariants.splice(activeModalTabIdx, 1);
    if (activeModalTabIdx >= modalVariants.length) {
        activeModalTabIdx = modalVariants.length - 1;
    }
    renderModalTabs();
}

function openModal(isEdit = false, prompt = null) {
    editingId = isEdit && prompt ? prompt.id : null;
    elements.modalTitle.textContent = isEdit ? '編輯咒語' : '新增咒語';
    elements.promptForm.reset();
    elements.promptId.value = '';

    // Clear chips
    modalTags = [];
    renderModalTagChips();

    if (isEdit && prompt) {
        elements.promptTitle.value = prompt.title;
        modalTags = [...(prompt.tags || [])];
        modalVariants = JSON.parse(JSON.stringify(prompt.variants)).map(v => ({
            ...v,
            _pendingFile: null
        }));
    } else {
        modalVariants = [{ tabName: '通用', prompt: '', imageUrl: null, _pendingFile: null }];
    }

    activeModalTabIdx = 0;
    renderModalTabs();
    renderModalTagChips(); // Re-render after potentially populating modalTags

    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => elements.promptTitle.focus(), 100);

    // Capture initial state for dirty check
    setTimeout(() => {
        initialFormState = getFormState();
    }, 50);
}

function closeModal(force = false) {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
    modalVariants = [];
    modalTags = [];
    activeModalTabIdx = 0;
    initialFormState = null;
    updatePreview('');
    elements.modalTagChips.innerHTML = '';
}

function openDeleteModal(id) {
    deleteId = id;
    elements.deleteModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
    elements.deleteModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    deleteId = null;
}

// ===== Settings Modal Functions =====
function openSettingsModal() {
    const existingKey = getApiKey();
    elements.apiKeyInput.value = existingKey;
    elements.imageModelSelect.value = getImageModel();
    elements.settingsModalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => elements.apiKeyInput.focus(), 100);
}

function closeSettingsModal() {
    elements.settingsModalOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

function handleSaveApiKey() {
    const key = elements.apiKeyInput.value;
    const imageModel = elements.imageModelSelect.value;
    saveApiKey(key);
    saveImageModel(imageModel);
    showToast(key ? 'API Key 與圖片模型已儲存！' : 'API Key 已清除，圖片模型已儲存！');
    closeSettingsModal();
}

// ===== Tag Pool Helpers =====
function getFullTagPool() {
    const pool = JSON.parse(JSON.stringify(FIXED_TAG_POOL));
    for (const [cat, tags] of Object.entries(customTags)) {
        if (!pool[cat]) pool[cat] = [];
        tags.forEach(t => { if (!pool[cat].includes(t)) pool[cat].push(t); });
    }
    return pool;
}

function getTagCategory(tagName) {
    const pool = getFullTagPool();
    for (const [cat, tags] of Object.entries(pool)) {
        if (tags.includes(tagName)) return cat;
    }
    return null;
}

function getAllTagNames() {
    const pool = getFullTagPool();
    return Object.values(pool).flat();
}

// ===== AI Title + Tag Generation =====
function setGenerateBtnLoading(isLoading) {
    const btn = elements.aiGenerateBtn;
    const textSpan = btn.querySelector('.ai-btn-text');
    if (isLoading) {
        btn.classList.add('loading');
        textSpan.textContent = '分析中...';
    } else {
        btn.classList.remove('loading');
        textSpan.textContent = '自動生成';
    }
}

async function generateTitleWithAI() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('請先至設定輸入 Gemini API Key');
        openSettingsModal();
        return;
    }

    // Collect all variant content
    const allContent = modalVariants
        .map((v, i) => `【${v.tabName || 'Tab ' + (i + 1)}】\n${v.prompt}`)
        .filter(s => s.trim())
        .join('\n\n');

    if (!allContent.trim()) {
        showToast('請先輸入至少一個頁籤的內容');
        return;
    }

    setGenerateBtnLoading(true);

    // Build the full tag pool for AI prompt
    const pool = getFullTagPool();
    const tagListText = Object.entries(pool)
        .map(([cat, tags]) => `  - ${cat}: ${tags.join(', ')}`)
        .join('\n');

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `你是一個 Prompt 分析專家。請分析以下所有頁籤的 Prompt 內容，並回傳一個 JSON 物件。

規則：
1. "title"：繁體中文精簡摘要標題，不超過 50 字，不含引號。
2. "tags"：一個字串陣列。你必須**嚴格**從以下固定標籤清單中挑選與 Prompt 內容相符的標籤。
   **絕對禁止**生成清單以外的任何標籤。若某分類無相符項，則跳過該分類。

固定標籤清單（按分類）：
${tagListText}

注意：只回傳純 JSON，不要加任何 markdown 格式或文字解釋。

以下是所有頁籤的 Prompt 內容：
${allContent}`
                    }]
                }]
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!rawText) throw new Error('No content generated');

        // Strip markdown code fences if present
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        const parsed = JSON.parse(rawText);

        if (parsed.title) {
            elements.promptTitle.value = parsed.title.replace(/^["'「『]|["'」』]$/g, '').trim();
        }

        if (parsed.tags && Array.isArray(parsed.tags)) {
            // Only accept tags that exist in the full tag pool
            const validTagNames = getAllTagNames();
            const filteredTags = parsed.tags.filter(t => validTagNames.includes(t.trim()));

            modalTags = Array.from(new Set(filteredTags.map(t => t.trim())));
            renderModalTagChips();
        }

        showToast('標題與標籤已生成！');
    } catch (error) {
        console.error('AI generation error:', error);
        showToast('生成失敗，請檢查 API Key 或重試');
    } finally {
        setGenerateBtnLoading(false);
    }
}

// ===== AI Image Preview Generation =====
function setPreviewGenerateLoading(isLoading) {
    const btn = elements.generatePreviewBtn;
    const textSpan = btn.querySelector('.generate-preview-text');
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
        textSpan.textContent = '生成中...';
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        textSpan.textContent = '生成預覽圖';
    }
}

async function generatePreviewImage() {
    const apiKey = getApiKey();
    if (!apiKey) {
        showToast('請先至設定輸入 Gemini API Key');
        openSettingsModal();
        return;
    }

    const currentVariant = modalVariants[activeModalTabIdx];
    const prompt = currentVariant?.prompt?.trim();
    if (!prompt) {
        showToast('請先在目前頁籤輸入 Prompt');
        return;
    }

    setPreviewGenerateLoading(true);

    try {
        const model = getImageModel();
        showToast('正在生成預覽圖...');
        const imageFile = await requestGeminiPreviewImage(prompt, apiKey, model);

        currentVariant._pendingFile = imageFile;
        currentVariant.imageUrl = '';
        updatePreview(URL.createObjectURL(imageFile));
        renderModalTabs();
        showToast('預覽圖已生成，儲存後會上傳');
    } catch (error) {
        console.error('Preview image generation error:', error);
        alert(`圖片生成失敗：${error.message}`);
    } finally {
        setPreviewGenerateLoading(false);
    }
}

// ===== Modal Tag Chips Management =====
function renderModalTagChips() {
    elements.modalTagChips.innerHTML = '';
    modalTags.forEach((tag, idx) => {
        const chip = document.createElement('span');
        const category = getTagCategory(tag);
        const colors = category ? TAG_CATEGORY_COLORS[category] : null;
        chip.className = 'tag-chip';
        if (colors) {
            chip.style.background = colors.bg;
            chip.style.borderColor = colors.border;
            chip.style.color = colors.text;
        }
        const categoryLabel = category ? `<span class="chip-cat">${category}</span>` : '';
        chip.innerHTML = `${categoryLabel}${escapeHtml(tag)}<button type="button" class="chip-remove" data-idx="${idx}">&times;</button>`;
        chip.querySelector('.chip-remove').onclick = () => {
            const index = modalTags.indexOf(tag); // Find current index as idx might be stale after re-renders
            if (index > -1) {
                modalTags.splice(index, 1);
                renderModalTagChips();
                // If the picker is open, re-render it to update styles
                if (elements.tagPickerModalOverlay.classList.contains('active')) {
                    renderTagPicker();
                }
            }
        };
        elements.modalTagChips.appendChild(chip);
    });
}

function openTagPickerModal() {
    renderTagPicker();
    elements.tagPickerModalOverlay.classList.add('active');
}

function closeTagPickerModal() {
    elements.tagPickerModalOverlay.classList.remove('active');
}

function renderTagPicker() {
    const container = elements.tagPickerContent;
    if (!container) return;
    container.innerHTML = '';

    const pool = getFullTagPool();

    for (const [category, tags] of Object.entries(pool)) {
        if (!tags || tags.length === 0) continue;

        const catDiv = document.createElement('div');
        catDiv.className = 'filter-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'filter-category-title';
        catTitle.textContent = category;
        catDiv.appendChild(catTitle);

        const tagList = document.createElement('div');
        tagList.className = 'filter-tag-list';

        tags.forEach(tag => {
            const btn = document.createElement('button');
            const isSelected = modalTags.includes(tag);
            btn.className = `filter-tag-btn ${isSelected ? 'selected' : ''}`;
            btn.textContent = tag;

            // Apply category color if selected
            const colors = TAG_CATEGORY_COLORS[category];
            if (colors && isSelected) {
                btn.style.background = colors.bg;
                btn.style.borderColor = colors.border;
                btn.style.color = colors.text;
            }

            btn.onclick = () => togglePickerTag(tag);
            tagList.appendChild(btn);
        });

        catDiv.appendChild(tagList);
        container.appendChild(catDiv);
    }
}

function togglePickerTag(tag) {
    const index = modalTags.indexOf(tag);
    if (index === -1) {
        modalTags.push(tag);
    } else {
        modalTags.splice(index, 1);
    }
    renderModalTagChips();
    // Also re-render the picker so the clicked button immediately reflects its selected state
    renderTagPicker();
}


// ===== Tag Filter Sidebar =====
function populateTagFilter() {
    const container = elements.filterCategoriesContainer;
    if (!container) return;
    container.innerHTML = '';

    // Using full tag pool which includes fixed and custom tags
    const pool = getFullTagPool();

    for (const [category, tags] of Object.entries(pool)) {
        if (!tags || tags.length === 0) continue;

        const catDiv = document.createElement('div');
        catDiv.className = 'filter-category';

        const catTitle = document.createElement('div');
        catTitle.className = 'filter-category-title';
        catTitle.textContent = category;
        catDiv.appendChild(catTitle);

        const tagList = document.createElement('div');
        tagList.className = 'filter-tag-list';

        tags.forEach(tag => {
            const btn = document.createElement('button');
            btn.className = `filter-tag-btn ${selectedFilterTags.includes(tag) ? 'selected' : ''}`;
            btn.textContent = tag;

            // Apply category color if selected
            const colors = TAG_CATEGORY_COLORS[category];
            if (colors && selectedFilterTags.includes(tag)) {
                btn.style.background = colors.bg;
                btn.style.borderColor = colors.border;
                btn.style.color = colors.text;
            }

            btn.onclick = () => toggleFilterTag(tag);
            tagList.appendChild(btn);
        });

        catDiv.appendChild(tagList);
        container.appendChild(catDiv);
    }
}

window.toggleFilterTag = function (tag) {
    const index = selectedFilterTags.indexOf(tag);
    if (index === -1) {
        selectedFilterTags.push(tag);
    } else {
        selectedFilterTags.splice(index, 1);
    }
    populateTagFilter(); // Re-render to update selected styles
    renderCards();
};

window.clearAllFilters = function () {
    selectedFilterTags = [];
    populateTagFilter();
    renderCards();
};

window.toggleFilterSidebar = function () {
    document.body.classList.toggle('filter-sidebar-open');
};

// ===== Add Tag UI Logic =====

function handleAddCustomTag() {
    const catSelect = document.getElementById('newTagCategory');
    const nameInput = document.getElementById('newTagName');
    if (!catSelect || !nameInput) return;
    const category = catSelect.value;
    const tagName = nameInput.value.trim();
    if (!category || !tagName) {
        showToast('請選擇分類並輸入標籤名稱');
        return;
    }
    addCustomTag(category, tagName);
    nameInput.value = '';
}

async function addCustomTag(category, tagName) {
    const trimmed = tagName.trim();
    if (!trimmed) return;
    const pool = getFullTagPool();
    if (pool[category] && pool[category].includes(trimmed)) {
        showToast('此標籤已存在');
        return;
    }
    try {
        await saveCustomTag(category, trimmed);
        showToast(`已新增標籤「${trimmed}」到「${category}」`);
    } catch (err) {
        console.error('Add custom tag error:', err);
        showToast('新增標籤失敗');
    }
}

async function addPrompt(data) {
    try {
        await createPrompt(data);
        showToast('咒語已新增！');
        console.log("Firestore 連線成功！(Add)");
    } catch (error) {
        console.error("Firestore Error (Add):", error);
        showToast('新增失敗！');
    }
}

async function updatePrompt(id, data) {
    try {
        await savePrompt(id, data);
        showToast('咒語已更新！');
        console.log("Firestore 連線成功！(Update)");
    } catch (error) {
        console.error("Firestore Error (Update):", error);
        showToast('更新失敗！');
    }
}

function deletePrompt(id) {
    removePrompt(id)
        .then(() => {
            showToast('咒語已刪除！');
            console.log("Firestore 連線成功！(Delete)");
        })
        .catch((error) => {
            console.error("Firestore Error (Delete):", error);
            showToast('刪除失敗！');
        });
}

// ===== Copy to Clipboard =====
async function copyToClipboard(content) {
    try {
        await navigator.clipboard.writeText(content);
        showToast('已複製到剪貼簿！');
    } catch (err) {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('已複製到剪貼簿！');
        } catch (e) {
            showToast('複製失敗，請手動複製');
        }
        document.body.removeChild(textarea);
    }
}

// ===== Search/Filter/Sort =====
function filterPrompts() {
    if (selectedFilterTags.length === 0) return prompts;
    return prompts.filter(prompt => {
        return selectedFilterTags.every(ft => (prompt.tags || []).includes(ft));
    });
}

function sortPrompts(list) {
    const sorted = [...list];
    switch (currentSortMode) {
        case 'updatedAt':
            sorted.sort((a, b) => {
                const ta = a.updatedAt || a.createdAt || '';
                const tb = b.updatedAt || b.createdAt || '';
                return tb.localeCompare(ta); // desc
            });
            break;
        case 'title':
            sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'zh-TW'));
            break;
        case 'tags':
            sorted.sort((a, b) => {
                const tagA = (a.tags && a.tags[0]) || '';
                const tagB = (b.tags && b.tags[0]) || '';
                return tagA.localeCompare(tagB, 'zh-TW');
            });
            break;
    }
    return sorted;
}

// ===== Render Functions =====
function createCardElement(prompt) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = prompt.id;

    const activeVariantIdx = 0;
    const activeVariant = prompt.variants[activeVariantIdx] || { prompt: '', imageUrl: null };

    const rawTags = prompt.tags || [];
    const tagsHtml = rawTags.length > 0
        ? `<div class="card-tags">${rawTags.map(tag => {
            const category = getTagCategory(tag);
            const colors = category ? TAG_CATEGORY_COLORS[category] : null;
            const style = colors ? `style="background:${colors.bg};border-color:${colors.border};color:${colors.text}"` : '';
            return `<span class="tag" ${style}>${escapeHtml(tag)}</span>`;
        }).join('')}</div>`
        : '';

    // Image from current variant
    const imageHtml = activeVariant.imageUrl
        ? `<div class="card-image" id="card-image-${prompt.id}"><img src="${escapeHtml(activeVariant.imageUrl)}" alt="範例圖片" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
        : `<div class="card-image" id="card-image-${prompt.id}" style="display:none"></div>`;

    let tabsHeaderHtml = '';
    if (prompt.variants.length > 1) {
        const tabsBtns = prompt.variants.map((v, idx) =>
            `<button class="tab-btn ${idx === 0 ? 'active' : ''}" 
                data-idx="${idx}" onclick="handleCardTabSwitch(this, '${prompt.id}', ${idx})">
                ${escapeHtml(v.tabName)}
             </button>`
        ).join('');
        tabsHeaderHtml = `<div class="tabs-header">${tabsBtns}</div>`;
    }

    card.innerHTML = `
        <div class="card-header">
            <h3 class="card-title">${escapeHtml(prompt.title)}</h3>
            <div class="card-actions">
                <button class="card-action-btn edit" title="編輯" data-action="edit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="card-action-btn delete" title="刪除" data-action="delete">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>
        </div >
                <div class="tabs-container">
                    ${tabsHeaderHtml}
                    <div class="card-content" id="card-content-${prompt.id}">${escapeHtml(activeVariant.prompt)}</div>
                </div>
        ${tagsHtml}
        ${imageHtml}
            <button class="copy-btn" data-action="copy" data-current-idx="0">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                複製咒語
            </button>
            `;
    return card;
}

window.handleCardTabSwitch = function (btn, promptId, idx) {
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;
    const card = btn.closest('.card');
    card.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // Update prompt text
    document.getElementById(`card-content-${promptId}`).textContent = prompt.variants[idx].prompt;

    // Update card image
    const imgContainer = document.getElementById(`card-image-${promptId}`);
    if (imgContainer) {
        const variantImg = prompt.variants[idx].imageUrl;
        if (variantImg) {
            imgContainer.innerHTML = `<img src="${escapeHtml(variantImg)}" alt="範例圖片" loading="lazy" onerror="this.parentElement.style.display='none'">`;
            imgContainer.style.display = '';
        } else {
            imgContainer.style.display = 'none';
        }
    }

    // Update copy button reference
    card.querySelector('.copy-btn').dataset.currentIdx = idx;
};

function renderCards() {
    const filteredPrompts = filterPrompts();
    const sortedPrompts = sortPrompts(filteredPrompts);
    elements.cardsContainer.innerHTML = '';

    if (sortedPrompts.length === 0) {
        elements.emptyState.classList.add('visible');
        elements.cardsContainer.style.display = 'none';
    } else {
        elements.emptyState.classList.remove('visible');
        elements.cardsContainer.style.display = 'grid';
        sortedPrompts.forEach(prompt => elements.cardsContainer.appendChild(createCardElement(prompt)));
    }
}

// ===== Event Handlers =====
function handleFormSubmit(e) {
    e.preventDefault();
    const validVariants = modalVariants.filter(v => v.prompt.trim() !== '');
    if (validVariants.length === 0) {
        showToast('請至少輸入一個頁籤的內容');
        return;
    }

    (async () => {
        showToast('儲存中...');

        // Upload pending files for each variant
        for (let i = 0; i < modalVariants.length; i++) {
            const variant = modalVariants[i];
            if (variant._pendingFile) {
                try {
                    const uploadedUrl = await uploadImage(variant._pendingFile);
                    if (uploadedUrl) {
                        variant.imageUrl = uploadedUrl;
                    }
                } catch (err) {
                    console.error(`Image upload failed for tab ${i}: `, err);
                    return; // Stop submission on upload error
                }
            }
        }

        // Strip internal _pendingFile field before saving
        const cleanVariants = modalVariants.map(v => ({
            tabName: v.tabName || '通用',
            prompt: v.prompt,
            imageUrl: v.imageUrl || null
        }));

        const data = {
            title: elements.promptTitle.value.trim(),
            variants: cleanVariants,
            tags: [...modalTags]
        };

        if (editingId) {
            await updatePrompt(editingId, data);
        } else {
            await addPrompt(data);
        }
        closeModal();
    })();
}

function handleCardAction(e) {
    if (e.target.closest('.tabs-header')) return;
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const card = actionBtn.closest('.card');
    const promptId = card?.dataset.id;
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    switch (action) {
        case 'edit': openModal(true, prompt); break;
        case 'delete': openDeleteModal(promptId); break;
        case 'copy':
            const currentIdx = parseInt(actionBtn.dataset.currentIdx || '0');
            copyToClipboard(prompt.variants[currentIdx]?.prompt || '');
            break;
    }
}

function handleConfirmDelete() {
    if (deleteId) {
        deletePrompt(deleteId);
        closeDeleteModal();
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    elements.addBtn.addEventListener('click', () => openModal());

    // Updated Close Logic with Persistence Check
    const handleCloseAttempt = () => {
        if (isFormDirty()) {
            if (confirm("您有未儲存的變更，確定要放棄並關閉嗎？")) {
                closeModal(true);
            }
        } else {
            closeModal(true);
        }
    };

    elements.modalClose.addEventListener('click', handleCloseAttempt);
    elements.cancelBtn.addEventListener('click', handleCloseAttempt);

    elements.addTabBtn.addEventListener('click', addModalTab);
    elements.deleteTabBtn.addEventListener('click', deleteActiveModalTab);

    elements.promptForm.addEventListener('submit', handleFormSubmit);
    elements.cardsContainer.addEventListener('click', handleCardAction);

    // Tag Picker Modal Events
    elements.openTagPickerBtn.addEventListener('click', openTagPickerModal);
    elements.closeTagPickerBtn.addEventListener('click', closeTagPickerModal);
    elements.tagPickerDoneBtn.addEventListener('click', closeTagPickerModal);
    elements.tagPickerModalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.tagPickerModalOverlay) closeTagPickerModal();
    });

    elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    elements.deleteModalOverlay.addEventListener('click', (e) => { if (e.target === elements.deleteModalOverlay) closeDeleteModal(); });

    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.settingsModalClose.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    elements.settingsModalOverlay.addEventListener('click', (e) => { if (e.target === elements.settingsModalOverlay) closeSettingsModal(); });

    elements.aiGenerateBtn.addEventListener('click', generateTitleWithAI);
    elements.generatePreviewBtn.addEventListener('click', generatePreviewImage);
    elements.importBtn.addEventListener('click', () => elements.importFileInput.click());
    elements.importFileInput.addEventListener('change', handleMarkdownImportChange);
    elements.backupBtn.addEventListener('click', backupAll);
    elements.sortSelect.addEventListener('change', (e) => {
        currentSortMode = e.target.value;
        renderCards();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.tagPickerModalOverlay.classList.contains('active')) closeTagPickerModal();
            else if (elements.settingsModalOverlay.classList.contains('active')) closeSettingsModal();
            else if (elements.deleteModalOverlay.classList.contains('active')) closeDeleteModal();
            else if (elements.modalOverlay.classList.contains('active')) handleCloseAttempt();
            else if (document.body.classList.contains('filter-sidebar-open')) window.toggleFilterSidebar();
        }
    });
}

// ===== Dirty State Tracking =====
function getFormState() {
    return {
        title: elements.promptTitle.value.trim(),
        tags: JSON.stringify(modalTags),
        variants: JSON.stringify(modalVariants.map(v => ({
            tabName: v.tabName,
            prompt: v.prompt,
            imageUrl: v.imageUrl
        })))
    };
}

function isFormDirty() {
    if (!initialFormState) return false;
    const currentState = getFormState();
    return JSON.stringify(currentState) !== JSON.stringify(initialFormState);
}

// ===== Image Preview Logic =====
const previewElements = {
    container: document.getElementById('previewContainer'),
    image: document.getElementById('previewImage'),
    placeholder: document.getElementById('previewPlaceholder')
};

function updatePreview(src) {
    if (!src || src.trim() === '') {
        previewElements.image.style.display = 'none';
        previewElements.image.src = '';
        previewElements.placeholder.style.display = 'flex';
    } else {
        previewElements.image.src = src;
        previewElements.image.style.display = 'block';
        previewElements.placeholder.style.display = 'none';
    }
}

// ===== Initialize App =====
async function init() {
    initEventListeners();
    initAuth();
}

// ===== Authentication Logic =====
function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("User signed in:", user.email);
            if (user.email === ALLOWED_EMAIL) {
                stopRealtimeSubscriptions();
                currentUser = user;
                elements.loginOverlay.classList.remove('active');
                elements.logoutBtn.style.display = 'flex';
                elements.loginError.style.display = 'none';

                startRealtimeSubscriptions();
                await migrateLocalStorage();
            } else {
                console.warn("Unauthorized access attempt:", user.email);
                stopRealtimeSubscriptions();
                currentUser = null;
                prompts = [];
                customTags = {};
                elements.loginError.style.display = 'flex';
                elements.loginError.querySelector('span').textContent = `權限不足：${user.email} 無法存取`;
                elements.cardsContainer.innerHTML = '';
                elements.emptyState.classList.remove('visible');
            }
        } else {
            console.log("User signed out");
            stopRealtimeSubscriptions();
            currentUser = null;
            prompts = [];
            customTags = {};
            elements.loginOverlay.classList.add('active');
            elements.logoutBtn.style.display = 'none';
            elements.loginError.style.display = 'none';
            elements.cardsContainer.innerHTML = '';
            elements.emptyState.classList.remove('visible');
        }
    });

    elements.googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Login failed:", error);
            alert("登入失敗：" + error.message);
        });
    });

    elements.logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            showToast('已安全登出');
        }).catch((error) => {
            console.error("Logout failed:", error);
        });
    });
}


document.addEventListener('DOMContentLoaded', init);
