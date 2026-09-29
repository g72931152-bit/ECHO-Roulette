const $ = (id) => document.getElementById(id);

const SUPPORT_URL = '';
const HEARTBEAT_MS = 25_000;

const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478'] },
    { urls: ['stun:stun.l.google.com:19302'] }
  ]
};

const state = {
  ws: null,
  pc: null,
  media: null,        // локальный поток (сырые дорожки камеры/микрофона)
  sendAudio: null,    // аудиодорожка, которая уходит собеседнику (сырая или обработанная)
  audio: null,        // граф Web Audio для регулировки громкости
  peerId: null,
  avoidPeerId: null,
  pendingCandidates: [],
  reconnectTimer: null,
  reconnectAttempts: 0,
  heartbeat: null,
  intentionalClose: false,
  active: false,      // идёт ли сессия (комната открыта)
  uiMode: 'searching'
};

const ui = {
  landing: $('landing'), room: $('room'), stage: $('stage'), pip: $('pip'),
  startBtn: $('startBtn'), endBtn: $('endBtn'), nextBtn: $('nextBtn'), micBtn: $('micBtn'), cameraBtn: $('cameraBtn'),
  settingsBtn: $('settingsBtn'), supportBtn: $('supportBtn'), reportBtn: $('reportBtn'),
  localVideo: $('localVideo'), remoteVideo: $('remoteVideo'), remoteEmpty: $('remoteEmpty'),
  roomTitle: $('roomTitle'), roomSubtitle: $('roomSubtitle'), peerStatus: $('peerStatus'), chipDot: $('chipDot'),
  permissionModal: $('permissionModal'), allowPermission: $('allowPermission'), cancelPermission: $('cancelPermission'),
  settingsModal: $('settingsModal'), closeSettings: $('closeSettings'),
  cameraSelect: $('cameraSelect'), micSelect: $('micSelect'), voiceEffect: $('voiceEffect'),
  reportModal: $('reportModal'), cancelReport: $('cancelReport'), submitReport: $('submitReport'),
  reportReason: $('reportReason'), reportCounter: $('reportCounter'),
  toast: $('toast')
};

/* ---------- Интерфейс ---------- */

function setView(view) {
  ui.landing.classList.toggle('active', view === 'landing');
  ui.room.classList.toggle('active', view === 'room');
  ui.settingsBtn.hidden = view !== 'room';
  document.body.classList.toggle('in-room', view === 'room');
}

const PEER_MODES = {
  searching:  { chip: 'Поиск', dot: '', title: 'Ищем собеседника', sub: 'Это обычно занимает несколько секунд.' },
  connecting: { chip: 'Подключение', dot: '', title: 'Собеседник найден', sub: 'Устанавливаем аудио и видео…' },
  live:       { chip: 'В эфире', dot: 'ok' },
  left:       { chip: 'Поиск', dot: '', title: 'Собеседник ушёл', sub: 'Ищем нового…' },
  offline:    { chip: 'Нет связи', dot: 'err', title: 'Соединение потеряно', sub: 'Переподключаемся…' },
  failed:     { chip: 'Ошибка', dot: 'err', title: 'Не удалось соединиться', sub: 'Нажми «Следующий», чтобы попробовать снова.', still: true }
};

function setPeerUi(mode) {
  const m = PEER_MODES[mode];
  state.uiMode = mode;
  ui.peerStatus.textContent = m.chip;
  ui.chipDot.className = `dot ${m.dot}`.trim();
  if (m.title) {
    ui.roomTitle.textContent = m.title;
    ui.roomSubtitle.textContent = m.sub || '';
  }
  ui.stage.classList.toggle('live', mode === 'live');
  ui.stage.classList.toggle('still', Boolean(m.still));
  ui.reportBtn.disabled = !state.peerId;
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
}

function setToggle(button, on, offAction, onAction) {
  button.classList.toggle('off', !on);
  const label = on ? offAction : onAction;
  button.setAttribute('aria-label', label);
  button.title = label;
}

/* ---------- Диалоги: анимация, фокус, Esc ---------- */

let lastFocus = null;
let pointerStartedOnScrim = false;

