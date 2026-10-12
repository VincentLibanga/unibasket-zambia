import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.argv[2];
if (!sourceRoot) throw new Error('Usage: node tools/apply-user-supplied-images.mjs /path/to/source-images');

const mapping = JSON.parse(fs.readFileSync(path.join(projectRoot, 'tools/user-supplied-image-map.json'), 'utf8'));
const productNames = fs.readFileSync(path.join(projectRoot, 'public/script.js'), 'utf8')
  .split('const fallbackProducts=[')[1].split('];')[0]
  .split('\n').filter(line => /^\s*\['/.test(line))
  .map(line => line.match(/^\s*\['([^']+)/)[1]);
const ids = new Set();
for (const [id, file] of mapping) {
  if (ids.has(id) || !productNames[id - 1]) throw new Error(`Invalid or duplicate product ID: ${id}`);
  ids.add(id);
  if (!fs.existsSync(path.join(sourceRoot, file))) throw new Error(`Missing source: ${file}`);
}

for (const [id, file] of mapping) {
  const destination = path.join(projectRoot, 'public/images/products', `product-${String(id).padStart(2, '0')}.jpg`);
  execFileSync('sips', ['--resampleHeightWidthMax', '1200', '--setProperty', 'format', 'jpeg', '--setProperty', 'formatOptions', '82', '--out', destination, path.join(sourceRoot, file)], { stdio: 'ignore' });
  console.log(`${id}: ${productNames[id - 1]} ← ${file}`);
}

const creditsPath = path.join(projectRoot, 'PHOTO_CREDITS.md');
let credits = fs.readFileSync(creditsPath, 'utf8');
credits = credits.replace(
  'These are representative photos of product types, not photographs of the fictional UniBasket-branded items.',
  'Catalogue images are representative illustrations of product types, not verified photos of fictional UniBasket-branded items. User-supplied AI-generated images have unspecified usage rights; the remaining photographs retain the source licenses listed below.'
);
credits = credits.replace(/^(\d+)\. \*\*([^*]+)\*\*: .*$/gm, (full, idText, name) => {
  const entry = mapping.find(([id]) => id === Number(idText));
  return entry ? `${idText}. **${name}**: User-supplied AI-generated illustrative image (source file: \`${entry[1]}\`; usage rights not independently verified).` : full;
});
fs.writeFileSync(creditsPath, credits);

const htmlPath = path.join(projectRoot, 'public/photo-credits.html');
let html = fs.readFileSync(htmlPath, 'utf8');
html = html.replace(
  'These are representative photographs of product types, not photographs of fictional UniBasket-branded items. Catalogue images are bundled for offline display. Photos retain their respective licenses.',
  'Catalogue images illustrate product types and are bundled for offline display. Some are user-supplied AI-generated images with usage rights not independently verified; other photos retain the licenses listed below.'
);
html = html.replace(/<tr><td>(\d+)<\/td>.*?<\/tr>/g, (full, idText) => {
  const id = Number(idText);
  if (!ids.has(id)) return full;
  return `<tr><td>${id}</td><td>${productNames[id - 1]}</td><td>User-supplied AI-generated image</td><td>Project owner</td><td>Not specified</td></tr>`;
});
fs.writeFileSync(htmlPath, html);
console.log(`Updated ${mapping.length} product images and both credits lists.`);
