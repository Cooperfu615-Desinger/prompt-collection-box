// ===== Markdown / ZIP Import =====
const IMPORT_STATUS_LABELS = {
    ready: '可匯入',
    duplicate: '重複',
    failed: '失敗',
    importing: '匯入中',
    success: '已匯入'
};

let pendingImportItems = [];
let isImporting = false;
let lastImportReport = null;

function extractMarkdownCodeBlock(markdown, heading) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
        '##\\s+' + escapedHeading + '\\s*\\n\\s*```(?:\\w+)?\\s*\\n([\\s\\S]*?)\\n\\s*```',
        'i'
    );
    const match = markdown.match(pattern);
    return match ? match[1].trim() : '';
}

function extractMarkdownCodeBlockByHeadings(markdown, headings) {
    return headings.map((heading) => extractMarkdownCodeBlock(markdown, heading)).find(Boolean) || '';
}

function extractMarkdownSummary(markdown) {
    const match = markdown.match(/\*\*Summary:\*\*\s*(.+)/);
    return match ? match[1].trim() : '';
}

function pickSummaryValue(summary, label) {
    if (!summary) return '';
    const match = summary.match(new RegExp(`${label}：([^|]+)`));
    if (!match) return '';
    return match[1]
        .split('/')
        .map(part => part.trim())
        .map(part => part.replace(/^(戶外|室內)：/, ''))
        .find(part => part && part !== '-' && part !== 'none') || '';
}

