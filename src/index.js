import { DurableObject } from 'cloudflare:workers';
import {
  ANY_COUNTRY,
  cleanText,
  findWaitingPeer,
  makeId,
  normalizeCountry,
  normalizeProfile,
  parseClientMessage,
} from './matching.js';
import {
  hashPassword,
  normalizeEmail,
  randomToken,
  sha256Hex,
  validEmail,
  verifyPassword,
} from './security.js';

const MAX_MESSAGE_BYTES = 64_000;
const MAX_CHAT = 1_000;
const MAX_REPORT_DETAILS = 1_000;
const MAX_FEEDBACK = 2_000;
const MAX_PROFILE_IMAGE = 9_000;
const SESSION_DAYS = 30;
const ADMIN_EMAIL = 'ptornsaso0@gmail.com';
const REPORT_CATEGORIES = new Set([
  'nudity', 'sexual', 'harassment', 'hate', 'spam', 'scam', 'dangerous', 'underage', 'other',
]);

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(init.headers || {}),
    },
  });
}

function isWebSocketRequest(request) {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}

async function readJson(request) {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value : null;
  } catch { return null; }
}

function publicAccount(user) {
  if (!user) return null;
  return {
    profileId: user.profileId,
    name: user.name || 'Гость',
    email: user.email || '',
    country: user.country || 'TR',
    bio: user.bio || '',
    avatar: user.avatar || '◉',
    image: user.image || '',
    registered: Boolean(user.registered),
    createdAt: user.createdAt || null,
    lastSeenAt: user.lastSeenAt || null,
  };
}

function ownerEmail(env) {
  return normalizeEmail(env.ADMIN_EMAIL || ADMIN_EMAIL);
}

async function constantTimeTokenMatch(actual, expected) {
  if (!actual || !expected || actual.length !== expected.length) return false;
  const a = new TextEncoder().encode(actual);
  const b = new TextEncoder().encode(expected);
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) diff |= a[index] ^ b[index];
  return diff === 0;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const id = env.LOBBY.idFromName('global-lobby');
      return env.LOBBY.get(id).fetch(new Request(new URL('/health', request.url), { headers: request.headers }));
    }

    if (url.pathname === '/ws') {
      if (!isWebSocketRequest(request)) return json({ error: 'websocket_required' }, { status: 426 });
      if (!sameOrigin(request)) return json({ error: 'origin_not_allowed' }, { status: 403 });
      const id = env.LOBBY.idFromName('global-lobby');
      const headers = new Headers(request.headers);
      headers.set('x-elvar-geo-country', String(request.cf?.country || headers.get('CF-IPCountry') || 'ZZ').toUpperCase());
      return env.LOBBY.get(id).fetch(new Request(request, { headers }));
    }

    if (url.pathname.startsWith('/api/')) {
      const id = env.LOBBY.idFromName('global-lobby');
      const internal = new URL(request.url);
      internal.pathname = internal.pathname.replace(/^\/api/, '') || '/';
      return env.LOBBY.get(id).fetch(new Request(internal, request));
    }

    return env.ASSETS.fetch(request);
  },
};

