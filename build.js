// Build: inline CSS + JS sources into a single self-contained HTML file.
const fs = require('fs'), path = require('path');
const ORDER = ['core', 'map', 'l1', 'l2', 'l3', 'l4', 'l5', 'story', 'nav', 'cargo', 'save', 'game', 'player', 'zombies', 'truck', 'survivor', 'world', 'interact', 'sprites', 'fx', 'render', 'audio', 'input', 'ui', 'garage', 'main'];
const src = (f) => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const js = ORDER.filter((n) => fs.existsSync(path.join(__dirname, 'src', n + '.js'))).map((n) => '/* ==== ' + n + '.js ==== */\n' + src(n + '.js')).join('\n');
const css = src('style.css');
let html = src('index.html');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), html);
console.log('dist/index.html', (html.length / 1024).toFixed(1) + ' KB');
// Installable web app files (manifest, service worker, icons)
for (const f of ['manifest.webmanifest', 'sw.js']) fs.copyFileSync(path.join(__dirname, f), path.join(__dirname, 'dist', f));
fs.cpSync(path.join(__dirname, 'icons'), path.join(__dirname, 'dist', 'icons'), { recursive: true });
// Artifact variant: page content only (the host supplies doctype/head/body skeleton)
const head = html.slice(html.indexOf('<title>'), html.indexOf('</head>'));
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
const art = head.replace('<style>', '<style>:root{color-scheme:dark}html,body{height:100%;background:#0d0f12}') + '\n' + body;
fs.writeFileSync(path.join(__dirname, 'dist', 'artifact.html'), art);
console.log('dist/artifact.html', (art.length / 1024).toFixed(1) + ' KB');
