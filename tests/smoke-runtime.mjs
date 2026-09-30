import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

class FakeClassList {
  constructor() { this.items = new Set(); }
  add(...xs) { xs.forEach(x => this.items.add(x)); }
  remove(...xs) { xs.forEach(x => this.items.delete(x)); }
  toggle(x, force) { const on = force === undefined ? !this.items.has(x) : Boolean(force); if (on) this.items.add(x); else this.items.delete(x); return on; }
  contains(x) { return this.items.has(x); }
}

class FakeElement {
  constructor(id = '') {
    this.id = id; this.hidden = false; this.value = ''; this.checked = false; this.disabled = false;
    this.textContent = ''; this.innerHTML = ''; this.srcObject = null; this.options = [];
    this.classList = new FakeClassList(); this.style = {};
    this.dataset = {}; this.files = []; this.children = []; this.scrollTop = 0; this.scrollHeight = 0;
  }
  addEventListener() {}
  append(...xs) { this.children.push(...xs); }
  appendChild(x) { this.children.push(x); return x; }
  setAttribute() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  getContext() { return { clearRect() {}, fillRect() {}, globalAlpha: 1 }; }
  getBoundingClientRect() { return { width: 1000, height: 600 }; }
  setPointerCapture() {}
  focus() {}
  play() { return Promise.resolve(); }
  requestFullscreen() { return Promise.resolve(); }
}

const elements = new Map();
const document = {
  body: new FakeElement('body'),
  fullscreenElement: null,
  getElementById(id) { if (!elements.has(id)) elements.set(id, new FakeElement(id)); return elements.get(id); },
  createElement(tag) { const e = new FakeElement(tag); if (tag === 'option') e.value = ''; return e; },
  querySelectorAll() { return []; },
  addEventListener() {},
};

document.body.classList = new FakeClassList();
const localStore = new Map();
const sessionStore = new Map();
const storage = (m) => ({
  getItem: k => m.get(k) ?? null,
  setItem: (k,v) => m.set(k, String(v)),
  removeItem: k => m.delete(k),
});

const context = {
  console,
  document,
  window: {},
  navigator: { mediaDevices: undefined },
  localStorage: storage(localStore),
  sessionStorage: storage(sessionStore),
  location: { protocol: 'https:', host: 'example.test' },
  requestAnimationFrame: fn => fn(),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  performance: { now: () => 0 },
  crypto: { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
  CSS: { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, '_') },
  Intl,
  URL,
  WebSocket: class FakeWebSocket {},
  Image: class FakeImage {},
  MediaStream: class FakeMediaStream {},
  RTCPeerConnection: class FakeRTCPeerConnection {},
  prompt: () => '',
};
context.window = {
  ...context.window,
  document,
  navigator: context.navigator,
  localStorage: context.localStorage,
  sessionStorage: context.sessionStorage,
  isSecureContext: true,
  addEventListener() {},
  open() {},
};
context.WebSocket.OPEN = 1;
context.WebSocket.CLOSED = 3;
context.window.AudioContext = undefined;
context.window.webkitAudioContext = undefined;
vm.createContext(context);
assert.doesNotThrow(() => vm.runInContext(source, context), 'client startup should not throw with required DOM APIs present');
console.log('runtime smoke: app.js startup executed without uncaught errors');
