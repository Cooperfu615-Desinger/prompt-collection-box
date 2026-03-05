const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf-8');
const js = fs.readFileSync('script.js', 'utf-8');

const idMatches = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const jsMatches = [...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]);

const missing = jsMatches.filter(id => !idMatches.includes(id));
console.log('Missing IDs:', missing);
