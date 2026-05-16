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
