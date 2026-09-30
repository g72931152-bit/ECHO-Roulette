import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const token = randomBytes(48).toString('hex');
const path = '.dev.vars';
if (!existsSync(path)) {
  writeFileSync(path, `ADMIN_TOKEN=${token}\nADMIN_EMAIL=ptornsaso0@gmail.com\n`, { encoding: 'utf8', flag: 'wx' });
  console.log('Created .dev.vars with a new ADMIN_TOKEN.');
} else {
  console.log('.dev.vars already exists; no secret was replaced.');
}
console.log(`ADMIN_TOKEN=${token}`);
console.log('For production, set the same value as a Cloudflare Worker secret instead of committing it.');
