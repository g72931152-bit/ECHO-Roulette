import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wrangler = JSON.parse(await readFile(new URL('../wrangler.jsonc', import.meta.url), 'utf8').then(x=>x.replace(/^\s*\/\*.*?\*\//s,'')));
assert(wrangler.compatibility_date <= '2026-09-29', 'compatibility date must not be near/future for the previous deployment context');
assert.equal(wrangler.durable_objects.bindings[0].class_name, 'Lobby');
assert.equal(wrangler.exports.Lobby.storage, 'sqlite');
const matching = await readFile(new URL('../src/matching.js', import.meta.url), 'utf8');
assert(matching.includes('<= 9_000'), 'profile image must fit WebSocket attachment budget');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
assert(app.includes('reactionSoundsToggle'));
assert(app.includes('playoutDelayHint'));
assert(app.includes('chat-ack'));
assert(app.includes('messageId'));
assert(app.includes('remoteTitle'));
assert(matching.includes('findWaitingPeer'));
console.log('project invariants: OK');
