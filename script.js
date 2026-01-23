// ===== Firebase Configuration & Init (Compat) =====
const firebaseConfig = {
    apiKey: "AIzaSyBqegw9GxFNJe45gRjAPf_Cd8oOy_ioynw",
    authDomain: "prompt-collection-cloud.firebaseapp.com",
    projectId: "prompt-collection-cloud",
    storageBucket: "prompt-collection-cloud.firebasestorage.app",
    messagingSenderId: "221852213987",
    appId: "1:221852213987:web:ced5f261cdd27d43611bd6",
    measurementId: "G-0ET6RM8YXF"
};

// Initialize Firebase (Compat)
try {
    firebase.initializeApp(firebaseConfig);
    console.log("Firebase App Initialized");
} catch (error) {
    console.error("Firebase Init Error:", error);
}

const db = firebase.firestore();
const storage = firebase.storage();
const PROMPT_COLLECTION = 'prompts';

// ===== Connection Test (Requested) =====
function testFirestoreConnection() {
    console.log("Testing Firestore Connection...");
    db.collection("test_collection").add({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        message: "Hello from Prompt Box Debugger"
    })
        .then((docRef) => {
            console.log("Firestore 連線成功！測試寫入文件 ID: ", docRef.id);
            showToast("Firestore 連線成功！");
        })
        .catch((error) => {
            console.error("Firestore Error (Test Write):", error);
        });
}

// ===== Data Model =====
const LOCAL_STORAGE_KEY = 'prompt-collection-box';
const API_KEY_STORAGE = 'gemini-api-key';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// ===== State =====
let prompts = [];
let editingId = null;
let deleteId = null;
let modalVersions = [];
let activeModalTabIdx = 0;

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
    promptTags: document.getElementById('promptTags'),
    promptImage: document.getElementById('promptImage'), // URL Input
    imageInput: document.getElementById('imageInput'),   // File Input
    modalTabsList: document.getElementById('modalTabsList'),
    modalTabsPanels: document.getElementById('modalTabsPanels'),
    addTabBtn: document.getElementById('addTabBtn'),
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
    saveApiKeyBtn: document.getElementById('saveApiKeyBtn'),
    cancelSettingsBtn: document.getElementById('cancelSettingsBtn'),
    aiGenerateBtn: document.getElementById('aiGenerateBtn')
};

// ===== Firestore Logic (Compat Syntax) =====

// Listen for real-time updates
function subscribeToPrompts() {
    db.collection(PROMPT_COLLECTION)
        .orderBy('createdAt', 'desc')
        .onSnapshot((snapshot) => {
            prompts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`Loaded ${prompts.length} prompts from Firestore.`);
            renderCards();
        }, (error) => {
            console.error("Firestore Error (Snapshot):", error);
            showToast("無法載入資料，請檢查網路連線");
        });
}

