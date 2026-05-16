const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.forwardTo(console);

const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, {
    url: 'http://localhost/',
    runScripts: 'outside-only',
    virtualConsole
});

dom.window.addEventListener('error', (e) => {
    console.error('DOM Error:', e.message);
});

function createMockCollection() {
    return {
        onSnapshot: () => () => {},
        get: () => Promise.resolve({ docs: [] }),
        doc: () => ({
            set: () => Promise.resolve(),
            update: () => Promise.resolve(),
            delete: () => Promise.resolve()
        }),
        add: () => Promise.resolve({ id: 'mock-id' }),
        where: () => ({ get: () => Promise.resolve({ empty: true, docs: [] }) }),
        orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) })
    };
}

function createMockAuth() {
    return {
        onAuthStateChanged: (cb) => {
            console.log('Firebase auth mock');
            setTimeout(() => cb(null), 100);
        },
        signInWithPopup: () => Promise.resolve(),
        signOut: () => Promise.resolve()
    };
}

// Mock Firebase enough for a no-login DOM smoke test.
dom.window.firebase = {
    initializeApp: () => console.log('Init Firebase (Mock)'),
    firestore: () => ({
        collection: () => createMockCollection(),
        batch: () => ({
            set: () => {},
            commit: () => Promise.resolve()
        })
    }),
    storage: () => ({
        ref: () => ({
            put: () => ({
                on: (_event, _progress, _error, complete) => complete && complete(),
                snapshot: {
                    ref: {
                        getDownloadURL: () => Promise.resolve('https://example.com/mock.jpg')
                    }
                }
            })
        })
    }),
    auth: createMockAuth
};

dom.window.firebase.auth.GoogleAuthProvider = function GoogleAuthProvider() {};
dom.window.firebase.firestore.FieldValue = {
    serverTimestamp: () => new Date(),
    arrayUnion: (...values) => values
};

const appScripts = [
    'js/config.js',
    'js/firebase.js',
    'js/prompt-store.js',
    'js/storage.js',
    'js/gemini-image.js',
    'script.js',
    'js/modal-editor.js',
    'js/markdown-import.js',
    'js/backup.js'
].map((scriptPath) => fs.readFileSync(scriptPath, 'utf-8')).join('\n\n');

dom.window.eval(appScripts);

if (dom.window.document.readyState !== 'loading') {
    dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true
    }));
}

setTimeout(() => {
    const requiredIds = [
        'loginOverlay',
        'cardsContainer',
        'promptForm',
        'tagPickerModalOverlay',
        'settingsModalOverlay'
    ];
    const missing = requiredIds.filter(id => !dom.window.document.getElementById(id));

    if (missing.length > 0) {
        console.error('Missing required DOM nodes:', missing);
        dom.window.close();
        process.exit(1);
    }

    console.log('JSDOM Test Finished');
    dom.window.close();
    process.exit(0);
}, 1000);
