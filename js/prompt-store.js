// ===== Data Migration Helper =====
function normalizeToVariants(doc) {
    if (doc.variants && Array.isArray(doc.variants)) return doc;

    const variants = [];
    if (doc.versions && Array.isArray(doc.versions)) {
        doc.versions.forEach((v, idx) => {
            variants.push({
                tabName: v.label || '通用',
                prompt: v.content || '',
                imageUrl: idx === 0 ? (doc.imageUrl || null) : null
            });
        });
    } else {
        variants.push({
            tabName: '通用',
            prompt: doc.content || '',
            imageUrl: doc.imageUrl || null
        });
    }

    return { ...doc, variants };
}

function subscribeToPrompts(onLoaded, onError) {
    return db.collection(PROMPT_COLLECTION)
        .onSnapshot((snapshot) => {
            const loadedPrompts = snapshot.docs.map(doc => {
                const raw = { id: doc.id, ...doc.data() };
                return normalizeToVariants(raw);
            });
            onLoaded(loadedPrompts);
        }, onError);
}

function subscribeToCustomTags(onLoaded, onError) {
    return db.collection(TAG_POOL_COLLECTION).onSnapshot((snapshot) => {
        const loadedCustomTags = {};
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.category && Array.isArray(data.tags)) {
                if (!loadedCustomTags[data.category]) loadedCustomTags[data.category] = [];
                data.tags.forEach(t => {
                    if (!loadedCustomTags[data.category].includes(t)) loadedCustomTags[data.category].push(t);
                });
            }
        });
        onLoaded(loadedCustomTags);
    }, onError);
}

async function migrateLocalStoragePrompts() {
    const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!localData) return 0;

    const parsedData = JSON.parse(localData);
    if (!parsedData || !Array.isArray(parsedData) || parsedData.length === 0) return 0;

    const batch = db.batch();
    let count = 0;

    parsedData.forEach(p => {
        const docRef = db.collection(PROMPT_COLLECTION).doc();
        const normalized = normalizeToVariants(p);

        batch.set(docRef, {
            title: normalized.title || 'Untitled',
            variants: normalized.variants,
            tags: normalized.tags || [],
            createdAt: normalized.createdAt || new Date().toISOString(),
            migratedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
    });

    await batch.commit();
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    return count;
}

async function createPrompt(data) {
    const now = new Date().toISOString();
    await db.collection(PROMPT_COLLECTION).add({
        title: data.title,
        variants: data.variants,
        tags: data.tags,
        createdAt: now,
        updatedAt: now
    });
}

async function savePrompt(id, data) {
    await db.collection(PROMPT_COLLECTION).doc(id).update({
        title: data.title,
        variants: data.variants,
        tags: data.tags,
        updatedAt: new Date().toISOString()
    });
}

function removePrompt(id) {
    return db.collection(PROMPT_COLLECTION).doc(id).delete();
}

async function saveCustomTag(category, tagName) {
    const snapshot = await db.collection(TAG_POOL_COLLECTION).where('category', '==', category).get();
    if (snapshot.empty) {
        await db.collection(TAG_POOL_COLLECTION).add({ category, tags: [tagName] });
    } else {
        const docRef = snapshot.docs[0].ref;
        await docRef.update({ tags: firebase.firestore.FieldValue.arrayUnion(tagName) });
    }
}