function createImportTitle(markdown, fileName, preferredTitle = '') {
    if (preferredTitle) return String(preferredTitle).trim().slice(0, 80);

    const summary = extractMarkdownSummary(markdown);
    const titleParts = [
        pickSummaryValue(summary, '場景'),
        pickSummaryValue(summary, '服裝'),
        pickSummaryValue(summary, '光影')
    ].filter(Boolean);

    if (titleParts.length > 0) return titleParts.join('｜').slice(0, 80);
    if (summary) return summary.slice(0, 80);

    const heading = markdown.match(/^#\s+(.+)$/m);
    if (heading && !heading[1].startsWith('Generated Prompt')) {
        return heading[1].trim().slice(0, 80);
    }

    return fileName.replace(/\.[^.]+$/, '').slice(0, 80);
}

function inferImportTags(markdown) {
    const validTagNames = getAllTagNames();
    const tags = validTagNames.filter(tag => markdown.includes(tag));

    for (const [keyword, tag] of Object.entries(IMPORT_TAG_SYNONYMS)) {
        if (markdown.toLowerCase().includes(keyword.toLowerCase()) && validTagNames.includes(tag)) {
            tags.push(tag);
        }
    }

    return Array.from(new Set(tags));
}

function normalizeSourceTags(tags) {
    if (!Array.isArray(tags)) return [];

    const normalized = [];
    tags.forEach((tag) => {
        if (typeof tag === 'string') {
            const id = tag.trim();
            if (id) normalized.push({ id, category: '來源', label: id });
            return;
        }

        if (!tag || typeof tag !== 'object') return;
        const id = String(tag.id || tag.key || tag.label || '').trim();
        if (!id) return;
        normalized.push({
            id,
            category: String(tag.category || '來源').trim() || '來源',
            label: String(tag.label || tag.zh || id).trim() || id
        });
    });

    return normalized.filter((tag, index, list) => (
        list.findIndex(item => item.id === tag.id && item.category === tag.category) === index
    ));
}

function parseMarkdownPrompt(markdown, fileName = 'imported-prompt.md', metadata = {}) {
    const sections = [
        ['AI Prompt', 'Midjourney Prompt'],
        ['Grok Structured Prompt', 'Grok Structured', 'Gpt'],
        ['Z-Image Prompt', 'Grok/Z-Image', 'Z-Image']
    ];

    const variants = sections
        .map((headings, index) => ({
            tabName: ['AI Prompt', 'Grok Structured', 'Z-Image'][index],
            prompt: extractMarkdownCodeBlockByHeadings(markdown, headings),
            imageUrl: null
        }))
        .filter(variant => variant.prompt);

    if (variants.length === 0) {
        throw new Error('找不到可匯入的 Prompt 區塊');
    }

    const sourceTags = normalizeSourceTags(metadata.tags);
    const sourceTagLabels = sourceTags.map(tag => tag.label || tag.id);
    const inferredTags = metadata.tags ? [] : inferImportTags(markdown);

    return {
        title: createImportTitle(markdown, fileName, metadata.title),
        variants,
        tags: Array.from(new Set([...inferredTags, ...sourceTagLabels])),
        sourceTags,
        source: String(metadata.source || ''),
        sourceLabel: String(metadata.sourceLabel || ''),
        sourceProject: String(metadata.sourceProject || ''),
        sourceId: String(metadata.sourceId || ''),
        sourceFileName: fileName,
        summary: String(metadata.summary || extractMarkdownSummary(markdown)),
        summaryFields: metadata.summaryFields && typeof metadata.summaryFields === 'object'
            ? metadata.summaryFields
            : undefined
    };
}

function normalizeArchivePath(path) {
    return String(path || '').replace(/^\.\//, '').replace(/\\/g, '/');
}

function findManifestItem(items, entryName) {
    const normalizedEntryName = normalizeArchivePath(entryName);
    const entryBaseName = normalizedEntryName.split('/').pop();
    return (Array.isArray(items) ? items : []).find((item) => {
        const manifestFile = normalizeArchivePath(item?.file);
        return manifestFile === normalizedEntryName || manifestFile.split('/').pop() === entryBaseName;
    }) || null;
}

async function readZipImport(file) {
    if (typeof JSZip === 'undefined') {
        throw new Error('ZIP 匯入元件尚未載入，請重新整理頁面');
    }

    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);
    const manifestEntry = entries.find(entry => (
        !entry.dir && normalizeArchivePath(entry.name).toLowerCase() === 'manifest.json'
    ));
    let manifest = null;

    if (manifestEntry) {
        try {
            manifest = JSON.parse(await manifestEntry.async('string'));
        } catch {
            throw new Error('manifest.json 格式錯誤');
        }
    }

    const markdownEntries = entries
        .filter(entry => !entry.dir && entry.name.toLowerCase().endsWith('.md'))
        .sort((a, b) => a.name.localeCompare(b.name));

    if (markdownEntries.length === 0) {
        throw new Error('ZIP 中找不到 Markdown Prompt 檔案');
    }

    const items = [];
    for (const entry of markdownEntries) {
        try {
            const markdown = await entry.async('string');
            const manifestItem = findManifestItem(manifest?.items, entry.name);
            const data = parseMarkdownPrompt(markdown, entry.name.split('/').pop(), {
                ...(manifestItem || {}),
                sourceProject: manifest?.sourceProject || manifestItem?.sourceProject || '',
                sourceId: manifestItem?.sourceId || '',
                tags: manifestItem?.tags,
            });
            items.push({ fileName: entry.name, data, status: 'ready', reason: '' });
        } catch (error) {
            items.push({
                fileName: entry.name,
                data: null,
                status: 'failed',
                reason: error.message || 'Markdown 解析失敗'
            });
        }
    }

    return items;
}

async function readImportFiles(files) {
    const items = [];

    for (const file of files) {
        const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
        if (isZip) {
            try {
                items.push(...await readZipImport(file));
            } catch (error) {
                items.push({ fileName: file.name, data: null, status: 'failed', reason: error.message });
            }
            continue;
        }

        try {
            const markdown = await file.text();
            items.push({
                fileName: file.name,
                data: parseMarkdownPrompt(markdown, file.name),
                status: 'ready',
                reason: ''
            });
        } catch (error) {
            items.push({ fileName: file.name, data: null, status: 'failed', reason: error.message });
        }
    }

    return items;
}

function normalizeImportText(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function buildPromptFingerprint(prompt) {
    const variants = Array.isArray(prompt?.variants) ? prompt.variants : [];
    return JSON.stringify({
        variants: variants.map(variant => ({
            tabName: normalizeImportText(variant?.tabName),
            prompt: normalizeImportText(variant?.prompt)
        }))
    });
}

async function computeContentHash(value) {
    const text = String(value || '');
    if (window.crypto?.subtle && window.TextEncoder) {
        const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    }

    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a-${(hash >>> 0).toString(16)}`;
}

async function prepareImportItems(items) {
    const knownHashes = new Set(prompts.map(prompt => prompt.contentHash).filter(Boolean));
    const knownFingerprints = new Set(prompts.map(buildPromptFingerprint));
    const packageHashes = new Set();

    for (const item of items) {
        if (item.status !== 'ready' || !item.data) continue;
        item.fingerprint = buildPromptFingerprint(item.data);
        item.contentHash = await computeContentHash(item.fingerprint);

        if (knownHashes.has(item.contentHash) || knownFingerprints.has(item.fingerprint) || packageHashes.has(item.contentHash)) {
            item.status = 'duplicate';
            item.reason = '與現有資料或本次匯入的其他檔案內容相同';
        } else {
            packageHashes.add(item.contentHash);
        }
    }

    return items;
}

function setImportReviewOpen(isOpen) {
    elements.importReviewOverlay.classList.toggle('active', isOpen);
    elements.importReviewOverlay.setAttribute('aria-hidden', String(!isOpen));
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function getImportCounts() {
    return pendingImportItems.reduce((counts, item) => {
        counts.total += 1;
        if (counts[item.status] !== undefined) counts[item.status] += 1;
        return counts;
    }, { total: 0, ready: 0, duplicate: 0, failed: 0, success: 0, importing: 0 });
}

function renderImportSummary() {
    const counts = getImportCounts();
    elements.importReviewSummary.innerHTML = `
        <div class="import-summary-item"><strong>${counts.total}</strong><span>檔案</span></div>
        <div class="import-summary-item"><strong>${counts.ready}</strong><span>可匯入</span></div>
        <div class="import-summary-item"><strong>${counts.duplicate}</strong><span>重複</span></div>
        <div class="import-summary-item"><strong>${counts.failed}</strong><span>失敗</span></div>
    `;
}

function renderImportReviewList() {
    const filter = elements.importStatusFilter.value;
    const visibleItems = pendingImportItems.filter(item => filter === 'all' || item.status === filter);

    if (visibleItems.length === 0) {
        elements.importReviewList.innerHTML = '<div class="empty-state">目前沒有符合條件的項目。</div>';
        return;
    }

    elements.importReviewList.innerHTML = visibleItems.map((item) => {
        const title = item.data?.title || '-';
        const tags = item.data?.tags?.slice(0, 6).join('、') || '無來源標籤';
        const meta = [item.data?.sourceProject, item.data?.sourceId ? `來源 ID：${item.data.sourceId}` : '', `標籤：${tags}`]
            .filter(Boolean)
            .join('｜');
        return `
            <div class="import-review-row" data-status="${escapeHtml(item.status)}">
                <div>
                    <div class="import-review-file" title="${escapeHtml(item.fileName)}">${escapeHtml(item.fileName)}</div>
                    <div class="import-review-meta" title="${escapeHtml(meta)}">${escapeHtml(title)}｜${escapeHtml(meta)}</div>
                    ${item.reason ? `<div class="import-review-error" title="${escapeHtml(item.reason)}">${escapeHtml(item.reason)}</div>` : ''}
                </div>
                <div class="import-review-status">${IMPORT_STATUS_LABELS[item.status] || item.status}</div>
            </div>
        `;
    }).join('');
}

function renderImportReview() {
    renderImportSummary();
    renderImportReviewList();
}

function closeImportReview() {
    if (isImporting) return;
    pendingImportItems = [];
    setImportReviewOpen(false);
}

function downloadImportReport() {
    if (!lastImportReport) return;
    const blob = new Blob([JSON.stringify(lastImportReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prompt-import-report-${lastImportReport.importBatchId || Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function openImportReview(items) {
    pendingImportItems = items;
    isImporting = false;
    lastImportReport = null;
    elements.importReviewSubtitle.textContent = `已解析 ${items.length} 個檔案，請確認後開始匯入。`;
    elements.importReviewProgress.hidden = true;
    elements.importProgressFill.style.width = '0%';
    elements.importProgressLabel.textContent = '準備匯入...';
    elements.importStatusFilter.value = 'all';
    elements.importDuplicateMode.value = 'skip';
    elements.startImportBtn.disabled = false;
    elements.startImportBtn.textContent = '開始匯入';
    elements.downloadImportReportBtn.hidden = true;
    elements.cancelImportReviewBtn.textContent = '取消';
    renderImportReview();
    setImportReviewOpen(true);
}

async function startImport() {
    if (isImporting) return;
    const duplicateMode = elements.importDuplicateMode.value;
    const importItems = pendingImportItems.filter(item => (
        item.status === 'ready' || (duplicateMode === 'import' && item.status === 'duplicate')
    ));

    if (importItems.length === 0) {
        showToast('沒有可匯入的項目');
        return;
    }

    isImporting = true;
    const importBatchId = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const importedAt = new Date().toISOString();
    elements.importReviewProgress.hidden = false;
    elements.startImportBtn.disabled = true;
    elements.cancelImportReviewBtn.disabled = true;

    let successCount = 0;
    for (let index = 0; index < importItems.length; index += 1) {
        const item = importItems[index];
        item.status = 'importing';
        elements.importProgressLabel.textContent = `正在匯入 ${index + 1} / ${importItems.length}：${item.fileName}`;
        elements.importProgressFill.style.width = `${Math.round((index / importItems.length) * 100)}%`;
        renderImportReview();

        try {
            await addPrompt({
                ...item.data,
                sourceFileName: item.data.sourceFileName || item.fileName,
                importBatchId,
                importedAt,
                contentHash: item.contentHash,
            }, { silent: true });
            item.status = 'success';
            item.reason = '';
            successCount += 1;
        } catch (error) {
            item.status = 'failed';
            item.reason = error.message || 'Firestore 寫入失敗';
        }

        renderImportReview();
    }

    elements.importProgressFill.style.width = '100%';
    elements.importProgressLabel.textContent = `匯入完成：成功 ${successCount} / ${importItems.length} 筆，批次 ID：${importBatchId}`;
    elements.importReviewSubtitle.textContent = `本次匯入批次：${importBatchId}`;
    elements.startImportBtn.disabled = false;
    elements.startImportBtn.textContent = '關閉報告';
    elements.cancelImportReviewBtn.disabled = false;
    elements.cancelImportReviewBtn.textContent = '關閉';
    isImporting = false;
    renderImportReview();

    const failedCount = getImportCounts().failed;
    lastImportReport = {
        schemaVersion: 1,
        importBatchId,
        importedAt,
        completedAt: new Date().toISOString(),
        counts: getImportCounts(),
        items: pendingImportItems.map(item => ({
            fileName: item.fileName,
            title: item.data?.title || '',
            status: item.status,
            reason: item.reason || '',
            contentHash: item.contentHash || '',
            sourceProject: item.data?.sourceProject || '',
            sourceId: item.data?.sourceId || ''
        }))
    };
    elements.downloadImportReportBtn.hidden = false;
    if (failedCount > 0) {
        showToast(`匯入完成，成功 ${successCount} 筆，失敗 ${failedCount} 筆`);
    } else {
        showToast(`匯入完成，共 ${successCount} 筆`);
    }
}

async function handleMarkdownImportChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    if (!currentUser) {
        showToast('請先登入後再匯入');
        return;
    }

    const originalText = elements.importBtn.textContent;
    elements.importBtn.disabled = true;
    elements.importBtn.textContent = '解析中...';

    try {
        const items = await readImportFiles(files);
        if (items.length === 0) throw new Error('沒有找到可匯入的檔案');
        await prepareImportItems(items);
        openImportReview(items);
    } catch (error) {
        console.error('Import preparation failed:', error);
        showAppAlert(`匯入解析失敗：${error.message}`, '匯入失敗');
    } finally {
        elements.importBtn.disabled = false;
        elements.importBtn.textContent = originalText;
    }
}

function initImportReviewEvents() {
    elements.importReviewClose.addEventListener('click', closeImportReview);
    elements.cancelImportReviewBtn.addEventListener('click', closeImportReview);
    elements.startImportBtn.addEventListener('click', () => {
        if (!isImporting && elements.startImportBtn.textContent === '關閉報告') {
            closeImportReview();
            return;
        }
        startImport();
    });
    elements.downloadImportReportBtn.addEventListener('click', downloadImportReport);
    elements.importStatusFilter.addEventListener('change', renderImportReviewList);
    elements.importDuplicateMode.addEventListener('change', renderImportReview);
    elements.importReviewOverlay.addEventListener('click', (event) => {
        if (event.target === elements.importReviewOverlay) closeImportReview();
    });
}

if (typeof elements !== 'undefined' && elements.importReviewOverlay) {
    initImportReviewEvents();
}
