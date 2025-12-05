// ===== Data Model =====
const STORAGE_KEY = 'prompt-collection-box';
const API_KEY_STORAGE = 'gemini-api-key';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ===== State =====
let prompts = [];
let editingId = null;
let deleteId = null;

// ===== DOM Elements =====
const elements = {
    searchInput: document.getElementById('searchInput'),
    addBtn: document.getElementById('addBtn'),
    cardsContainer: document.getElementById('cardsContainer'),
    emptyState: document.getElementById('emptyState'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalClose: document.getElementById('modalClose'),
    promptForm: document.getElementById('promptForm'),
    promptId: document.getElementById('promptId'),
    promptTitle: document.getElementById('promptTitle'),
    promptContent: document.getElementById('promptContent'),
    promptTags: document.getElementById('promptTags'),
    promptImage: document.getElementById('promptImage'),
    cancelBtn: document.getElementById('cancelBtn'),
    deleteModalOverlay: document.getElementById('deleteModalOverlay'),
    deletePromptId: document.getElementById('deletePromptId'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),
    // Settings modal elements
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModalOverlay: document.getElementById('settingsModalOverlay'),
    settingsModalClose: document.getElementById('settingsModalClose'),
    apiKeyInput: document.getElementById('apiKeyInput'),
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    // AI generate button
    aiGenerateBtn: document.getElementById('aiGenerateBtn')
};

// ===== LocalStorage Functions =====
function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function loadFromStorage() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            prompts = JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse stored data:', e);
            prompts = [];
        }
    }
}

// ===== API Key Functions =====
function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveApiKey(key) {
    if (key && key.trim()) {
        localStorage.setItem(API_KEY_STORAGE, key.trim());
        return true;
    }
    return false;
}

// ===== Utility Functions =====
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function parseTags(tagString) {
    if (!tagString || !tagString.trim()) return [];
    return tagString
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
}

function formatTags(tags) {
    return tags.join(', ');
}

function escapeHtml(text) {
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

// ===== Modal Functions =====
function openModal(isEdit = false, prompt = null) {
    editingId = isEdit && prompt ? prompt.id : null;

    elements.modalTitle.textContent = isEdit ? '編輯咒語' : '新增咒語';
    elements.promptForm.reset();

    if (isEdit && prompt) {
        elements.promptTitle.value = prompt.title;
        elements.promptContent.value = prompt.content;
        elements.promptTags.value = formatTags(prompt.tags);
        elements.promptImage.value = prompt.imageUrl || '';
    }

    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus on title input after animation
    setTimeout(() => elements.promptTitle.focus(), 100);
}

function closeModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
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
    // Load existing API key (masked display)
    const existingKey = getApiKey();
    elements.apiKeyInput.value = existingKey;

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
    if (saveApiKey(key)) {
        showToast('API Key 已儲存！');
        closeSettingsModal();
    } else {
        showToast('請輸入有效的 API Key');
    }
}

// ===== AI Title Generation =====
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

    const promptContent = elements.promptContent.value.trim();
    if (!promptContent) {
        showToast('請先輸入咒語內容');
        elements.promptContent.focus();
        return;
    }

    setGenerateBtnLoading(true);

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `請分析以下 Prompt 的內容，並生成一個繁體中文的精簡標題，限制在 50 字以內，不要包含引號或多餘解釋，直接回覆標題文字即可：\n\n${promptContent}`
                    }]
                }]
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (title) {
            // Clean up the title (remove any quotes or extra whitespace)
            const cleanTitle = title.replace(/^["'「『]|["'」』]$/g, '').trim();
            elements.promptTitle.value = cleanTitle;
            showToast('標題已生成！');
        } else {
            throw new Error('No title generated');
        }
    } catch (error) {
        console.error('AI generation error:', error);
        showToast('生成失敗，請檢查 API Key 是否正確');
    } finally {
        setGenerateBtnLoading(false);
    }
}

// ===== CRUD Operations =====
function addPrompt(data) {
    const prompt = {
        id: generateId(),
        title: data.title,
        content: data.content,
        tags: data.tags,
        imageUrl: data.imageUrl,
        createdAt: new Date().toISOString()
    };
    prompts.unshift(prompt);
    saveToStorage();
    renderCards();
}

function updatePrompt(id, data) {
    const index = prompts.findIndex(p => p.id === id);
    if (index !== -1) {
        prompts[index] = {
            ...prompts[index],
            title: data.title,
            content: data.content,
            tags: data.tags,
            imageUrl: data.imageUrl,
            updatedAt: new Date().toISOString()
        };
        saveToStorage();
        renderCards();
    }
}

