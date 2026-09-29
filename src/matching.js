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

export function makeId(prefix = 'c') {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

export function findWaitingPeer(sockets, selfId, avoidId = null) {
  for (const socket of sockets) {
    if (socket.readyState !== 1) continue;
    const state = socket.deserializeAttachment?.();
    if (!state || state.clientId === selfId) continue;
    if (state.status !== 'waiting') continue;
    if (avoidId && state.clientId === avoidId) continue;
    return socket;
  }
  return null;
}

export function getSafeReason(reason, fallback = 'Connection closed') {
  return typeof reason === 'string' && reason.length < 160 ? reason : fallback;
}
