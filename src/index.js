import { DurableObject } from 'cloudflare:workers';
import { findWaitingPeer, getSafeReason, makeId, parseClientMessage } from './matching.js';

const MAX_MESSAGE_BYTES = 64_000;
const MAX_REPORT_REASON = 240;
const MAX_REPORTS = 500;

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'echo-roulette', time: new Date().toISOString() });
    }

    if (url.pathname === '/ws') {
      if (!isWebSocketRequest(request)) return json({ error: 'websocket_required' }, { status: 426 });
      if (!sameOrigin(request)) return json({ error: 'origin_not_allowed' }, { status: 403 });

      const id = env.LOBBY.idFromName('global-lobby');
      return env.LOBBY.get(id).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return json({ error: 'not_found' }, { status: 404 });
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
    if (!isWebSocketRequest(request)) {
      return json({ error: 'websocket_required' }, { status: 426 });
    }

    const url = new URL(request.url);
    const clientId = makeId('client');
    const avoidId = url.searchParams.get('avoid') || null;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const state = {
      clientId,
      status: 'waiting',
      roomId: null,
      peerId: null,
      joinedAt: Date.now(),
      avoidId,
    };

    this.ctx.acceptWebSocket(server, ['lobby']);
    server.serializeAttachment(state);
    this.send(server, { type: 'ready', clientId });
    this.send(server, { type: 'searching' });
    this.tryMatch(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return this.close(ws, 4002, 'Invalid session');

    const size = typeof raw === 'string' ? raw.length : raw?.byteLength ?? 0;
    if (size > MAX_MESSAGE_BYTES) return this.close(ws, 4003, 'Message too large');

    const message = parseClientMessage(raw);
    if (!message) return this.close(ws, 4004, 'Invalid message');

    switch (message.type) {
      case 'signal':
        this.relaySignal(ws, state, message.payload);
        break;
      case 'next':
        this.next(ws, state);
        break;
      case 'report':
        await this.report(ws, state, message.reason);
        break;
      case 'ping':
        this.send(ws, { type: 'pong' });
        break;
      default:
        this.send(ws, { type: 'error', code: 'unknown_message' });
    }
  }

  async webSocketClose(ws) {
    await this.onDisconnect(ws, true);
  }

  async webSocketError(ws) {
    await this.onDisconnect(ws, false);
  }

  async onDisconnect(ws, notify = true) {
    const state = ws.deserializeAttachment();
    if (!state?.clientId) return;

    const peer = this.findByClientId(state.peerId);
    if (peer) {
      const peerState = peer.deserializeAttachment();
      if (peerState) {
        const nextState = { ...peerState, status: 'waiting', roomId: null, peerId: null, avoidId: state.clientId };
        peer.serializeAttachment(nextState);
        if (notify) this.send(peer, { type: 'peer-left' });
        this.send(peer, { type: 'searching' });
        this.tryMatch(peer);
      }
    }
  }

  next(ws, state) {
    const peer = this.findByClientId(state.peerId);
    const peerId = state.peerId;

    if (peer) {
      const peerState = peer.deserializeAttachment();
      if (peerState) {
        const nextPeerState = {
          ...peerState,
          status: 'waiting',
          roomId: null,
          peerId: null,
          avoidId: state.clientId,
        };
        peer.serializeAttachment(nextPeerState);
        this.send(peer, { type: 'peer-left' });
        this.send(peer, { type: 'searching' });
      }
    }

    const nextState = {
      ...state,
      status: 'waiting',
      roomId: null,
      peerId: null,
      avoidId: peerId || state.avoidId || null,
    };
    ws.serializeAttachment(nextState);
    this.send(ws, { type: 'searching' });
    this.tryMatch(ws);
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

  tryMatch(triggerSocket) {
    if (triggerSocket.readyState !== 1) return;
    const state = triggerSocket.deserializeAttachment();
    if (!state || state.status !== 'waiting') return;

    const peer = findWaitingPeer(this.ctx.getWebSockets('lobby'), state.clientId, state.avoidId);
    if (!peer) return;

    const peerState = peer.deserializeAttachment();
    if (!peerState) return;

    const roomId = makeId('room');
    const first = {
      ...state,
      status: 'matched',
      roomId,
      peerId: peerState.clientId,
      avoidId: null,
    };
    const second = {
      ...peerState,
      status: 'matched',
      roomId,
      peerId: state.clientId,
      avoidId: null,
    };

    triggerSocket.serializeAttachment(first);
    peer.serializeAttachment(second);

    this.send(triggerSocket, { type: 'matched', roomId, peerId: peerState.clientId, role: 'caller' });
    this.send(peer, { type: 'matched', roomId, peerId: state.clientId, role: 'callee' });
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
    const cleanReason = typeof reason === 'string' ? reason.slice(0, MAX_REPORT_REASON) : 'unspecified';
    const reportKey = `report:${Date.now()}:${state.clientId}`;
    const current = (await this.ctx.storage.get('reportCount')) || 0;
    if (current < MAX_REPORTS) {
      await this.ctx.storage.put(reportKey, {
        createdAt: Date.now(),
        clientId: state.clientId,
        peerId: state.peerId,
        reason: cleanReason,
      });
      await this.ctx.storage.put('reportCount', current + 1);
    }

    const peer = this.findByClientId(state.peerId);
    if (peer) {
      this.send(peer, { type: 'reported_disconnect' });
      this.close(peer, 4101, 'Disconnected');
    }
    this.close(ws, 4102, 'Report submitted');
  }

  send(ws, payload) {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify(payload));
    } catch {
      // Best effort: peer may have disconnected between state check and send.
    }
  }

  close(ws, code, reason) {
    try {
      ws.close(code, getSafeReason(reason));
    } catch {
      // Ignore already closed sockets.
    }
  }
}
