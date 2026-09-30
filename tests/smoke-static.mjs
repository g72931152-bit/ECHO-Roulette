import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('../public/style.css', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(pkg.version, '1.0.12');
assert(html.includes('/elvar-logo.png'));
assert(css.includes('.console-logo'));
assert(css.includes('.search-orbit'));
assert(!html.includes('visual-person'));
assert(!html.includes('person-a'));
assert(!html.includes('person-b'));
assert(app.includes("state.audio && state.audio.ctx?.state !== 'closed'"));
assert(app.includes("pointercancel"));
assert(app.includes("event.key !== 'Escape'"));
console.log('static smoke: v1/0.12, logo, no human figures, audio-graph guard, UI safety hooks OK');
