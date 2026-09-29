import { DurableObject } from 'cloudflare:workers';
import {
  ANY_COUNTRY,
  cleanText,
  findWaitingPeer,
  makeId,
  normalizeProfile,
  parseClientMessage,
} from './matching.js';

const MAX_MESSAGE_BYTES = 64_000;
const MAX_CHAT = 1_000;
const MAX_REPORT_REASON = 240;
const MAX_FEEDBACK = 2_000;
const MAX_REPORTS = 500;
const HEARTBEAT_MAX_MS = 60_000;
const DEFAULT_OWNER_EMAIL = 'ptornsaso0@gmail.com';

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
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function ownerEmail(env) {
  return (env.ADMIN_EMAIL || DEFAULT_OWNER_EMAIL).trim().toLowerCase();
}

async function readJson(request) {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const id = env.LOBBY.idFromName('global-lobby');
      const response = await env.LOBBY.get(id).fetch(new Request(new URL('/health', request.url), { headers: request.headers }));
      return response;
    }

    if (url.pathname === '/ws') {
      if (!isWebSocketRequest(request)) return json({ error: 'websocket_required' }, { status: 426 });
      if (!sameOrigin(request)) return json({ error: 'origin_not_allowed' }, { status: 403 });

      const id = env.LOBBY.idFromName('global-lobby');
      const headers = new Headers(request.headers);
      const cfCountry = request.cf?.country || headers.get('CF-IPCountry') || 'ZZ';
      headers.set('x-elvar-geo-country', String(cfCountry).toUpperCase());
      return env.LOBBY.get(id).fetch(new Request(request, { headers }));
    }

    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      const body = await readJson(request);
      if (!body) return json({ ok: false, error: 'invalid_json' }, { status: 400 });
      const id = env.LOBBY.idFromName('global-lobby');
      return env.LOBBY.get(id).fetch(new Request(new URL('/feedback', request.url), {
        method: 'POST',
        headers: request.headers,
        body: JSON.stringify(body),
      }));
    }

    if (url.pathname === '/api/admin' || url.pathname === '/api/admin/') {
      if (!['GET', 'POST'].includes(request.method)) return json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
      const id = env.LOBBY.idFromName('global-lobby');
      return env.LOBBY.get(id).fetch(new Request(new URL('/admin', request.url), request));
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

    if (url.pathname === '/health') {
      const sockets = this.ctx.getWebSockets('lobby');
      const active = sockets.filter((ws) => ws.readyState === 1).length;
      return json({ ok: true, service: 'elvar', activeConnections: active, time: new Date().toISOString() });
    }

    if (url.pathname === '/feedback' && request.method === 'POST') {
      return this.saveFeedback(request);
    }

    if (url.pathname === '/admin') {
      return this.adminRequest(request);
    }

    if (!isWebSocketRequest(request)) return json({ error: 'websocket_required' }, { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const clientId = makeId('client');
    const avoidId = url.searchParams.get('avoid') || null;
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
      avoidId,
      joinedAt: Date.now(),
      lastChatAt: 0,
      lastActivityAt: Date.now(),
      away: false,
      role: null,
    };

    this.ctx.acceptWebSocket(server, ['lobby']);
    server.serializeAttachment(state);
    this.send(server, { type: 'ready', clientId, geoCountry });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return this.close(ws, 4002, 'Invalid session');
    state.lastActivityAt = Date.now();
    ws.serializeAttachment(state);

    const size = typeof raw === 'string' ? new TextEncoder().encode(raw).byteLength : raw?.byteLength ?? 0;
    if (size > MAX_MESSAGE_BYTES) return this.close(ws, 4003, 'Message too large');

    if (raw === 'ping') {
      this.send(ws, { type: 'pong', serverTs: Date.now() });
      return;
    }

    const message = parseClientMessage(raw);
    if (!message) return this.close(ws, 4004, 'Invalid message');

    switch (message.type) {
      case 'hello':
        await this.hello(ws, state, message);
        break;
      case 'signal':
        this.relaySignal(ws, state, message.payload);
        break;
      case 'chat':
        this.relayChat(ws, state, message.text);
        break;
      case 'reaction':
        this.relayReaction(ws, state, message.sound);
        break;
      case 'away':
        this.setAway(ws, state, Boolean(message.value));
        break;
      case 'profile':
        this.updateProfile(ws, state, message.profile);
        break;
      case 'next':
        await this.next(ws, state);
        break;
      case 'report':
        await this.report(ws, state, message.reason);
        break;
      case 'ping':
        this.send(ws, { type: 'pong', clientTs: Number.isFinite(message.clientTs) ? message.clientTs : null, serverTs: Date.now() });
        break;
      default:
        this.send(ws, { type: 'error', code: 'unknown_message' });
    }
  }

  async hello(ws, state, message) {
    if (state.ready) return;
    const profile = normalizeProfile(message.profile || {});
    const targetCountry = cleanText(message.targetCountry, 3, ANY_COUNTRY).toUpperCase();
    state.profile = profile;
    state.profileId = profile.profileId;
    state.targetCountry = /^[A-Z]{2,3}$/.test(targetCountry) ? targetCountry : ANY_COUNTRY;
    state.ready = true;
    state.status = 'waiting';
    state.away = false;
    ws.serializeAttachment(state);

    if (await this.isBanned(profile.profileId)) {
      this.send(ws, { type: 'banned', until: await this.ctx.storage.get(`ban:${profile.profileId}`) });
      return this.close(ws, 4403, 'Banned');
    }

    this.send(ws, { type: 'searching' });
    this.tryMatch(ws);
  }

  async isBanned(profileId) {
    if (!profileId) return false;
    const value = await this.ctx.storage.get(`ban:${profileId}`);
    if (!value) return false;
    if (value.expiresAt && value.expiresAt < Date.now()) {
      await this.ctx.storage.delete(`ban:${profileId}`);
      return false;
    }
    return true;
  }

  relaySignal(ws, state, payload) {
    if (!payload || typeof payload !== 'object') return;
    if (!state.peerId || state.status !== 'matched') return;
    const peer = this.findByClientId(state.peerId);
    if (!peer) {
      this.send(ws, { type: 'peer-left' });
      return;
    }
    const safePayload = {
      description: payload.description ?? null,
      candidate: payload.candidate ?? null,
      kind: typeof payload.kind === 'string' ? payload.kind : 'unknown',
    };
    this.send(peer, { type: 'signal', payload: safePayload });
  }

  relayChat(ws, state, text) {
    if (!state.peerId || state.status !== 'matched') return;
    const now = Date.now();
    if (now - (state.lastChatAt || 0) < 180) return;
    const clean = cleanText(text, MAX_CHAT);
    if (!clean) return;
    state.lastChatAt = now;
    ws.serializeAttachment(state);
    const peer = this.findByClientId(state.peerId);
    if (peer) this.send(peer, { type: 'chat', text: clean, sentAt: now });
  }

  relayReaction(ws, state, sound) {
    if (!state.peerId || state.status !== 'matched') return;
    const allowed = new Set(['duck', 'pop', 'bell', 'laser', 'boing']);
    if (!allowed.has(sound)) return;
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

  updateProfile(ws, state, rawProfile) {
    if (!state.ready) return;
    const next = normalizeProfile({ ...(state.profile || {}), ...(rawProfile || {}), profileId: state.profileId });
    state.profile = next;
    ws.serializeAttachment(state);
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
    const first = {
      ...state,
      status: 'matched',
      roomId,
      peerId: peerState.clientId,
      avoidId: null,
      role: 'caller',
    };
    const second = {
      ...peerState,
      status: 'matched',
      roomId,
      peerId: state.clientId,
      avoidId: null,
      role: 'callee',
    };

    triggerSocket.serializeAttachment(first);
    peer.serializeAttachment(second);

    this.send(triggerSocket, {
      type: 'matched',
      roomId,
      peerId: peerState.clientId,
      role: 'caller',
      peer: this.publicProfile(peerState),
      peerCountry: peerState.geoCountry,
    });
    this.send(peer, {
      type: 'matched',
      roomId,
      peerId: state.clientId,
      role: 'callee',
      peer: this.publicProfile(state),
      peerCountry: state.geoCountry,
    });
  }

  publicProfile(state) {
    const profile = { ...(state.profile || {}) };
    delete profile.email;
    return {
      profile,
      country: state.geoCountry || 'ZZ',
      away: Boolean(state.away),
      isOwner: Boolean(profile && this.env && ownerEmail(this.env) === String(state.profile?.email || '').toLowerCase()),
    };
  }

  async next(ws, state) {
    const peer = this.findByClientId(state.peerId);
    const previousPeerId = state.peerId;

    if (peer) {
      const peerState = peer.deserializeAttachment();
      if (peerState) {
        const nextPeerState = {
          ...peerState,
          status: 'waiting',
          roomId: null,
          peerId: null,
          role: null,
          avoidId: state.clientId,
          away: false,
        };
        peer.serializeAttachment(nextPeerState);
        this.send(peer, { type: 'peer-left', reason: 'next' });
        this.send(peer, { type: 'searching' });
        this.tryMatch(peer);
      }
    }

    const nextState = {
      ...state,
      status: 'waiting',
      roomId: null,
      peerId: null,
      role: null,
      avoidId: previousPeerId || state.avoidId || null,
      away: false,
    };
    ws.serializeAttachment(nextState);
    this.send(ws, { type: 'peer-left', reason: 'next' });
    this.send(ws, { type: 'searching' });
    this.tryMatch(ws);
  }

  async webSocketClose(ws) {
    await this.onDisconnect(ws);
  }

  async webSocketError(ws) {
    await this.onDisconnect(ws);
  }

  async onDisconnect(ws) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return;

    const peer = this.findByClientId(state.peerId);
    if (!peer) return;
    const peerState = peer.deserializeAttachment();
    if (!peerState) return;

    const nextState = {
      ...peerState,
      status: 'waiting',
      roomId: null,
      peerId: null,
      role: null,
      avoidId: state.clientId,
      away: false,
    };
    peer.serializeAttachment(nextState);
    this.send(peer, { type: 'peer-left', reason: 'disconnect' });
    this.send(peer, { type: 'searching' });
    this.tryMatch(peer);
  }

  findByClientId(clientId) {
    if (!clientId) return null;
    for (const socket of this.ctx.getWebSockets('lobby')) {
      const state = socket.deserializeAttachment();
      if (state?.clientId === clientId) return socket;
    }
    return null;
  }

  async report(ws, state, reason) {
    if (!state.peerId) {
      this.send(ws, { type: 'error', code: 'no_peer' });
      return;
    }
    const cleanReason = cleanText(reason, MAX_REPORT_REASON, 'Не указано');
    const peer = this.findByClientId(state.peerId);
    const peerState = peer?.deserializeAttachment?.() || null;
    const entry = {
      id: makeId('report'),
      createdAt: Date.now(),
      reporter: this.publicUserForAdmin(state),
      reported: peerState ? this.publicUserForAdmin(peerState) : { clientId: state.peerId },
      reason: cleanReason,
    };
    const reportKey = `report:${entry.createdAt}:${entry.id}`;
    const current = (await this.ctx.storage.get('reportCount')) || 0;
    if (current < MAX_REPORTS) {
      await this.ctx.storage.put(reportKey, entry);
      await this.ctx.storage.put('reportCount', current + 1);
    }

    if (peer) {
      this.send(peer, { type: 'reported_disconnect' });
      this.close(peer, 4102, 'Report submitted');
    }
    this.send(ws, { type: 'report-saved', emailHandled: Boolean(this.env.EMAIL && this.env.SUPPORT_FROM) });
    await this.maybeEmail('Жалоба в ELVAR', this.formatReportMail(entry));
  }

  async saveFeedback(request) {
    const body = await readJson(request);
    const kind = cleanText(body?.kind, 40, 'feedback');
    const message = cleanText(body?.message, MAX_FEEDBACK);
    const email = cleanText(body?.email, 160);
    const name = cleanText(body?.name, 80);
    if (!message) return json({ ok: false, error: 'message_required' }, { status: 400 });

    const entry = {
      id: makeId('feedback'),
      createdAt: Date.now(),
      kind,
      message,
      email,
      name,
    };
    await this.ctx.storage.put(`feedback:${entry.createdAt}:${entry.id}`, entry);
    await this.maybeEmail('Обратная связь ELVAR', this.formatFeedbackMail(entry));
    return json({ ok: true, emailHandled: Boolean(this.env.EMAIL && this.env.SUPPORT_FROM) });
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
      joinedAt: state.joinedAt,
    };
  }

  async adminRequest(request) {
    const token = request.headers.get('x-admin-token') || '';
    const expected = this.env.ADMIN_TOKEN || '';
    if (!expected || token !== expected) return json({ ok: false, error: 'admin_unauthorized' }, { status: 401 });

    if (request.method === 'GET') {
      const users = this.ctx.getWebSockets('lobby')
        .map((ws) => ws.deserializeAttachment?.())
        .filter((state) => state?.ready && wsReadyState(this.ctx, state.clientId))
        .map((state) => this.publicUserForAdmin(state));
      const reports = await this.listByPrefix('report:', 80);
      const feedback = await this.listByPrefix('feedback:', 80);
      const bans = await this.listByPrefix('ban:', 80);
      return json({ ok: true, ownerEmail: ownerEmail(this.env), users, reports, feedback, bans });
    }

    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
    const body = await readJson(request);
    const action = cleanText(body?.action, 30);
    if (action === 'ban') return this.adminBan(body);
    if (action === 'unban') return this.adminUnban(body);
    if (action === 'clear-report') return this.adminClear('report:', body?.id);
    if (action === 'clear-feedback') return this.adminClear('feedback:', body?.id);
    return json({ ok: false, error: 'unknown_action' }, { status: 400 });
  }

  async adminBan(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    const minutes = Math.max(1, Math.min(43_200, Number(body?.minutes) || 60));
    const entry = { profileId, createdAt: Date.now(), expiresAt: Date.now() + minutes * 60_000, reason: cleanText(body?.reason, 240, 'Администратор') };
    await this.ctx.storage.put(`ban:${profileId}`, entry);

    for (const ws of this.ctx.getWebSockets('lobby')) {
      const state = ws.deserializeAttachment?.();
      if (state?.profileId === profileId) {
        this.send(ws, { type: 'banned', until: entry });
        this.close(ws, 4403, 'Banned');
      }
    }
    return json({ ok: true, ban: entry });
  }

  async adminUnban(body) {
    const profileId = cleanText(body?.profileId, 80);
    if (!profileId) return json({ ok: false, error: 'profile_required' }, { status: 400 });
    await this.ctx.storage.delete(`ban:${profileId}`);
    return json({ ok: true });
  }

  async adminClear(prefix, id) {
    const target = cleanText(id, 120);
    if (!target) return json({ ok: false, error: 'id_required' }, { status: 400 });
    const entries = await this.ctx.storage.list({ prefix });
    for (const [key, value] of entries) {
      if (value?.id === target) {
        await this.ctx.storage.delete(key);
        return json({ ok: true });
      }
    }
    return json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  async listByPrefix(prefix, limit) {
    const values = [];
    for (const [, value] of await this.ctx.storage.list({ prefix, limit, reverse: true })) values.push(value);
    return values;
  }

  async maybeEmail(subject, text) {
    if (!this.env.EMAIL || !this.env.SUPPORT_FROM) return;
    try {
      await this.env.EMAIL.send({
        to: ownerEmail(this.env),
        from: this.env.SUPPORT_FROM,
        subject,
        text,
      });
    } catch (error) {
      console.error('Email delivery failed', error?.code || '', error?.message || error);
    }
  }

  formatReportMail(entry) {
    return [
      'ELVAR report',
      `Time: ${new Date(entry.createdAt).toISOString()}`,
      `Reporter: ${entry.reporter.name} (${entry.reporter.email || 'no email'})`,
      `Reported: ${entry.reported.name || 'unknown'} (${entry.reported.profileId || entry.reported.clientId || 'unknown'})`,
      `Reason: ${entry.reason}`,
    ].join('\n');
  }

  formatFeedbackMail(entry) {
    return [
      'ELVAR feedback',
      `Time: ${new Date(entry.createdAt).toISOString()}`,
      `Kind: ${entry.kind}`,
      `Name: ${entry.name || 'anonymous'}`,
      `Email: ${entry.email || 'not provided'}`,
      '',
      entry.message,
    ].join('\n');
  }

  send(ws, payload) {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify(payload));
    } catch {}
  }

  close(ws, code, reason) {
    try { ws.close(code, cleanText(reason, 120, 'Connection closed')); } catch {}
  }
}

function wsReadyState(ctx, clientId) {
  return ctx.getWebSockets('lobby').some((ws) => ws.readyState === 1 && ws.deserializeAttachment?.()?.clientId === clientId);
}
