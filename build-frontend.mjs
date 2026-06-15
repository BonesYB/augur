// Assembles the Tauri frontend (dist/) from the standalone prototype, without
// touching the dev files. Runs from tauri.conf.json's beforeDev/BuildCommand.
// Path-robust: resolves everything relative to this script's own location.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, copyFileSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Sibling assets the app loads at runtime (+ the Tauri bridge).
const assets = [
  'vault.js', 'augur-zip.js', 'vault-adapter.js', 'vault-serialize.js', 'vault-edit.js',
  'srd-bestiary.js', 'AugurIcon.svg', 'AugurLogo.svg', 'tutorial.augur', 'tauri-bridge.js',
];
let copied = 0;
for (const f of assets) {
  const src = join(root, f);
  if (existsSync(src)) { copyFileSync(src, join(dist, f)); copied++; }
  else console.warn('[build-frontend] missing, skipped:', f);
}

// index.html is the prototype with the Tauri bridge <script> injected before </body>.
const appHtml = join(root, 'augur-prototype-1.html');
if (!existsSync(appHtml)) {
  console.error('[build-frontend] cannot find augur-prototype-1.html next to this script.');
  process.exit(1);
}
let html = readFileSync(appHtml, 'utf8');
if (!html.includes('tauri-bridge.js')) {
  html = html.replace('</body>', '  <script src="tauri-bridge.js"></script>\n</body>');
}
writeFileSync(join(dist, 'index.html'), html);

console.log(`[build-frontend] dist/ assembled: index.html + ${copied} assets`);
