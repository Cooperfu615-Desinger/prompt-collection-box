// ===== Backup Feature =====
async function backupAll() {
    const btn = elements.backupBtn;
    btn.textContent = '打包下載中...';
    btn.disabled = true;

    let corsFailedImages = [];

    try {
        const snapshot = await db.collection(PROMPT_COLLECTION).orderBy('createdAt', 'desc').get();
        const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const data = rawData.map(normalizeToVariants);

        const jsonContent = JSON.stringify(data, null, 2);

        const txtLines = [];
        for (const prompt of data) {
            txtLines.push('=========================================');
            txtLines.push(`標題：${prompt.title || ''} `);
            txtLines.push('=========================================');

            const variants = prompt.variants || [];
            for (const v of variants) {
                txtLines.push(`【${v.tabName || '通用'}】`);
                txtLines.push(v.prompt || '');
                txtLines.push('');
            }

            const tags = (prompt.tags || []).join(', ');
            txtLines.push(`標籤：${tags} `);
            txtLines.push('');
            txtLines.push('');
        }
        const txtContent = txtLines.join('\n');

        const zip = new JSZip();
        zip.file('system_backup.json', jsonContent);
        zip.file('Prompts_Backup.txt', txtContent);

        const imgFolder = zip.folder('images');
        for (const prompt of data) {
            const variants = prompt.variants || [];
            for (const v of variants) {
                const imageUrl = v.imageUrl || '';
                if (!imageUrl) continue;

                const safeTitle = (prompt.title || 'prompt').replace(/[\\/:*?"<>|\s]/g, '_');
                const safeTab = (v.tabName || '通用').replace(/[\\/:*?"<>|\s]/g, '_');
                const filename = `${safeTitle}_${safeTab}.jpg`;

                try {
                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error(`HTTP ${response.status} `);
                    const blob = await response.blob();
                    imgFolder.file(filename, blob);
                } catch (err) {
                    console.warn(`圖片下載失敗（CORS 或其他原因），已跳過：${filename} `, err);
                    corsFailedImages.push(filename);
                }
            }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Prompt_Backup.zip';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        let msg = '備份成功！\nPrompt_Backup.zip 已下載。';
        if (corsFailedImages.length > 0) {
            msg += `\n\n注意：以下 ${corsFailedImages.length} 張圖片因 CORS 限制無法下載，已跳過：\n`;
            msg += corsFailedImages.join('\n');
        }
        alert(msg);

    } catch (err) {
        console.error('備份失敗：', err);
        alert('備份失敗，請確認網路連線與登入狀態。\n錯誤：' + err.message);
    } finally {
        btn.textContent = '📥 全部備份';
        btn.disabled = false;
    }
}
