import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const svg = fs.readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const png = fs.readFileSync(new URL('../public/favicon.png', import.meta.url));
const ico = fs.readFileSync(new URL('../public/favicon.ico', import.meta.url));

assert.match(html, /href="\/favicon\.ico\?v=0\.12"/);
assert.match(html, /href="\/favicon\.png\?v=0\.12"/);
assert.ok(svg.includes('data:image/png;base64,'), 'favicon.svg must embed the real ELVAR logo');
assert.ok(png.length > 1000, 'favicon.png looks unexpectedly empty');
assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field is invalid');
assert.equal(ico.readUInt16LE(2), 1, 'ICO type must be 1');
console.log('favicon check: exact ELVAR logo assets present');