function openModal(el) {
  lastFocus = document.activeElement;
  el.classList.remove('hidden', 'closing');
  (el.querySelector('[data-autofocus]') || el.querySelector('button, select, textarea'))?.focus({ preventScroll: true });
}

function closeModal(el) {
  if (el.classList.contains('hidden') || el.classList.contains('closing')) return;
  el.classList.add('closing');
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    el.classList.add('hidden');
    el.classList.remove('closing');
    lastFocus?.focus?.({ preventScroll: true });
  };
  el.addEventListener('animationend', (e) => { if (e.target === el) finish(); });
  setTimeout(finish, 300);
}

function openModalEl() {
  return [...document.querySelectorAll('.modal:not(.hidden):not(.closing)')].pop() || null;
}

document.addEventListener('keydown', (e) => {
  const modal = openModalEl();
  if (!modal) return;
  if (e.key === 'Escape') { closeModal(modal); return; }
  if (e.key !== 'Tab') return;
  const items = [...modal.querySelectorAll('button:not([disabled]), select, textarea')];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

document.querySelectorAll('.modal').forEach((modal) => {
  modal.addEventListener('pointerdown', (e) => { pointerStartedOnScrim = e.target === modal; });
  modal.addEventListener('click', (e) => { if (e.target === modal && pointerStartedOnScrim) closeModal(modal); });
});

/* ---------- Ripple (Material) ---------- */

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest?.('.btn, .icon-btn, .fab');
  if (!el || el.disabled || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const wave = document.createElement('span');
  wave.className = 'ripple';
  wave.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  el.append(wave);
  wave.addEventListener('animationend', () => wave.remove(), { once: true });
});

/* ---------- Камера и микрофон ---------- */

function mediaErrorMessage(error) {
  if (!window.isSecureContext) return 'Камера работает только по HTTPS. Открой сайт по защищённому адресу.';
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Доступ запрещён. Разреши камеру и микрофон в настройках браузера.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'Камера или микрофон не найдены.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Устройство занято другим приложением.';
    case 'OverconstrainedError':
      return 'Не удалось подобрать настройки камеры.';
    case 'UnsupportedError':
      return 'Браузер не поддерживает камеру и микрофон.';
    default:
      return 'Не удалось получить доступ к устройствам.';
  }
}

async function requestMedia() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('unsupported'), { name: 'UnsupportedError' });
  }
  if (state.media) return state.media;
  state.media = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  });
  ui.localVideo.srcObject = state.media;
  await enumerateDevices();
  return state.media;
}

async function enumerateDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillSelect(ui.cameraSelect, devices.filter((d) => d.kind === 'videoinput'), state.media?.getVideoTracks()[0]?.getSettings().deviceId);
  fillSelect(ui.micSelect, devices.filter((d) => d.kind === 'audioinput'), state.media?.getAudioTracks()[0]?.getSettings().deviceId);
}

function fillSelect(select, devices, currentId) {
  const old = currentId || select.value || '';
  select.innerHTML = '';
  devices.forEach((device, index) => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `${device.kind === 'videoinput' ? 'Камера' : 'Микрофон'} ${index + 1}`;
    select.append(option);
  });
  if ([...select.options].some((o) => o.value === old)) select.value = old;
}

async function replaceSenderTrack(kind, track) {
  const sender = state.pc?.getSenders().find((s) => s.track?.kind === kind);
  if (sender) await sender.replaceTrack(track);
}

