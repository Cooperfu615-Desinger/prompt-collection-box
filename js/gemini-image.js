// ===== Gemini Image API Client =====
function getGeneratedImagePart(responseData) {
    const parts = responseData?.candidates?.[0]?.content?.parts || [];
    return parts.find(part => part.inlineData || part.inline_data) || null;
}

function base64ImageToFile(base64Data, mimeType = 'image/png') {
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        byteArrays.push(new Uint8Array(byteNumbers));
    }

    const extension = mimeType.includes('jpeg') ? 'jpg' : 'png';
    return new File(byteArrays, `gemini-preview-${Date.now()}.${extension}`, { type: mimeType });
}

async function requestGeminiPreviewImage(prompt, apiKey, model) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = data?.error?.message || `API error: ${response.status}`;
        throw new Error(message);
    }

    const imagePart = getGeneratedImagePart(data);
    const inlineData = imagePart?.inlineData || imagePart?.inline_data;
    if (!inlineData?.data) {
        throw new Error('Gemini 未回傳圖片');
    }

    return base64ImageToFile(inlineData.data, inlineData.mimeType || inlineData.mime_type || 'image/png');
}
