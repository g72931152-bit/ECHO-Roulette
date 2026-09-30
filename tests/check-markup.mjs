import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]);
const set = new Set(ids);
assert.equal(ids.length, set.size, 'duplicate ids in HTML');
for (const m of js.matchAll(/\$\('([^']+)'\)/g)) assert(set.has(m[1]), `JS expects missing #${m[1]}`);
assert(html.includes('/app.js') && html.includes('/style.css'));
console.log(`markup: ${ids.length} ids OK`);