async function switchDevice(kind, deviceId) {
  if (!state.media || !deviceId) return;
  const isVideo = kind === 'video';
  const constraints = isVideo
    ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
    : { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
  const fresh = await navigator.mediaDevices.getUserMedia(constraints);
  const newTrack = isVideo ? fresh.getVideoTracks()[0] : fresh.getAudioTracks()[0];
  const oldTrack = isVideo ? state.media.getVideoTracks()[0] : state.media.getAudioTracks()[0];

  if (oldTrack) {
    newTrack.enabled = oldTrack.enabled;          // сохраняем «выключено»
    state.media.removeTrack(oldTrack);            // иначе в потоке остаётся мёртвая дорожка
    oldTrack.stop();
  }
  state.media.addTrack(newTrack);

  if (isVideo) {
    ui.localVideo.srcObject = null;
    ui.localVideo.srcObject = state.media;
    await replaceSenderTrack('video', newTrack);
  } else {
    await applyAudioEffect();
  }
  await enumerateDevices();
}

/* Громкость голоса: обработанная дорожка реально уходит собеседнику
   и не воспроизводится через динамики (без эха). */
function teardownAudio(graph) {
  if (!graph) return;
  try { graph.source.disconnect(); graph.gain.disconnect(); graph.limiter.disconnect(); } catch {}
  graph.dest.stream.getTracks().forEach((t) => t.stop());
  graph.ctx.close().catch(() => {});
}

async function applyAudioEffect() {
  const raw = state.media?.getAudioTracks()[0];
  if (!raw) return;
  const previous = state.audio;
  const effect = ui.voiceEffect.value;
  let outTrack = raw;
  let graph = null;

  if (effect !== 'off') {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) throw new Error('AudioContext unsupported');
    const ctx = new Ctx();
    await ctx.resume();
    const source = ctx.createMediaStreamSource(new MediaStream([raw]));
    const gain = ctx.createGain();
    gain.gain.value = effect === 'low' ? 0.6 : 1.6;
    const limiter = ctx.createDynamicsCompressor();
    const dest = ctx.createMediaStreamDestination();
    source.connect(gain).connect(limiter).connect(dest);
    graph = { ctx, source, gain, limiter, dest };
    outTrack = dest.stream.getAudioTracks()[0];
  }

  state.audio = graph;
  state.sendAudio = outTrack;
  await replaceSenderTrack('audio', outTrack);
  teardownAudio(previous);
}

/* ---------- WebSocket ---------- */

function getWsUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${protocol}//${location.host}/ws`);
  if (state.avoidPeerId) url.searchParams.set('avoid', state.avoidPeerId);
  return url.toString();
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeat = setInterval(() => {
    if (state.ws?.readyState === WebSocket.OPEN) state.ws.send('ping');
  }, HEARTBEAT_MS);
}

function stopHeartbeat() {
  clearInterval(state.heartbeat);
  state.heartbeat = null;
}

function connectSocket() {
  if (!state.active) return;
  state.intentionalClose = false;
  clearTimeout(state.reconnectTimer);
  const ws = new WebSocket(getWsUrl());
  state.ws = ws;

  ws.addEventListener('open', () => {
    if (state.ws !== ws) return;
    state.reconnectAttempts = 0;
    state.avoidPeerId = null;
    startHeartbeat();
    if (!state.peerId) setPeerUi('searching');
  });

  ws.addEventListener('message', async (event) => {
    if (state.ws !== ws) return;
    let message;
    try { message = JSON.parse(event.data); } catch { return; }   // 'pong' и прочее
    await handleServerMessage(message);
  });

  ws.addEventListener('close', (event) => {
    if (state.ws !== ws) return;          // устаревший сокет
    state.ws = null;
    stopHeartbeat();
    if (state.intentionalClose || !state.active) return;
    dropPeer();
    const gracefully = event.code >= 4100;  // сервер сам завершил разговор
    setPeerUi(gracefully ? 'searching' : 'offline');
    scheduleReconnect(gracefully ? 300 : undefined);
  });
}

function scheduleReconnect(delay) {
  clearTimeout(state.reconnectTimer);
  state.reconnectAttempts += 1;
  const wait = delay ?? Math.min(1000 * 2 ** Math.min(state.reconnectAttempts - 1, 4), 12_000);
  state.reconnectTimer = setTimeout(connectSocket, wait);
}

function send(payload) {
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(payload));
}

async function handleServerMessage(message) {
  switch (message.type) {
    case 'searching':
      if (!state.peerId && state.uiMode !== 'left') setPeerUi('searching');
      break;
    case 'matched':
      await onMatched(message);
      break;
    case 'signal':
      await handleSignal(message.payload);
      break;
    case 'peer-left':
      if (!state.peerId) break;             // уже ищем — ничего не меняем
      dropPeer();
      setPeerUi('left');
      break;
    case 'reported_disconnect':
      toast('Собеседник завершил разговор.');
      dropPeer();
      setPeerUi('searching');
      break;
    case 'error':
      toast('Сервер отклонил действие.');
      break;
  }
}

