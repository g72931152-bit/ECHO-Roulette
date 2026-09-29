import assert from 'node:assert/strict';
import { findWaitingPeer, parseClientMessage } from '../src/matching.js';

globalThis.crypto ??= await import('node:crypto').then(m => m.webcrypto);

function fakeSocket(clientId, status = 'waiting') {
  let attachment = { clientId, status, roomId: null, peerId: null };
  return {
    readyState: 1,
    deserializeAttachment() { return attachment; },
    serializeAttachment(next) { attachment = next; }
  };
}

assert.deepEqual(parseClientMessage('{"type":"next"}'), { type: 'next' });
assert.equal(parseClientMessage('nope'), null);
assert.equal(parseClientMessage(JSON.stringify({ nope: true })), null);
assert.equal(parseClientMessage('x'.repeat(64_001)), null);

function runBatch(clientCount) {
  const sockets = Array.from({ length: clientCount }, (_, i) => fakeSocket(`c${i}`));
  const ids = new Set();
  const t0 = performance.now();
  let matches = 0;

  for (let i = 0; i < sockets.length; i += 2) {
    const self = sockets[i];
    const selfId = self.deserializeAttachment().clientId;
    const peer = findWaitingPeer(sockets, selfId);
    assert.ok(peer);
    const peerState = peer.deserializeAttachment();
    assert.ok(peerState && !ids.has(selfId) && !ids.has(peerState.clientId));

    const roomId = `r${i}`;
    ids.add(selfId); ids.add(peerState.clientId);
    self.serializeAttachment({ ...self.deserializeAttachment(), status: 'matched', roomId, peerId: peerState.clientId });
    peer.serializeAttachment({ ...peerState, status: 'matched', roomId, peerId: selfId });
    matches += 1;
  }

  const elapsed = performance.now() - t0;
  assert.equal(matches * 2, clientCount);
  assert.equal(ids.size, clientCount);
  assert.equal(sockets.filter(s => s.deserializeAttachment().status === 'waiting').length, 0);
  return elapsed;
}

const elapsed20k = runBatch(20_000);
const elapsed50k = runBatch(50_000);

const a = fakeSocket('a');
const b = fakeSocket('b');
assert.equal(findWaitingPeer([a, b], 'a', 'b'), null);
assert.equal(findWaitingPeer([a, b], 'a'), b);

console.log(`Stress test OK: 20,000 clients -> 10,000 matches in ${elapsed20k.toFixed(1)} ms`);
console.log(`Stress test OK: 50,000 clients -> 25,000 matches in ${elapsed50k.toFixed(1)} ms`);
console.log('Assertions OK: unique pairing, message limits, avoid-peer behavior, zero unmatched clients.');
