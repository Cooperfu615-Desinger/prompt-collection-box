const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.sendToConsole(console);

const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole
});

dom.window.addEventListener('error', (e) => {
    console.error('DOM Error:', e.message);
});

// Mock firebase
dom.window.firebase = {
    initializeApp: () => console.log('Init Firebase (Mock)'),
    firestore: () => ({
        collection: () => ({
            get: () => Promise.resolve({ docs: [] }),
            orderBy: () => ({ get: () => Promise.resolve({ docs: [] }) })
        })
    }),
    storage: () => ({}),
    auth: () => ({
        onAuthStateChanged: (cb) => {
            console.log('Firebase auth mock');
            // Mock empty user
            setTimeout(() => cb(null), 100);
        }
    })
};

const js = fs.readFileSync('script.js', 'utf-8');
const scriptEl = dom.window.document.createElement('script');
scriptEl.textContent = js;
dom.window.document.body.appendChild(scriptEl);

// Wait a bit for async tasks
setTimeout(() => {
    console.log("JSDOM Test Finished");
}, 1000);