/* ---------- WebRTC ---------- */

async function onMatched(message) {
  resetPeerConnection();
  state.peerId = message.peerId;
  const pc = createPeerConnection();
  setPeerUi('connecting');

  if (message.role === 'caller') {
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      if (state.pc === pc) send({ type: 'signal', payload: { kind: 'offer', description: pc.localDescription } });
    } catch (error) {
      console.error(error);
      if (state.pc === pc) setPeerUi('failed');
    }
  }
}

function createPeerConnection() {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  state.pc = pc;
  state.pendingCandidates = [];

  if (state.media) {
    const video = state.media.getVideoTracks()[0];
    const audio = state.sendAudio || state.media.getAudioTracks()[0];
    if (video) pc.addTrack(video, state.media);
    if (audio) pc.addTrack(audio, state.media);
  }

  pc.onicecandidate = (event) => {
    if (state.pc === pc && event.candidate) send({ type: 'signal', payload: { kind: 'candidate', candidate: event.candidate } });
  };

  pc.ontrack = (event) => {
    if (state.pc !== pc) return;
    const [stream] = event.streams;
    if (!stream) return;
    ui.remoteVideo.srcObject = stream;
    ui.remoteVideo.play?.().catch(() => {});
  };

  pc.onconnectionstatechange = () => {
    if (state.pc !== pc) return;
    const s = pc.connectionState;
    if (s === 'connected') {
      setPeerUi('live');
    } else if (s === 'disconnected') {
      ui.peerStatus.textContent = 'Связь нестабильна';   // может восстановиться сама
      ui.chipDot.className = 'dot';
    } else if (s === 'failed') {
      setPeerUi('failed');
      toast('Не удалось установить прямое соединение. Попробуй ещё раз.');
    }
  };

  return pc;
}

async function handleSignal(payload) {
  const pc = state.pc;
  if (!pc || !payload) return;
  try {
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (state.pc !== pc) return;
      for (const candidate of state.pendingCandidates.splice(0)) {
        await pc.addIceCandidate(candidate).catch(() => {});
      }
      if (payload.description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (state.pc === pc) send({ type: 'signal', payload: { kind: 'answer', description: pc.localDescription } });
      }
    }
    if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => {});
      else state.pendingCandidates.push(payload.candidate);
    }
  } catch (error) {
    console.error(error);
    if (state.pc === pc) setPeerUi('failed');
  }
}

function resetPeerConnection() {
  state.pendingCandidates = [];
  const pc = state.pc;
  state.pc = null;
  if (pc) {
    pc.ontrack = pc.onicecandidate = pc.onconnectionstatechange = null;
    try { pc.close(); } catch {}
  }
  ui.remoteVideo.srcObject = null;
}

function dropPeer() {
  resetPeerConnection();
  state.peerId = null;
}

/* ---------- Действия ---------- */

function leaveRoomForNext() {
  if (state.ws?.readyState !== WebSocket.OPEN) {
    toast('Нет соединения с сервером. Переподключаемся…');
    return;
  }
  dropPeer();
  setPeerUi('searching');
  send({ type: 'next' });
  ui.nextBtn.disabled = true;                       // защита от двойного нажатия
  setTimeout(() => { ui.nextBtn.disabled = false; }, 700);
}

async function startSession() {
  await requestMedia();
  state.active = true;
  state.reconnectAttempts = 0;
  setView('room');
  setPeerUi('searching');
  connectSocket();
}

