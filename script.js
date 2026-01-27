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
const auth = firebase.auth();
const PROMPT_COLLECTION = 'prompts';
const ALLOWED_EMAIL = 'cooperfu.615@gmail.com';

// ===== Connection Test (Requested) =====


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
let currentUser = null;

// ===== DOM Elements =====
const elements = {
    // Auth Elements
    loginOverlay: document.getElementById('loginOverlay'),
    googleLoginBtn: document.getElementById('googleLoginBtn'),
    loginError: document.getElementById('loginError'),
    logoutBtn: document.getElementById('logoutBtn'),

    // Existing Elements
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
        updatePreview(prompt.imageUrl);
    } else {
        modalVersions = [{ label: '通用', content: '' }];
        updatePreview('');
    }

    activeModalTabIdx = 0;
    renderModalTabs();

    elements.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => elements.promptTitle.focus(), 100);

    // Capture initial state for dirty check
    // Timeout ensuring values are set
    setTimeout(() => {
        initialFormState = getFormState();
    }, 50);
}

function closeModal(force = false) {
    // Note: The 'force' parameter is mainly used by the caller (handleCloseAttempt)
    // to bypass the check, but here we just execute the close logic.

    elements.modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
    editingId = null;
    modalVersions = [];
    activeModalTabIdx = 0;
    initialFormState = null;

    // Clear preview
    updatePreview('');
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

// ===== Storage Upload Logic (With Error Handling) =====
function uploadImage(file) {
    return new Promise((resolve, reject) => {
        if (!file) {
            resolve(null);
            return;
        }

        // Create a unique filename: images/timestamp_filename
        const storageRef = storage.ref(`images/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);

        showToast("正在上傳圖片...");

        uploadTask.on('state_changed',
            (snapshot) => {
                // Progress monitoring (optional)
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                // Handle unsuccessful uploads
                console.error("Upload failed:", error);
                // 使用 alert 讓使用者直接看到錯誤訊息
                alert("上傳失敗：" + error.message);
                reject(error);
            },
            () => {
                // Handle successful uploads on complete
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('File available at', downloadURL);
                    resolve(downloadURL);
                });
            }
        );
    });
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

    // Wrap in async call logic
    // We can't make the handler async because we might need to preventDefault first etc.
    // So we use an IIFE or just call it.

    (async () => {
        // Determine Image URL
        let finalImageUrl = elements.promptImage.value.trim() || null;

        // Check if file is selected
        if (elements.imageInput && elements.imageInput.files.length > 0) {
            const file = elements.imageInput.files[0];
            try {
                const uploadedUrl = await uploadImage(file);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                }
            } catch (err) {
                // Error already handled in uploadImage
                console.error("Image upload failed inside submit handler", err);
                return; // Stop submission on upload error? User might want to retry.
            }
        }

        const data = {
            title: elements.promptTitle.value.trim(),
            versions: modalVersions,
            tags: parseTags(elements.promptTags.value),
            imageUrl: finalImageUrl
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

    // Updated Close Logic with Persistence Check
    const handleCloseAttempt = () => {
        if (isFormDirty()) {
            if (confirm("您有未儲存的變更，確定要放棄並關閉嗎？")) {
                closeModal(true); // Force close
            }
        } else {
            closeModal(true);
        }
    };

    elements.modalClose.addEventListener('click', handleCloseAttempt);
    elements.cancelBtn.addEventListener('click', handleCloseAttempt);

    // Overlay click no longer closes the drawer (Persistence)
    // elements.modalOverlay.addEventListener('click', ...); // REMOVED

    elements.addTabBtn.addEventListener('click', addModalTab);

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
            else if (elements.modalOverlay.classList.contains('active')) handleCloseAttempt();
        }
    });

    // Image Preview Listeners
    if (elements.imageInput) {
        elements.imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const objectUrl = URL.createObjectURL(file);
                updatePreview(objectUrl);
            } else {
                // If file cleared, fallback to URL input or clear
                updatePreview(elements.promptImage.value);
            }
        });
    }

    if (elements.promptImage) {
        elements.promptImage.addEventListener('input', (e) => {
            // Only use URL if no file is selected
            if (!elements.imageInput.files.length) {
                updatePreview(e.target.value);
            }
        });
    }
}

// ===== Dirty State Tracking =====
let initialFormState = null;

function getFormState() {
    return {
        title: elements.promptTitle.value.trim(),
        tags: elements.promptTags.value.trim(),
        imageInput: elements.imageInput.value, // File path string (fake)
        imageUrl: elements.promptImage.value.trim(),
        versions: JSON.stringify(modalVersions)
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


    // 2. Subscribe (Moved to Auth State Listener)
    // subscribeToPrompts();

    // 3. Migrate (Moved to Auth State Listener)
    // await migrateLocalStorage();

    initEventListeners();
    initAuth();
}

// ===== Authentication Logic =====
function initAuth() {
    // Auth State Listener
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("User signed in:", user.email);
            if (user.email === ALLOWED_EMAIL) {
                // Authorized
                currentUser = user;
                elements.loginOverlay.classList.remove('active');
                elements.logoutBtn.style.display = 'flex';
                elements.loginError.style.display = 'none';

                // Initialize Data
                subscribeToPrompts();
                await migrateLocalStorage();
            } else {
                // Unauthorized
                console.warn("Unauthorized access attempt:", user.email);
                elements.loginError.style.display = 'flex';
                elements.loginError.querySelector('span').textContent = `權限不足：${user.email} 無法存取`;
                // Force sign out from app logic perspective but keep them in "limbo" or sign out?
                // Better: keep overlay active, show error.
            }
        } else {
            console.log("User signed out");
            currentUser = null;
            elements.loginOverlay.classList.add('active');
            elements.logoutBtn.style.display = 'none';
            elements.loginError.style.display = 'none';
            // Clear sensitive data from UI if needed
            elements.cardsContainer.innerHTML = '';
        }
    });

    // Login Button
    elements.googleLoginBtn.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
            console.error("Login failed:", error);
            alert("登入失敗：" + error.message);
        });
    });

    // Logout Button
    elements.logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            showToast('已安全登出');
        }).catch((error) => {
            console.error("Logout failed:", error);
        });
    });
}



document.addEventListener('DOMContentLoaded', init);