function deletePrompt(id) {
    prompts = prompts.filter(p => p.id !== id);
    saveToStorage();
    renderCards();
}

// ===== Copy to Clipboard =====
async function copyToClipboard(content) {
    try {
        await navigator.clipboard.writeText(content);
        showToast('已複製到剪貼簿！');
    } catch (err) {
        // Fallback for older browsers
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

// ===== Search/Filter =====
function filterPrompts(query) {
    if (!query || !query.trim()) return prompts;

    const searchTerm = query.toLowerCase().trim();
    return prompts.filter(prompt => {
        const titleMatch = prompt.title.toLowerCase().includes(searchTerm);
        const tagMatch = prompt.tags.some(tag =>
            tag.toLowerCase().includes(searchTerm)
        );
        return titleMatch || tagMatch;
    });
}

// ===== Render Functions =====
function createCardElement(prompt) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = prompt.id;

    const tagsHtml = prompt.tags.length > 0
        ? `<div class="card-tags">
            ${prompt.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
           </div>`
        : '';

    const imageHtml = prompt.imageUrl
        ? `<div class="card-image">
            <img src="${escapeHtml(prompt.imageUrl)}" alt="範例圖片" loading="lazy" onerror="this.parentElement.style.display='none'">
           </div>`
        : '';

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
        </div>
        <div class="card-content">${escapeHtml(prompt.content)}</div>
        ${tagsHtml}
        ${imageHtml}
        <button class="copy-btn" data-action="copy">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            複製咒語
        </button>
    `;

    return card;
}

function renderCards() {
    const query = elements.searchInput.value;
    const filteredPrompts = filterPrompts(query);

    elements.cardsContainer.innerHTML = '';

    if (filteredPrompts.length === 0) {
        elements.emptyState.classList.add('visible');
        elements.cardsContainer.style.display = 'none';
    } else {
        elements.emptyState.classList.remove('visible');
        elements.cardsContainer.style.display = 'grid';

        filteredPrompts.forEach(prompt => {
            const card = createCardElement(prompt);
            elements.cardsContainer.appendChild(card);
        });
    }
}

// ===== Event Handlers =====
function handleFormSubmit(e) {
    e.preventDefault();

    const data = {
        title: elements.promptTitle.value.trim(),
        content: elements.promptContent.value.trim(),
        tags: parseTags(elements.promptTags.value),
        imageUrl: elements.promptImage.value.trim() || null
    };

    if (editingId) {
        updatePrompt(editingId, data);
        showToast('咒語已更新！');
    } else {
        addPrompt(data);
        showToast('咒語已新增！');
    }

    closeModal();
}

function handleCardAction(e) {
    const actionBtn = e.target.closest('[data-action]');
    if (!actionBtn) return;

    const action = actionBtn.dataset.action;
    const card = actionBtn.closest('.card');
    const promptId = card?.dataset.id;
    const prompt = prompts.find(p => p.id === promptId);

    if (!prompt) return;

    switch (action) {
        case 'edit':
            openModal(true, prompt);
            break;
        case 'delete':
            openDeleteModal(promptId);
            break;
        case 'copy':
            copyToClipboard(prompt.content);
            break;
    }
}

function handleSearch() {
    renderCards();
}

function handleConfirmDelete() {
    if (deleteId) {
        deletePrompt(deleteId);
        showToast('咒語已刪除！');
        closeDeleteModal();
    }
}

// ===== Event Listeners =====
function initEventListeners() {
    // Add button
    elements.addBtn.addEventListener('click', () => openModal());

    // Modal close buttons
    elements.modalClose.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);

    // Click outside modal to close
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });

    // Form submission
    elements.promptForm.addEventListener('submit', handleFormSubmit);

    // Card actions (using event delegation)
    elements.cardsContainer.addEventListener('click', handleCardAction);

    // Search input
    elements.searchInput.addEventListener('input', handleSearch);

    // Delete modal
    elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    elements.deleteModalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.deleteModalOverlay) closeDeleteModal();
    });

    // Settings modal
    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.settingsModalClose.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    elements.settingsModalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.settingsModalOverlay) closeSettingsModal();
    });

    // AI generate button
    elements.aiGenerateBtn.addEventListener('click', generateTitleWithAI);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.settingsModalOverlay.classList.contains('active')) {
                closeSettingsModal();
            } else if (elements.deleteModalOverlay.classList.contains('active')) {
                closeDeleteModal();
            } else if (elements.modalOverlay.classList.contains('active')) {
                closeModal();
            }
        }
    });
}

// ===== Initialize App =====
function init() {
    loadFromStorage();
    renderCards();
    initEventListeners();
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