// Data Migration
async function migrateLocalStorage() {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!localData) return;

    try {
        const parsedData = JSON.parse(localData);
        if (parsedData && Array.isArray(parsedData) && parsedData.length > 0) {

            showToast("正在遷移舊資料至雲端...");
            console.log(`Migrating ${parsedData.length} prompts...`);

            const batch = db.batch();
            let count = 0;

            parsedData.forEach(p => {
                const docRef = db.collection(PROMPT_COLLECTION).doc();

                let versions = p.versions;
                if (!versions) {
                    versions = [{ label: '通用', content: p.content || '' }];
                }

                batch.set(docRef, {
                    title: p.title || 'Untitled',
                    versions: versions,
                    tags: p.tags || [],
                    imageUrl: p.imageUrl || null,
                    createdAt: p.createdAt || new Date().toISOString(),
                    migratedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                count++;
            });

            await batch.commit();
            console.log("Migration complete.");
            localStorage.removeItem(LOCAL_STORAGE_KEY);
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

// ===== Modal Functions (Tabs Logic) =====
function renderModalTabs() {
    elements.modalTabsList.innerHTML = '';
    elements.modalTabsPanels.innerHTML = '';

    modalVersions.forEach((version, index) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tab-btn ${index === activeModalTabIdx ? 'active' : ''}`;
        btn.textContent = version.label || `版本 ${index + 1}`;
        btn.onclick = () => switchModalTab(index);
        elements.modalTabsList.appendChild(btn);

        const panel = document.createElement('div');
        panel.className = `tab-panel ${index === activeModalTabIdx ? 'active' : ''}`;

        const labelInput = document.createElement('input');
        labelInput.type = 'text';
        labelInput.className = 'version-label-input';
        labelInput.placeholder = '版本名稱 (例如: ChatGPT, v1)';
        labelInput.value = version.label;
        labelInput.oninput = (e) => {
            version.label = e.target.value;
            btn.textContent = e.target.value || `版本 ${index + 1}`;
        };
        panel.appendChild(labelInput);

        const textarea = document.createElement('textarea');
        textarea.required = true;
        textarea.placeholder = '請輸入你的 Prompt 內容...';
        textarea.value = version.content;
        textarea.id = `modal-version-content-${index}`;
        textarea.oninput = (e) => {
            version.content = e.target.value;
        };
        panel.appendChild(textarea);

        if (modalVersions.length > 1) {
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'delete-version-btn';
            deleteBtn.textContent = '刪除此版本';
            deleteBtn.onclick = () => deleteModalTab(index);
            panel.appendChild(deleteBtn);
        }

        elements.modalTabsPanels.appendChild(panel);
    });

    elements.addTabBtn.disabled = modalVersions.length >= 3;
}

function switchModalTab(index) {
    activeModalTabIdx = index;
    renderModalTabs();
}

function addModalTab() {
    if (modalVersions.length >= 3) return;
    const nextNum = modalVersions.length + 1;
    modalVersions.push({ label: `v${nextNum}`, content: '' });
    activeModalTabIdx = modalVersions.length - 1;
    renderModalTabs();
}

function deleteModalTab(index) {
    if (modalVersions.length <= 1) return;
    modalVersions.splice(index, 1);
    if (activeModalTabIdx >= modalVersions.length) {
        activeModalTabIdx = modalVersions.length - 1;
    }
    renderModalTabs();
}

function openModal(isEdit = false, prompt = null) {
    editingId = isEdit && prompt ? prompt.id : null;
    elements.modalTitle.textContent = isEdit ? '編輯咒語' : '新增咒語';
    elements.promptForm.reset();

    // Reset file input manually
    if (elements.imageInput) elements.imageInput.value = '';

    if (isEdit && prompt) {
        elements.promptTitle.value = prompt.title;
        elements.promptTags.value = formatTags(prompt.tags);
        elements.promptImage.value = prompt.imageUrl || '';
        modalVersions = JSON.parse(JSON.stringify(prompt.versions));
    } else {
        modalVersions = [{ label: '通用', content: '' }];
    }

    activeModalTabIdx = 0;
    renderModalTabs();

    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => elements.promptTitle.focus(), 100);
}

function closeModal() {
    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
    modalVersions = [];
    activeModalTabIdx = 0;
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
    saveApiKey(key);
    showToast(key ? 'API Key 已儲存！' : 'API Key 已清除！');
    closeSettingsModal();
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

    const currentContent = modalVersions[activeModalTabIdx]?.content?.trim();
    if (!currentContent) {
        showToast('請先輸入咒語內容 (目前版本)');
        const textarea = document.getElementById(`modal-version-content-${activeModalTabIdx}`);
        if (textarea) textarea.focus();
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
                        text: `請分析以下 Prompt 的內容，並生成一個繁體中文的精簡標題，限制在 50 字以內，不要包含引號或多餘解釋，直接回覆標題文字即可：\n\n${currentContent}`
                    }]
                }]
            })
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        const title = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (title) {
            elements.promptTitle.value = title.replace(/^["'「『]|["'」』]$/g, '').trim();
            showToast('標題已生成！');
        } else {
            throw new Error('No title generated');
        }
    } catch (error) {
        console.error('AI generation error:', error);
        showToast('生成失敗，請檢查 API Key');
    } finally {
        setGenerateBtnLoading(false);
    }
}

// ===== Storage Upload Logic =====
async function uploadImage(file) {
    if (!file) return null;

    // Create a unique filename: images/timestamp_filename
    const storageRef = storage.ref(`images/${Date.now()}_${file.name}`);

    try {
        showToast("正在上傳圖片...");
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        console.log("Uploaded a blob or file!", downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Upload failed:", error);
        showToast("圖片上傳失敗");
        return null;
    }
}

// ===== CRUD Operations (Compat) =====
async function addPrompt(data) {
    try {
        await db.collection(PROMPT_COLLECTION).add({
            title: data.title,
            versions: data.versions,
            tags: data.tags,
            imageUrl: data.imageUrl,
            createdAt: new Date().toISOString()
        });
        showToast('咒語已新增！');
        console.log("Firestore 連線成功！(Add)");
    } catch (error) {
        console.error("Firestore Error (Add):", error);
        showToast('新增失敗！');
    }
}

async function updatePrompt(id, data) {
    try {
        await db.collection(PROMPT_COLLECTION).doc(id).update({
            title: data.title,
            versions: data.versions,
            tags: data.tags,
            imageUrl: data.imageUrl,
            updatedAt: new Date().toISOString()
        });
        showToast('咒語已更新！');
        console.log("Firestore 連線成功！(Update)");
    } catch (error) {
        console.error("Firestore Error (Update):", error);
        showToast('更新失敗！');
    }
}

function deletePrompt(id) {
    db.collection(PROMPT_COLLECTION).doc(id).delete()
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

// ===== Search/Filter =====
function filterPrompts(query) {
    if (!query || !query.trim()) return prompts;
    const searchTerm = query.toLowerCase().trim();
    return prompts.filter(prompt => {
        const titleMatch = prompt.title.toLowerCase().includes(searchTerm);
        const tagMatch = prompt.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        const contentMatch = prompt.versions.some(v => v.content.toLowerCase().includes(searchTerm));
        return titleMatch || tagMatch || contentMatch;
    });
}

// ===== Render Functions =====
function createCardElement(prompt) {
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = prompt.id;

    const activeVersionIdx = 0;
    const activeVersion = prompt.versions[activeVersionIdx] || { content: '' };

    const tagsHtml = prompt.tags.length > 0
        ? `<div class="card-tags">${prompt.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>`
        : '';

    // Image priority is handled by the data itself (imageUrl field)
    const imageHtml = prompt.imageUrl
        ? `<div class="card-image"><img src="${escapeHtml(prompt.imageUrl)}" alt="範例圖片" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
        : '';

    let tabsHeaderHtml = '';
    if (prompt.versions.length > 1) {
        const tabsBtns = prompt.versions.map((v, idx) =>
            `<button class="tab-btn ${idx === 0 ? 'active' : ''}" 
                data-idx="${idx}" onclick="handleCardTabSwitch(this, '${prompt.id}', ${idx})">
                ${escapeHtml(v.label)}
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
        </div>
        <div class="tabs-container">
            ${tabsHeaderHtml}
            <div class="card-content" id="card-content-${prompt.id}">${escapeHtml(activeVersion.content)}</div>
        </div>
        ${tagsHtml}
        ${imageHtml}
        <button class="copy-btn" data-action="copy" data-current-idx="0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
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
    document.getElementById(`card-content-${promptId}`).textContent = prompt.versions[idx].content;
    card.querySelector('.copy-btn').dataset.currentIdx = idx;
};

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
        filteredPrompts.forEach(prompt => elements.cardsContainer.appendChild(createCardElement(prompt)));
    }
}

// ===== Event Handlers =====
function handleFormSubmit(e) {
    e.preventDefault();
    const validVersions = modalVersions.filter(v => v.content.trim() !== '');
    if (validVersions.length === 0) {
        showToast('請至少輸入一個版本的內容');
        return;
    }

    const data = {
        title: elements.promptTitle.value.trim(),
        versions: modalVersions,
        tags: parseTags(elements.promptTags.value),
        imageUrl: elements.promptImage.value.trim() || null
    };

    if (editingId) {
        updatePrompt(editingId, data);
    } else {
        addPrompt(data);
    }
    closeModal();
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
            copyToClipboard(prompt.versions[currentIdx]?.content || '');
            break;
    }
}

function handleSearch() {
    renderCards();
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
    elements.modalClose.addEventListener('click', closeModal);
    elements.cancelBtn.addEventListener('click', closeModal);
    elements.addTabBtn.addEventListener('click', addModalTab);
    elements.modalOverlay.addEventListener('click', (e) => { if (e.target === elements.modalOverlay) closeModal(); });

    elements.promptForm.addEventListener('submit', handleFormSubmit);
    elements.cardsContainer.addEventListener('click', handleCardAction);
    elements.searchInput.addEventListener('input', handleSearch);

    elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    elements.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    elements.deleteModalOverlay.addEventListener('click', (e) => { if (e.target === elements.deleteModalOverlay) closeDeleteModal(); });

    elements.settingsBtn.addEventListener('click', openSettingsModal);
    elements.settingsModalClose.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsBtn.addEventListener('click', closeSettingsModal);
    elements.saveApiKeyBtn.addEventListener('click', handleSaveApiKey);
    elements.settingsModalOverlay.addEventListener('click', (e) => { if (e.target === elements.settingsModalOverlay) closeSettingsModal(); });

    elements.aiGenerateBtn.addEventListener('click', generateTitleWithAI);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (elements.settingsModalOverlay.classList.contains('active')) closeSettingsModal();
            else if (elements.deleteModalOverlay.classList.contains('active')) closeDeleteModal();
            else if (elements.modalOverlay.classList.contains('active')) closeModal();
        }
    });
}

// ===== Initialize App =====
async function init() {
    // 1. Connection Test (Manual write for debug)
    testFirestoreConnection();

    // 2. Subscribe
    subscribeToPrompts();

    // 3. Migrate
    await migrateLocalStorage();

    // 4. Setup Listeners
    initEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
