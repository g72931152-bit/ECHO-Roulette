import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const worker = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

for (const phrase of ['groupsBtn','favoritesBtn','authModal','adminUnlockModal','favoritePeerBtn','reportCategoryGrid','adminReportedUsers']) assert(html.includes(`id="${phrase}"`), `missing #${phrase}`);
for (const route of ["'/auth/register'", "'/auth/login'", "'/favorites'", "'/groups'", "'/feedback'", "'/admin'"]) assert(worker.includes(route), `missing worker route ${route}`);
for (const phrase of ['reporterCount','frequentReporter','reportedUsers','adminForceNext','adminDeleteUser']) assert(worker.includes(phrase), `missing feature ${phrase}`);
const security = await readFile(new URL('../src/security.js', import.meta.url), 'utf8');
assert(security.includes('PBKDF2-SHA-256'));
assert(security.includes('deriveBits'));
for (const phrase of ['state.authToken','state.favoriteIds','setSocialTab','renderReportCategories','openAdminUnlock']) assert(app.includes(phrase), `missing client feature ${phrase}`);
console.log('feature checks: auth, social, reports and admin hooks present');
