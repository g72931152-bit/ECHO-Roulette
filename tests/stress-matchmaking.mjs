import assert from 'node:assert/strict';
import { compatible } from '../src/matching.js';

function buildIndex(pool) {
  const byCountryTarget = new Map();
  const byTarget = new Map();
  const anyTarget = [];
  const key = (country, target) => `${country}|${target}`;
  for (const user of pool) {
    const k = key(user.country, user.targetCountry);
    if (!byCountryTarget.has(k)) byCountryTarget.set(k, []);
    byCountryTarget.get(k).push(user);
    if (!byTarget.has(user.targetCountry)) byTarget.set(user.targetCountry, []);
    byTarget.get(user.targetCountry).push(user);
    if (user.targetCountry === 'ANY') anyTarget.push(user);
  }
  return { byCountryTarget, byTarget, anyTarget, key };
}

function matchIndexed(pool) {
  const idx = buildIndex(pool);
  const used = new Set();
  const pairs = [];
  const take = (candidates, first) => {
    for (const candidate of candidates || []) {
      if (candidate === first || used.has(candidate.clientId)) continue;
      if (candidate.avoidId === first.clientId || first.avoidId === candidate.clientId) continue;
      if (compatible(first, candidate)) return candidate;
    }
    return null;
  };
  for (const first of pool) {
    if (used.has(first.clientId)) continue;
    let found = null;
    if (first.targetCountry === 'ANY') {
      found = take(idx.anyTarget, first) || take(idx.byTarget.get(first.country), first);
    } else {
      found = take(idx.byCountryTarget.get(idx.key(first.targetCountry, 'ANY')), first)
        || take(idx.byCountryTarget.get(idx.key(first.targetCountry, first.country)), first);
    }
    if (!found) continue;
    used.add(first.clientId);
    used.add(found.clientId);
    pairs.push([first, found]);
  }
  return pairs;
}

function pool(size) {
  const countries = ['TR','DE','US','GB','FR','PL','RU','KZ'];
  return Array.from({length:size},(_,i)=>({
    clientId:`c${i}`,
    country:countries[i%countries.length],
    targetCountry:i%7===0?'ANY':countries[(i+1)%countries.length],
    avoidId:i%17===0?`c${Math.max(0,i-1)}`:null,
  }));
}

for (const size of [2_000, 20_000, 50_000, 100_000]) {
  const p = pool(size);
  const pairs = matchIndexed(p);
  const ids = new Set(pairs.flat().map(x=>x.clientId));
  assert.equal(ids.size, pairs.length * 2);
}

assert.equal(compatible({country:'TR',targetCountry:'DE'},{country:'DE',targetCountry:'TR'}),true);
assert.equal(compatible({country:'TR',targetCountry:'DE'},{country:'FR',targetCountry:'TR'}),false);
assert.equal(compatible({country:'TR',targetCountry:'ANY'},{country:'DE',targetCountry:'TR'}),true);
assert.equal(compatible({country:'TR',targetCountry:'TR'},{country:'TR',targetCountry:'TR'}),true);

console.log('stress: OK — 2k/20k/50k/100k synthetic users, indexed pairing + compatibility');
