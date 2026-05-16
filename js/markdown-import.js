// ===== Markdown Import =====
function extractMarkdownCodeBlock(markdown, heading) {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`##\\s+${escapedHeading}\\s*\\n\\s*\`\`\`(?:\\w+)?\\s*\\n([\\s\\S]*?)\\n\\s*\`\`\``, 'i');
    const match = markdown.match(pattern);
    return match ? match[1].trim() : '';
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

function createImportTitle(markdown, fileName) {
    const summary = extractMarkdownSummary(markdown);
    const titleParts = [
        pickSummaryValue(summary, '場景'),
        pickSummaryValue(summary, '服裝'),
        pickSummaryValue(summary, '光影')
    ].filter(Boolean);

    if (titleParts.length > 0) {
        return titleParts.join('｜').slice(0, 80);
    }

    if (summary) {
        return summary.slice(0, 80);
    }

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

function parseMarkdownPrompt(markdown, fileName = 'imported-prompt.md') {
    const sections = [
        ['AI Prompt', 'AI Prompt'],
        ['Grok Structured Prompt', 'Grok Structured'],
        ['Z-Image Prompt', 'Z-Image']
    ];

    const variants = sections
        .map(([heading, tabName]) => ({
            tabName,
            prompt: extractMarkdownCodeBlock(markdown, heading),
            imageUrl: null
        }))
        .filter(variant => variant.prompt);

    if (variants.length === 0) {
        throw new Error('找不到可匯入的 Prompt 區塊');
    }

    return {
        title: createImportTitle(markdown, fileName),
        variants,
        tags: inferImportTags(markdown)
    };
}

async function handleMarkdownImportChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (!currentUser) {
        showToast('請先登入後再匯入');
        e.target.value = '';
        return;
    }

    elements.importBtn.disabled = true;
    const originalText = elements.importBtn.textContent;
    elements.importBtn.textContent = '匯入中...';

    const failures = [];
    let importedCount = 0;

    for (const file of files) {
        try {
            const markdown = await file.text();
            const data = parseMarkdownPrompt(markdown, file.name);
            await addPrompt(data);
            importedCount++;
        } catch (err) {
            console.error('Markdown import failed:', file.name, err);
            failures.push(`${file.name}: ${err.message}`);
        }
    }

    elements.importBtn.disabled = false;
    elements.importBtn.textContent = originalText;
    e.target.value = '';

    if (failures.length > 0) {
        showAppAlert(`已匯入 ${importedCount} 個檔案。\n\n以下檔案匯入失敗：\n${failures.join('\n')}`, '匯入完成');
    } else {
        showToast(`成功匯入 ${importedCount} 個 Markdown 檔`);
    }
}