function stopSession() {
  state.active = false;
  state.intentionalClose = true;
  clearTimeout(state.reconnectTimer);
  stopHeartbeat();
  try { state.ws?.close(1000, 'leave'); } catch {}
  state.ws = null;
  dropPeer();
  state.avoidPeerId = null;
  teardownAudio(state.audio);
  state.audio = null;
  state.sendAudio = null;
  state.media?.getTracks().forEach((t) => t.stop());
  state.media = null;
  ui.localVideo.srcObject = null;
  ui.voiceEffect.value = 'off';
  setToggle(ui.micBtn, true, 'Выключить микрофон', 'Включить микрофон');
  setToggle(ui.cameraBtn, true, 'Выключить камеру', 'Включить камеру');
  ui.pip.classList.remove('cam-off');
  closeModal(ui.settingsModal);
  closeModal(ui.reportModal);
  setView('landing');
}

/* ---------- Обработчики ---------- */

ui.startBtn.addEventListener('click', () => openModal(ui.permissionModal));
ui.cancelPermission.addEventListener('click', () => closeModal(ui.permissionModal));
ui.allowPermission.addEventListener('click', async () => {
  ui.allowPermission.disabled = true;
  try {
    await startSession();
    closeModal(ui.permissionModal);
  } catch (error) {
    console.error(error);
    toast(mediaErrorMessage(error));
  } finally {
    ui.allowPermission.disabled = false;
  }
});

ui.micBtn.addEventListener('click', () => {
  const track = state.media?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  setToggle(ui.micBtn, track.enabled, 'Выключить микрофон', 'Включить микрофон');
  toast(track.enabled ? 'Микрофон включён' : 'Микрофон выключен');
});

ui.cameraBtn.addEventListener('click', () => {
  const track = state.media?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  setToggle(ui.cameraBtn, track.enabled, 'Выключить камеру', 'Включить камеру');
  ui.pip.classList.toggle('cam-off', !track.enabled);
  toast(track.enabled ? 'Камера включена' : 'Камера выключена');
});

ui.nextBtn.addEventListener('click', leaveRoomForNext);
ui.endBtn.addEventListener('click', stopSession);

ui.settingsBtn.addEventListener('click', async () => {
  await enumerateDevices().catch(() => {});
  openModal(ui.settingsModal);
});
ui.closeSettings.addEventListener('click', () => closeModal(ui.settingsModal));
ui.cameraSelect.addEventListener('change', () => switchDevice('video', ui.cameraSelect.value).catch(() => toast('Не удалось сменить камеру.')));
ui.micSelect.addEventListener('change', () => switchDevice('audio', ui.micSelect.value).catch(() => toast('Не удалось сменить микрофон.')));
ui.voiceEffect.addEventListener('change', () => applyAudioEffect().catch(() => {
  ui.voiceEffect.value = 'off';
  toast('Настройка громкости недоступна в этом браузере.');
}));

ui.supportBtn.addEventListener('click', () => {
  if (SUPPORT_URL) window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer');
  else toast('Ссылка поддержки пока не настроена. Укажи SUPPORT_URL в app.js.');
});

ui.reportBtn.addEventListener('click', () => {
  if (state.peerId) openModal(ui.reportModal);
});
ui.cancelReport.addEventListener('click', () => closeModal(ui.reportModal));
ui.reportReason.addEventListener('input', () => {
  ui.reportCounter.textContent = `${ui.reportReason.value.length} / ${ui.reportReason.maxLength}`;
});
ui.submitReport.addEventListener('click', () => {
  if (!state.peerId) { closeModal(ui.reportModal); return; }
  state.avoidPeerId = state.peerId;               // не встретить того же собеседника сразу после жалобы
  send({ type: 'report', reason: ui.reportReason.value.trim() || 'unspecified' });
  ui.reportReason.value = '';
  ui.reportCounter.textContent = `0 / ${ui.reportReason.maxLength}`;
  dropPeer();
  setPeerUi('searching');
  closeModal(ui.reportModal);
  toast('Жалоба отправлена.');
});

window.addEventListener('online', () => {
  if (state.active && !state.ws) { clearTimeout(state.reconnectTimer); connectSocket(); }
});

window.addEventListener('pagehide', () => {
  state.intentionalClose = true;
  state.ws?.close(1000, 'page-unload');
  state.media?.getTracks().forEach((t) => t.stop());
});

navigator.mediaDevices?.addEventListener?.('devicechange', () => enumerateDevices().catch(() => {}));
