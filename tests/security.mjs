import assert from 'node:assert/strict';
import { hashPassword, randomToken, verifyPassword } from '../src/security.js';

const token = randomToken(48);
assert.equal(token.length, 96, 'admin token generator should create 48 random bytes');
assert.notEqual(randomToken(48), token, 'random tokens should differ');

const password = 'correct horse battery staple';
const record = await hashPassword(password);
assert.equal(record.algorithm, 'PBKDF2-SHA-256');
assert.equal(await verifyPassword(password, record), true);
assert.equal(await verifyPassword('wrong password', record), false);
console.log('security: password hashing and token generation OK');
