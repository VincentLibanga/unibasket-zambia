import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

test('seed contains five categories and 72 products', async () => {
  const seed = await readFile(new URL('database/seed.sql', root), 'utf8');
  const categoryRows = seed.match(/^\([1-5], '[^']+', '[^']+', '[^']+', [1-5]\),?$/gm) || [];
  const productBlock = seed.match(/-- PRODUCTS_BEGIN([\s\S]*?)-- PRODUCTS_END/);
  assert.equal(categoryRows.length, 5);
  assert.ok(productBlock);
  const productRows = productBlock[1].match(/^\(\d+, \d+, '[^']+'/gm) || [];
  assert.equal(productRows.length, 72);
});

test('frontend loads catalogue data from API endpoints', async () => {
  const script = await readFile(new URL('public/script.js', root), 'utf8');
  assert.match(script, /fetch\(["']\/api\/categories["']/);
  assert.match(script, /fetch\(["']\/api\/products\?limit=100["']/);
  assert.doesNotMatch(script, /^const products=\[/m);
});

test('every catalogue item has a bundled JPEG photograph', async () => {
  for (let id = 1; id <= 72; id += 1) {
    const photo = await readFile(new URL(`public/images/products/product-${String(id).padStart(2, '0')}.jpg`, root));
    assert.ok(photo.length > 1000, `Product ${id} photo is too small`);
    assert.deepEqual([...photo.subarray(0, 3)], [0xff, 0xd8, 0xff], `Product ${id} is not a JPEG`);
  }
  const script = await readFile(new URL('public/script.js', root), 'utf8');
  assert.match(script, /<img src=/);
  assert.match(script, /cataloguePhoto\(product\.id\)/);
  assert.match(script, /return ["']images\/products\/product-["']/);
  assert.doesNotMatch(script, /return ["']\/images\/products\/product-["']/);
});

test('course submission contains no PHP implementation', async () => {
  const files = ['README.md', 'server.js', 'routes/categories.js', 'routes/products.js'];
  const combined = (await Promise.all(files.map((file) => readFile(new URL(file, root), 'utf8')))).join('\n');
  assert.doesNotMatch(combined, /\.php\b|password_hash\(|\$_SESSION/);
});

test('small-screen header uses an accessible collapsible menu', async () => {
  const [html, css, script] = await Promise.all([
    readFile(new URL('public/index.html', root), 'utf8'),
    readFile(new URL('public/styles.css', root), 'utf8'),
    readFile(new URL('public/script.js', root), 'utf8')
  ]);
  assert.match(html, /id="menuButton"[^>]*aria-expanded="false"[^>]*aria-controls="headerActions mainNavigation"/);
  assert.match(css, /@media \(max-width: 48rem\)[\s\S]*?\.site-header \.header-search\s*\{\s*display: grid;/);
  assert.match(css, /\.site-header \.header-actions,\s*\.site-header nav\s*\{\s*display: none;\s*\}/);
  assert.match(css, /\.site-header\.menu-open \.header-actions\s*\{\s*display: grid;/);
  assert.match(script, /function toggleMobileMenu\(open\)/);
  assert.match(script, /button\.setAttribute\(["']aria-expanded["'],\s*String\(expanded\)\)/);
});
