const ANY_COUNTRY = 'ANY';

export function parseClientMessage(message) {
  if (typeof message !== 'string') return null;
  if (message.length > 64_000) return null;
  try {
    const value = JSON.parse(message);
    if (!value || typeof value !== 'object' || typeof value.type !== 'string') return null;
    return value;
  } catch {
    return null;
  }
}

export function makeId(prefix = 'id') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

export function cleanText(value, max, fallback = '') {
  return typeof value === 'string' ? value.trim().slice(0, max) : fallback;
}

export function normalizeCountry(value, fallback = ANY_COUNTRY) {
  const v = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return /^[A-Z]{2,3}$/.test(v) ? v : fallback;
}

export function normalizeProfile(profile = {}) {
  return {
    profileId: cleanText(profile.profileId, 80) || makeId('profile'),
    name: cleanText(profile.name, 32, 'Гость'),
    email: cleanText(profile.email, 160).toLowerCase(),
    country: normalizeCountry(profile.country, 'TR'),
    bio: cleanText(profile.bio, 180),
    avatar: cleanText(profile.avatar, 12, '◉'),
    image: typeof profile.image === 'string' && profile.image.length <= 9_000 ? profile.image : '',
  };
}

export function compatible(a, b) {
  if (!a || !b) return false;
  const aTarget = a.targetCountry || ANY_COUNTRY;
  const bTarget = b.targetCountry || ANY_COUNTRY;
  const aCountry = a.country || ANY_COUNTRY;
  const bCountry = b.country || ANY_COUNTRY;
  return (aTarget === ANY_COUNTRY || aTarget === bCountry)
    && (bTarget === ANY_COUNTRY || bTarget === aCountry);
}

export function findWaitingPeer(sockets, selfId, avoidId = null, selfState = null) {
  for (const socket of sockets) {
    if (socket.readyState !== 1) continue;
    const state = socket.deserializeAttachment?.();
    if (!state || state.clientId === selfId) continue;
    if (state.status !== 'waiting' || !state.ready) continue;
    if (avoidId && state.clientId === avoidId) continue;
    if (selfState && !compatible(selfState, state)) continue;
    return socket;
  }
  return null;
}

export { ANY_COUNTRY };