export class Lobby extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return this.health();
    if (url.pathname === '/auth/register' && request.method === 'POST') return this.register(request);
    if (url.pathname === '/auth/login' && request.method === 'POST') return this.login(request);
    if (url.pathname === '/auth/me' && request.method === 'GET') return this.me(request);
    if (url.pathname === '/auth/logout' && request.method === 'POST') return this.logout(request);
    if (url.pathname === '/favorites' && ['GET', 'POST'].includes(request.method)) return this.favoritesRequest(request);
    if (url.pathname === '/groups' && ['GET', 'POST'].includes(request.method)) return this.groupsRequest(request);
    if (url.pathname.startsWith('/groups/') && request.method === 'POST') return this.groupAction(request, url);
    if (url.pathname === '/feedback' && request.method === 'POST') return this.saveFeedback(request);
    if (url.pathname === '/admin' && ['GET', 'POST'].includes(request.method)) return this.adminRequest(request);

    if (!isWebSocketRequest(request)) return json({ error: 'websocket_required' }, { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const clientId = makeId('client');
    const geoCountry = cleanText(request.headers.get('x-elvar-geo-country'), 3, 'ZZ').toUpperCase();
    const state = {
      clientId,
      profileId: null,
      profile: null,
      targetCountry: ANY_COUNTRY,
      geoCountry,
      ready: false,
      status: 'waiting',
      roomId: null,
      peerId: null,
      avoidId: url.searchParams.get('avoid') || null,
      joinedAt: Date.now(),
      lastChatAt: 0,
      lastReportAt: 0,
      lastActivityAt: Date.now(),
      away: false,
      role: null,
      registered: false,
    };

    this.ctx.acceptWebSocket(server, ['lobby']);
    server.serializeAttachment(state);
    this.send(server, { type: 'ready', clientId, geoCountry });
    return new Response(null, { status: 101, webSocket: client });
  }

  async health() {
    const sockets = this.ctx.getWebSockets('lobby');
    const online = sockets.filter((ws) => ws.readyState === 1).length;
    const userCount = await this.countByPrefix('user:');
    return json({ ok: true, service: 'elvar', online, registeredAccounts: userCount, time: new Date().toISOString() });
  }

  async register(request) {
    const body = await readJson(request);
    const name = cleanText(body?.name, 32);
    const email = normalizeEmail(body?.email);
    const country = normalizeCountry(body?.country, 'TR');
    const password = typeof body?.password === 'string' ? body.password : '';
    if (name.length < 2) return json({ ok: false, error: 'name_required' }, { status: 400 });
    if (!validEmail(email)) return json({ ok: false, error: 'invalid_email' }, { status: 400 });
    if (password.length < 8) return json({ ok: false, error: 'password_too_short' }, { status: 400 });
    const existing = await this.ctx.storage.get(`email:${email}`);
    if (existing) return json({ ok: false, error: 'email_taken' }, { status: 409 });

    const profileId = makeId('profile');
    const passwordHash = await hashPassword(password);
    const user = {
      profileId, name, email, country, bio: cleanText(body?.bio, 180), avatar: cleanText(body?.avatar, 12, '◉'),
      image: typeof body?.image === 'string' && body.image.length <= MAX_PROFILE_IMAGE ? body.image : '',
      registered: true, createdAt: Date.now(), lastSeenAt: Date.now(), passwordHash,
    };
    await this.ctx.storage.put(`user:${profileId}`, user);
    await this.ctx.storage.put(`email:${email}`, profileId);
    const token = await this.createSession(profileId);
    return json({ ok: true, token, user: publicAccount(user) }, { status: 201 });
  }

  async login(request) {
    const body = await readJson(request);
    const email = normalizeEmail(body?.email);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!validEmail(email) || !password) return json({ ok: false, error: 'credentials_required' }, { status: 400 });
    const profileId = await this.ctx.storage.get(`email:${email}`);
    const user = profileId ? await this.ctx.storage.get(`user:${profileId}`) : null;
    if (!user || !(await verifyPassword(password, user.passwordHash))) return json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
    user.lastSeenAt = Date.now();
    await this.ctx.storage.put(`user:${profileId}`, user);
    const token = await this.createSession(profileId);
    return json({ ok: true, token, user: publicAccount(user) });
  }

  async me(request) {
    const session = await this.getSession(request);
    if (!session?.user) return json({ ok: false, authenticated: false });
    const reportCount = await this.getReportCount(session.user.profileId);
    return json({ ok: true, authenticated: true, user: publicAccount(session.user), reportCount });
  }

  async logout(request) {
    const token = this.sessionToken(request);
    if (token) await this.ctx.storage.delete(`session:${await sha256Hex(token)}`);
    return json({ ok: true });
  }

  sessionToken(request) {
    const bearer = request.headers.get('Authorization') || '';
    if (bearer.startsWith('Bearer ')) return bearer.slice(7).trim();
    return request.headers.get('x-session-token') || '';
  }

  async createSession(profileId) {
    const token = randomToken(32);
    await this.ctx.storage.put(`session:${await sha256Hex(token)}`, { profileId, expiresAt: Date.now() + SESSION_DAYS * 86_400_000 });
    return token;
  }

  async getSession(request) {
    const token = this.sessionToken(request);
    if (!token) return null;
    const key = `session:${await sha256Hex(token)}`;
    const session = await this.ctx.storage.get(key);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      await this.ctx.storage.delete(key);
      return null;
    }
    const user = await this.ctx.storage.get(`user:${session.profileId}`);
    if (!user) return null;
    return { ...session, token, user };
  }

  async upsertGuestOrUser(profile, authToken = '') {
    const normalized = normalizeProfile(profile || {});
    const sessionRequest = authToken ? new Request('https://elvar.invalid/auth/me', { headers: { 'x-session-token': authToken } }) : null;
    const session = sessionRequest ? await this.getSession(sessionRequest) : null;
    if (session?.user) {
      const user = { ...session.user, ...normalized, profileId: session.user.profileId, email: session.user.email, registered: true, lastSeenAt: Date.now() };
      await this.ctx.storage.put(`user:${user.profileId}`, user);
      return user;
    }

    let user = await this.ctx.storage.get(`user:${normalized.profileId}`);
    if (!user) {
      user = { ...normalized, registered: false, createdAt: Date.now(), lastSeenAt: Date.now() };
    } else {
      user = { ...user, ...normalized, registered: Boolean(user.registered), lastSeenAt: Date.now() };
    }
    await this.ctx.storage.put(`user:${normalized.profileId}`, user);
    if (user.email && validEmail(user.email) && !(await this.ctx.storage.get(`email:${user.email}`))) {
      await this.ctx.storage.put(`email:${user.email}`, user.profileId);
    }
    return user;
  }

  async webSocketMessage(ws, raw) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return this.close(ws, 4002, 'Invalid session');
    state.lastActivityAt = Date.now();
    ws.serializeAttachment(state);
    const size = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw?.byteLength ?? 0;
    if (size > MAX_MESSAGE_BYTES) return this.close(ws, 4003, 'Message too large');
    if (raw === 'ping') { this.send(ws, { type: 'pong', serverTs: Date.now() }); return; }

    const message = parseClientMessage(raw);
    if (!message) return this.close(ws, 4004, 'Invalid message');
    switch (message.type) {
      case 'hello': await this.hello(ws, state, message); break;
      case 'search': if (state.ready && state.status === 'waiting') this.tryMatch(ws); break;
      case 'signal': this.relaySignal(ws, state, message.payload); break;
      case 'chat': this.relayChat(ws, state, message.text, message.messageId); break;
      case 'reaction': this.relayReaction(ws, state, message.sound); break;
      case 'away': this.setAway(ws, state, Boolean(message.value)); break;
      case 'profile': await this.updateProfile(ws, state, message.profile); break;
      case 'next': await this.next(ws, state); break;
      case 'report': await this.report(ws, state, message); break;
      case 'ping': this.send(ws, { type: 'pong', clientTs: Number.isFinite(message.clientTs) ? message.clientTs : null, serverTs: Date.now() }); break;
      default: this.send(ws, { type: 'error', code: 'unknown_message' });
    }
  }

  async hello(ws, state, message) {
    if (state.ready) return;
    const user = await this.upsertGuestOrUser(message.profile || {}, cleanText(message.authToken, 300));
    const targetCountry = normalizeCountry(message.targetCountry, ANY_COUNTRY);
    state.profile = user;
    state.profileId = user.profileId;
    state.targetCountry = targetCountry;
    state.ready = true;
    state.status = 'waiting';
    state.away = false;
    state.registered = Boolean(user.registered);
    ws.serializeAttachment(state);

    if (await this.isBanned(user.profileId)) {
      this.send(ws, { type: 'banned', until: await this.ctx.storage.get(`ban:${user.profileId}`) });
      return this.close(ws, 4403, 'Banned');
    }
    const reportCount = await this.getReportCount(user.profileId);
    this.send(ws, { type: 'searching', reportCount, frequentReporter: reportCount >= 4 });
    this.tryMatch(ws);
  }

  async isBanned(profileId) {
    const value = await this.ctx.storage.get(`ban:${profileId}`);
    if (!value) return false;
    if (value.expiresAt && value.expiresAt < Date.now()) {
      await this.ctx.storage.delete(`ban:${profileId}`);
      return false;
    }
    return true;
  }

  relaySignal(ws, state, payload) {
    if (!payload || typeof payload !== 'object' || !state.peerId || state.status !== 'matched') return;
    const peer = this.findByClientId(state.peerId);
    if (!peer) return this.send(ws, { type: 'peer-left' });
    this.send(peer, { type: 'signal', payload: {
      description: payload.description ?? null,
      candidate: payload.candidate ?? null,
      kind: typeof payload.kind === 'string' ? payload.kind : 'unknown',
    }});
  }

  relayChat(ws, state, text, messageId = null) {
    const cleanId = cleanText(messageId, 80);
    if (!state.peerId || state.status !== 'matched') return this.send(ws, { type: 'chat-ack', messageId: cleanId, accepted: false, reason: 'chat_not_allowed' });
    const now = Date.now();
    if (now - (state.lastChatAt || 0) < 180) return this.send(ws, { type: 'chat-ack', messageId: cleanId, accepted: false, reason: 'chat_rate_limited' });
    const clean = cleanText(text, MAX_CHAT);
    if (!clean) return this.send(ws, { type: 'chat-ack', messageId: cleanId, accepted: false, reason: 'message_empty' });
    state.lastChatAt = now;
    ws.serializeAttachment(state);
    const peer = this.findByClientId(state.peerId);
    if (!peer) return this.send(ws, { type: 'chat-ack', messageId: cleanId, accepted: false, reason: 'peer_left' });
    this.send(peer, { type: 'chat', messageId: cleanId, text: clean, sentAt: now });
    this.send(ws, { type: 'chat-ack', messageId: cleanId, accepted: true, sentAt: now });
  }

  relayReaction(ws, state, sound) {
    if (!state.peerId || state.status !== 'matched') return;
    if (!new Set(['duck', 'pop', 'bell', 'laser', 'boing']).has(sound)) return;
    const peer = this.findByClientId(state.peerId);
    if (peer) this.send(peer, { type: 'reaction', sound });
  }

  setAway(ws, state, away) {
    if (!state.peerId || state.status !== 'matched') return;
    state.away = away;
    ws.serializeAttachment(state);
    const peer = this.findByClientId(state.peerId);
    if (peer) this.send(peer, { type: 'peer-away', value: away });
  }

  async updateProfile(ws, state, rawProfile) {
    if (!state.ready || !state.profileId) return;
    const next = normalizeProfile({ ...(state.profile || {}), ...(rawProfile || {}), profileId: state.profileId });
    const stored = await this.ctx.storage.get(`user:${state.profileId}`);
    const user = { ...(stored || {}), ...next, profileId: state.profileId, email: stored?.email || next.email || '', registered: Boolean(stored?.registered), lastSeenAt: Date.now() };
    state.profile = user;
    state.registered = Boolean(user.registered);
    ws.serializeAttachment(state);
    await this.ctx.storage.put(`user:${state.profileId}`, user);
    if (state.peerId) {
      const peer = this.findByClientId(state.peerId);
      if (peer) this.send(peer, { type: 'peer-profile', ...this.publicProfile(state) });
    }
  }

  tryMatch(triggerSocket) {
    if (triggerSocket.readyState !== 1) return;
    const state = triggerSocket.deserializeAttachment();
    if (!state || state.status !== 'waiting' || !state.ready) return;
    const peer = findWaitingPeer(this.ctx.getWebSockets('lobby'), state.clientId, state.avoidId, state);
    if (!peer) return;
    const peerState = peer.deserializeAttachment();
    if (!peerState || !peerState.ready) return;
    const roomId = makeId('room');
    triggerSocket.serializeAttachment({ ...state, status: 'matched', roomId, peerId: peerState.clientId, avoidId: null, role: 'caller' });
    peer.serializeAttachment({ ...peerState, status: 'matched', roomId, peerId: state.clientId, avoidId: null, role: 'callee' });
    this.send(triggerSocket, { type: 'matched', roomId, peerId: peerState.clientId, role: 'caller', peer: this.publicProfile(peerState), peerCountry: peerState.geoCountry });
    this.send(peer, { type: 'matched', roomId, peerId: state.clientId, role: 'callee', peer: this.publicProfile(state), peerCountry: state.geoCountry });
  }

  publicProfile(state) {
    const profile = { ...(state.profile || {}) };
    delete profile.email;
    delete profile.passwordHash;
    return { profile, country: state.geoCountry || 'ZZ', away: Boolean(state.away), registered: Boolean(state.registered) };
  }

  async next(ws, state) {
    const peer = this.findByClientId(state.peerId);
    const previousPeerId = state.peerId;
    if (peer) {
      const peerState = peer.deserializeAttachment();
      if (peerState) {
        const nextPeerState = { ...peerState, status: 'waiting', roomId: null, peerId: null, role: null, avoidId: state.clientId, away: false };
        peer.serializeAttachment(nextPeerState);
        this.send(peer, { type: 'peer-left', reason: 'next' });
        this.send(peer, { type: 'searching' });
        this.tryMatch(peer);
      }
    }
    ws.serializeAttachment({ ...state, status: 'waiting', roomId: null, peerId: null, role: null, avoidId: previousPeerId || state.avoidId || null, away: false });
    this.send(ws, { type: 'peer-left', reason: 'next' });
    this.send(ws, { type: 'searching' });
    this.tryMatch(ws);
  }

  async webSocketClose(ws) { await this.onDisconnect(ws); }
  async webSocketError(ws) { await this.onDisconnect(ws); }

  async onDisconnect(ws) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return;
    if (state.profileId) {
      const user = await this.ctx.storage.get(`user:${state.profileId}`);
      if (user) { user.lastSeenAt = Date.now(); await this.ctx.storage.put(`user:${state.profileId}`, user); }
    }
    const peer = this.findByClientId(state.peerId);
    if (!peer) return;
    const peerState = peer.deserializeAttachment();
    if (!peerState) return;
    const nextState = { ...peerState, status: 'waiting', roomId: null, peerId: null, role: null, avoidId: state.clientId, away: false };
    peer.serializeAttachment(nextState);
    this.send(peer, { type: 'peer-left', reason: 'disconnect' });
    this.send(peer, { type: 'searching' });
    this.tryMatch(peer);
  }

  findByClientId(clientId) {
    if (!clientId) return null;
    for (const socket of this.ctx.getWebSockets('lobby')) {
      if (socket.readyState !== 1) continue;
      const state = socket.deserializeAttachment();
      if (state?.clientId === clientId) return socket;
    }
    return null;
  }

  async report(ws, state, message) {
    if (!state.peerId || state.status !== 'matched') return this.send(ws, { type: 'error', code: 'no_peer' });
    const now = Date.now();
    if (now - (state.lastReportAt || 0) < 2500) return this.send(ws, { type: 'error', code: 'report_rate_limited' });
    state.lastReportAt = now;
    ws.serializeAttachment(state);

    const peer = this.findByClientId(state.peerId);
    const peerState = peer?.deserializeAttachment?.() || null;
    const category = REPORT_CATEGORIES.has(message.category) ? message.category : 'other';
    const details = cleanText(message.details || message.reason, MAX_REPORT_DETAILS, 'Не указано');
    const reportCount = await this.incrementReportCount(state.profileId);
    const entry = {
      id: makeId('report'), createdAt: now, category, details,
      reporter: this.publicUserForAdmin(state),
      reported: peerState ? this.publicUserForAdmin(peerState) : { clientId: state.peerId },
      reporterCount: reportCount,
    };
    await this.ctx.storage.put(`report:${now}:${entry.id}`, entry);

    if (peer) {
      this.send(peer, { type: 'reported_disconnect' });
      this.close(peer, 4102, 'Report submitted');
    }
    const emailHandled = Boolean(this.env.EMAIL && this.env.SUPPORT_FROM);
    await this.maybeEmail('ELVAR — новая жалоба', this.formatReportMail(entry));
    this.send(ws, { type: 'report-saved', reportCount, emailHandled, frequentReporter: reportCount >= 5, nextRequiresDetails: reportCount >= 4 });
  }

  publicUserForAdmin(state) {
    return {
      clientId: state.clientId,
      profileId: state.profileId,
      name: state.profile?.name || 'Гость',
      email: state.profile?.email || '',
      country: state.profile?.country || '??',
      geoCountry: state.geoCountry || 'ZZ',
      targetCountry: state.targetCountry || ANY_COUNTRY,
      status: state.status,
      away: Boolean(state.away),
      registered: Boolean(state.registered),
      joinedAt: state.joinedAt,
    };
  }

  async incrementReportCount(profileId) {
    if (!profileId) return 0;
    const key = `reportCount:${profileId}`;
    const next = Number(await this.ctx.storage.get(key) || 0) + 1;
    await this.ctx.storage.put(key, next);
    return next;
  }

  async getReportCount(profileId) {
    return Number(await this.ctx.storage.get(`reportCount:${profileId}`) || 0);
  }

  async saveFeedback(request) {
    const body = await readJson(request);
    const kind = cleanText(body?.kind, 40, 'feedback');
    const message = cleanText(body?.message, MAX_FEEDBACK);
    const email = normalizeEmail(body?.email);
    const name = cleanText(body?.name, 80);
    if (!message) return json({ ok: false, error: 'message_required' }, { status: 400 });
    const entry = { id: makeId('feedback'), createdAt: Date.now(), kind, message, email, name };
    await this.ctx.storage.put(`feedback:${entry.createdAt}:${entry.id}`, entry);
    await this.maybeEmail('ELVAR — обратная связь', this.formatFeedbackMail(entry));
    return json({ ok: true, emailHandled: Boolean(this.env.EMAIL && this.env.SUPPORT_FROM) });
  }

  async favoritesRequest(request) {
    const session = await this.getSession(request);
    if (!session?.user) return json({ ok: false, error: 'login_required' }, { status: 401 });
    if (request.method === 'GET') {
      const records = await this.listAllByPrefix(`favorite:${session.user.profileId}:`);
      const profiles = [];
      for (const item of records) {
        const id = item.value?.profileId;
        const user = id ? await this.ctx.storage.get(`user:${id}`) : null;
        if (user) profiles.push(publicAccount(user));
      }
      return json({ ok: true, favorites: profiles });
    }
    const body = await readJson(request);
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId || profileId === session.user.profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    const target = await this.ctx.storage.get(`user:${profileId}`);
    if (!target) return json({ ok: false, error: 'user_not_found' }, { status: 404 });
    const key = `favorite:${session.user.profileId}:${profileId}`;
    if (body?.action === 'remove') await this.ctx.storage.delete(key);
    else await this.ctx.storage.put(key, { profileId, createdAt: Date.now() });
    return json({ ok: true, favorite: body?.action !== 'remove' });
  }

  async groupsRequest(request) {
    if (request.method === 'GET') return json({ ok: true, groups: await this.listPublicGroups() });
    const session = await this.getSession(request);
    if (!session?.user) return json({ ok: false, error: 'login_required' }, { status: 401 });
    const body = await readJson(request);
    const name = cleanText(body?.name, 60);
    const description = cleanText(body?.description, 240);
    const tags = Array.isArray(body?.tags) ? body.tags.map((tag) => cleanText(tag, 24)).filter(Boolean).slice(0, 8) : [];
    if (name.length < 2) return json({ ok: false, error: 'name_required' }, { status: 400 });
    const id = makeId('group');
    const group = { id, name, description, tags, ownerId: session.user.profileId, ownerName: session.user.name, createdAt: Date.now(), members: [session.user.profileId], public: true };
    await this.ctx.storage.put(`group:${id}`, group);
    return json({ ok: true, group: this.publicGroup(group) }, { status: 201 });
  }

  async groupAction(request, url) {
    const id = cleanText(url.pathname.split('/')[2], 80);
    const action = cleanText(url.pathname.split('/')[3], 20);
    const session = await this.getSession(request);
    if (!session?.user) return json({ ok: false, error: 'login_required' }, { status: 401 });
    const group = await this.ctx.storage.get(`group:${id}`);
    if (!group) return json({ ok: false, error: 'group_not_found' }, { status: 404 });
    const members = new Set(group.members || []);
    if (action === 'join') members.add(session.user.profileId);
    else if (action === 'leave') members.delete(session.user.profileId);
    else return json({ ok: false, error: 'unknown_action' }, { status: 400 });
    if (!members.has(group.ownerId)) members.add(group.ownerId);
    group.members = [...members].slice(0, 500);
    await this.ctx.storage.put(`group:${id}`, group);
    return json({ ok: true, group: this.publicGroup(group), joined: members.has(session.user.profileId) });
  }

  publicGroup(group) {
    return { id: group.id, name: group.name, description: group.description, tags: group.tags || [], ownerId: group.ownerId, ownerName: group.ownerName, createdAt: group.createdAt, membersCount: (group.members || []).length };
  }

  async listPublicGroups() {
    const rows = await this.listAllByPrefix('group:');
    return rows.map((item) => this.publicGroup(item.value)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  }

  async adminRequest(request) {
    const expected = this.env.ADMIN_TOKEN || '';
    if (!expected) return json({ ok: false, error: 'admin_not_configured' }, { status: 503 });
    const token = request.headers.get('x-admin-token') || '';
    if (!(await constantTimeTokenMatch(token, expected))) return json({ ok: false, error: 'admin_unauthorized' }, { status: 401 });

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const q = cleanText(url.searchParams.get('q'), 160).toLowerCase();
      const country = cleanText(url.searchParams.get('country'), 3).toUpperCase();
      const onlyOnline = url.searchParams.get('online') === '1';
      const allUsers = (await this.listAllByPrefix('user:')).map((item) => item.value).filter(Boolean);
      const onlineStates = this.ctx.getWebSockets('lobby').filter((ws) => ws.readyState === 1).map((ws) => ws.deserializeAttachment?.()).filter(Boolean);
      const onlineIds = new Set(onlineStates.map((state) => state.profileId));
      const users = allUsers
        .map((user) => ({ ...this.publicUserRecord(user), online: onlineIds.has(user.profileId) }))
        .filter((user) => !q || `${user.name} ${user.email} ${user.profileId}`.toLowerCase().includes(q))
        .filter((user) => !country || user.country === country)
        .filter((user) => !onlyOnline || user.online)
        .sort((a, b) => Number(b.online) - Number(a.online) || (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
      const reports = (await this.listAllByPrefix('report:')).map((x) => x.value).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
      const feedback = (await this.listAllByPrefix('feedback:')).map((x) => x.value).filter(Boolean).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500);
      const bans = (await this.listAllByPrefix('ban:')).map((x) => x.value).filter(Boolean).sort((a, b) => b.expiresAt - a.expiresAt);
      const reportedMap = new Map();
      for (const report of reports) {
        const id = report.reported?.profileId || report.reported?.clientId;
        if (!id) continue;
        const current = reportedMap.get(id) || { profileId: report.reported?.profileId || '', clientId: report.reported?.clientId || '', name: report.reported?.name || 'Неизвестный', email: report.reported?.email || '', count: 0, lastReportedAt: 0 };
        current.count += 1; current.lastReportedAt = Math.max(current.lastReportedAt, report.createdAt || 0);
        if (report.reported?.email) current.email = report.reported.email;
        if (report.reported?.name) current.name = report.reported.name;
        reportedMap.set(id, current);
      }
      const reportedUsers = [...reportedMap.values()].sort((a, b) => b.count - a.count || b.lastReportedAt - a.lastReportedAt);
      const groups = await this.listPublicGroups();
      return json({ ok: true, adminEmail: ownerEmail(this.env), users, onlineUsers: users.filter((user) => user.online), reports, reportedUsers, feedback, bans, groups, stats: { totalUsers: allUsers.length, online: onlineIds.size, reports: reports.length, reportedUsers: reportedUsers.length, feedback: feedback.length, groups: groups.length } });
    }

    const body = await readJson(request);
    const action = cleanText(body?.action, 40);
    if (action === 'ban') return this.adminBan(body);
    if (action === 'unban') return this.adminUnban(body);
    if (action === 'clear-report') return this.adminClear('report:', body?.id);
    if (action === 'clear-feedback') return this.adminClear('feedback:', body?.id);
    if (action === 'delete-user') return this.adminDeleteUser(body);
    if (action === 'force-next') return this.adminForceNext(body);
    return json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  publicUserRecord(user) {
    return {
      profileId: user.profileId, name: user.name || 'Гость', email: user.email || '', country: user.country || 'TR',
      bio: user.bio || '', registered: Boolean(user.registered), createdAt: user.createdAt || null, lastSeenAt: user.lastSeenAt || null,
    };
  }

  async adminBan(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    const minutes = Math.max(1, Math.min(43_200, Number(body?.minutes) || 60));
    const entry = { profileId, createdAt: Date.now(), expiresAt: Date.now() + minutes * 60_000, reason: cleanText(body?.reason, 240, 'Администратор') };
    await this.ctx.storage.put(`ban:${profileId}`, entry);
    for (const ws of this.ctx.getWebSockets('lobby')) {
      const state = ws.deserializeAttachment?.();
      if (state?.profileId === profileId) { this.send(ws, { type: 'banned', until: entry }); this.close(ws, 4403, 'Banned'); }
    }
    return json({ ok: true, ban: entry });
  }

  async adminUnban(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    await this.ctx.storage.delete(`ban:${profileId}`);
    return json({ ok: true });
  }

  async adminDeleteUser(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    const user = await this.ctx.storage.get(`user:${profileId}`);
    if (!user) return json({ ok: false, error: 'not_found' }, { status: 404 });
    await this.ctx.storage.delete(`user:${profileId}`);
    if (user.email) await this.ctx.storage.delete(`email:${user.email}`);
    await this.ctx.storage.delete(`ban:${profileId}`);
    const favorites = await this.listAllByPrefix('favorite:');
    for (const item of favorites) {
      if (item.key === `favorite:${profileId}:` || item.key.startsWith(`favorite:${profileId}:`) || item.value?.profileId === profileId) await this.ctx.storage.delete(item.key);
    }
    return json({ ok: true });
  }

  async adminForceNext(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    for (const ws of this.ctx.getWebSockets('lobby')) {
      const state = ws.deserializeAttachment?.();
      if (state?.profileId === profileId) {
        await this.next(ws, state);
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: 'user_offline' }, { status: 404 });
  }

  async adminClear(prefix, id) {
    const target = cleanText(id, 120);
    if (!target) return json({ ok: false, error: 'id_required' }, { status: 400 });
    for (const item of await this.listAllByPrefix(prefix)) {
      if (item.value?.id === target) { await this.ctx.storage.delete(item.key); return json({ ok: true }); }
    }
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  async listAllByPrefix(prefix) {
    const rows = [];
    let cursor = undefined;
    do {
      const options = { prefix, limit: 1000, reverse: true };
      if (cursor) options.cursor = cursor;
      const page = await this.ctx.storage.list(options);
      for (const [key, value] of page) rows.push({ key, value });
      cursor = page.cursor;
    } while (cursor);
    return rows;
  }

  async countByPrefix(prefix) {
    return (await this.listAllByPrefix(prefix)).length;
  }

  async maybeEmail(subject, text) {
    if (!this.env.EMAIL || !this.env.SUPPORT_FROM) return;
    try {
      await this.env.EMAIL.send({ to: ownerEmail(this.env), from: this.env.SUPPORT_FROM, subject, text });
    } catch (error) {
      console.error('Email delivery failed', error?.code || '', error?.message || error);
    }
  }

  formatReportMail(entry) {
    return [
      'ELVAR report', `Time: ${new Date(entry.createdAt).toISOString()}`,
      `Category: ${entry.category}`, `Reporter: ${entry.reporter.name} (${entry.reporter.email || 'no email'})`,
      `Reported: ${entry.reported.name || 'unknown'} (${entry.reported.profileId || entry.reported.clientId || 'unknown'})`,
      `Reporter report count: ${entry.reporterCount}`, `Details: ${entry.details}`,
    ].join('\n');
  }

  formatFeedbackMail(entry) {
    return [
      'ELVAR feedback', `Time: ${new Date(entry.createdAt).toISOString()}`, `Kind: ${entry.kind}`,
      `Name: ${entry.name || 'anonymous'}`, `Email: ${entry.email || 'not provided'}`, '', entry.message,
    ].join('\n');
  }

  send(ws, payload) { try { if (ws.readyState === 1) ws.send(JSON.stringify(payload)); } catch {} }
  close(ws, code, reason) { try { ws.close(code, cleanText(reason, 120, 'Connection closed')); } catch {} }
}
