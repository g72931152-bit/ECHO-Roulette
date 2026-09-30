const $ = (id) => document.getElementById(id);

const APP = {
  name: 'ELVAR',
  supportEmail: 'ptornsaso0@gmail.com',
  donateUrl: '',
  ownerEmail: 'ptornsaso0@gmail.com',
  wsHeartbeatMs: 18_000,
  statsMs: 1_500,
  stun: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

const AVATARS = ['◉','●','◌','◆','◇','△','○','✦','✧','⬡','✶','☼','☾','♢'];
const COUNTRIES = ['TR','RU','UA','KZ','AZ','GE','AM','DE','FR','GB','IT','ES','PT','NL','BE','CH','AT','PL','CZ','SK','HU','RO','BG','GR','SE','NO','DK','FI','EE','LV','LT','IS','IE','US','CA','MX','BR','AR','CL','CO','PE','UY','AU','NZ','JP','KR','CN','IN','PK','BD','ID','MY','SG','TH','VN','PH','SA','AE','IL','EG','MA','ZA','NG','KE','TN'];

const ui = {
  body: document.body,
  landing: $('landing'), room: $('room'), stage: $('stage'),
  startBtn: $('startBtn'), editProfileLanding: $('editProfileLanding'), landingProfileSummary: $('landingProfileSummary'),
  landingAvatar: $('landingAvatar'), landingName: $('landingName'), landingMeta: $('landingMeta'),
  topAvatar: $('topAvatar'), topName: $('topName'), profileBtn: $('profileBtn'),
  supportBtn: $('supportBtn'), feedbackBtn: $('feedbackBtn'), settingsBtn: $('settingsBtn'),
  remoteVideo: $('remoteVideo'), localVideo: $('localVideo'), remotePlaceholder: $('remotePlaceholder'),
  disconnectMark: $('disconnectMark'), searchFigures: $('searchFigures'),
  peerStatus: $('peerStatus'), statusDot: $('statusDot'), remoteTitle: $('remoteTitle'), remoteSubtitle: $('remoteSubtitle'), peerCard: $('peerCard'), peerAvatar: $('peerAvatar'), peerName: $('peerName'), peerCountry: $('peerCountry'), peerOwnerBadge: $('peerOwnerBadge'), peerAway: $('peerAway'),
  pip: $('pip'), pipLabel: $('pipLabel'), pipFallback: $('pipAvatarFallback'),
  micBtn: $('micBtn'), cameraBtn: $('cameraBtn'), reactionBtn: $('reactionBtn'), awayBtn: $('awayBtn'), chatBtnBottom: $('chatBtnBottom'), nextBtn: $('nextBtn'), reportBtn: $('reportBtn'), endBtn: $('endBtn'),
  reactionDock: $('reactionDock'), reactionSoundsToggle: $('reactionSoundsToggle'), chatToggle: $('chatToggle'), fullscreenBtn: $('fullscreenBtn'), chatPanel: $('chatPanel'), chatClose: $('chatClose'), chatMessages: $('chatMessages'), chatForm: $('chatForm'), chatInput: $('chatInput'), chatPeerLabel: $('chatPeerLabel'), chatConnection: $('chatConnection'),
  connectionStats: $('connectionStats'), rttValue: $('rttValue'), voiceDelayValue: $('voiceDelayValue'),
  permissionModal: $('permissionModal'), allowPermission: $('allowPermission'), cancelPermission: $('cancelPermission'),
  profileModal: $('profileModal'), profileForm: $('profileForm'), profileName: $('profileName'), profileEmail: $('profileEmail'), profileCountry: $('profileCountry'), targetCountry: $('targetCountry'), profileBio: $('profileBio'), avatarSelect: $('avatarSelect'), avatarFile: $('avatarFile'), profilePreview: $('profilePreview'), closeProfile: $('closeProfile'), cancelProfile: $('cancelProfile'),
  settingsModal: $('settingsModal'), closeSettings: $('closeSettings'), micSelect: $('micSelect'), cameraSelect: $('cameraSelect'), volumeRange: $('volumeRange'), volumeValue: $('volumeValue'), voiceEffect: $('voiceEffect'), cameraFilter: $('cameraFilter'), mirrorToggle: $('mirrorToggle'), settingsProfileBox: $('settingsProfileBox'), editProfileSettings: $('editProfileSettings'),
  localLatencyMetric: $('localLatencyMetric'), peerLatencyMetric: $('peerLatencyMetric'), voiceMetric: $('voiceMetric'), localGeoMetric: $('localGeoMetric'), networkNote: $('networkNote'),
  adminTabButton: $('adminTabButton'), adminGate: $('adminGate'), adminRefresh: $('adminRefresh'), adminTokenButton: $('adminTokenButton'), adminUsers: $('adminUsers'), adminReports: $('adminReports'), adminFeedback: $('adminFeedback'),
  reportModal: $('reportModal'), reportForm: $('reportForm'), reportReason: $('reportReason'), cancelReport: $('cancelReport'), cancelReportAction: $('cancelReportAction'),
  feedbackModal: $('feedbackModal'), feedbackForm: $('feedbackForm'), feedbackName: $('feedbackName'), feedbackEmail: $('feedbackEmail'), feedbackMessage: $('feedbackMessage'), cancelFeedback: $('cancelFeedback'), cancelFeedbackAction: $('cancelFeedbackAction'),
  gameModal: $('gameModal'), closeGame: $('closeGame'), gameTitle: $('gameTitle'), snakeGame: $('snakeGame'), snakeCanvas: $('snakeCanvas'), snakeScore: $('snakeScore'), snakeStart: $('snakeStart'), reactionGame: $('reactionGame'), reactionTarget: $('reactionTarget'), reactionScore: $('reactionScore'), reactionStart: $('reactionStart'),
  toast: $('toast'),
};

const state = {
  profile: loadProfile(),
  targetCountry: localStorage.getItem('elvarTargetCountry') || 'ANY',
  geoCountry: 'ZZ',
  ws: null, pc: null, media: null,
  peerId: null, roomId: null, role: null, peerProfile: null, peerGeoCountry: 'ZZ', peerAway: false,
  pendingCandidates: [], pendingChat: new Map(),
  avoidPeerId: null,
  active: false, intentionalClose: false,
  reconnectTimer: null, reconnectAttempts: 0, searchTimer: null,
  heartbeatTimer: null, pingOutstanding: null,
  statsTimer: null, localRtt: null, peerRtt: null, voiceDelay: null,
  away: false,
  audio: null, outgoingAudioTrack: null, volume: 1,
  lastSfxAt: 0, reactionSounds: localStorage.getItem('elvarReactionSounds') !== '0', lastReceivedMessageId: '',
  camFilter: 'normal', mirror: true,
  adminToken: sessionStorage.getItem('elvarAdminToken') || '', adminData: null,
  uiMode: 'landing', roomMode: 'landing',
  camDevicePreference: localStorage.getItem('elvarCameraDevice') || '',
  micDevicePreference: localStorage.getItem('elvarMicDevice') || '',
};

const RTC_CONFIG = { iceServers: APP.stun, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' };

function countryName(code) {
  if (!code || code === 'ZZ') return 'Не определена';
  if (code === 'ANY') return 'Любая страна';
  try { return new Intl.DisplayNames(['ru'], { type: 'region' }).of(code) || code; } catch { return code; }
}

function fillCountries(select, allowAny = false) {
  select.innerHTML = '';
  if (allowAny) addOption(select, 'ANY', 'Любая страна');
  for (const code of COUNTRIES) addOption(select, code, countryName(code));
}

function addOption(select, value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function toast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
}

toast.timer = null;

function getWsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = new URL(`${proto}//${location.host}/ws`);
  if (state.avoidPeerId) url.searchParams.set('avoid', state.avoidPeerId);
  return url.toString();
}

function normalizeName(name) { return (name || '').trim().slice(0, 32); }
function isOwner() { return Boolean(state.profile?.email && state.profile.email.toLowerCase() === APP.ownerEmail.toLowerCase()); }
function profileComplete() { return Boolean(state.profile?.name && state.profile.country); }
function ensureSearchProfile() {
  if (!state.profile) state.profile = createProfile();
  if (!normalizeName(state.profile.name)) {
    state.profile.name = `Гость ${Math.floor(1000 + Math.random() * 9000)}`;
  }
  if (!state.profile.country) state.profile.country = 'TR';
  saveProfile();
}
function profilePublic() { return state.profile ? { ...state.profile } : null; }
function createProfile() { return { profileId: crypto.randomUUID(), name: '', email: '', country: 'TR', bio: '', avatar: '◉', image: '' }; }
function loadProfile() {
  try {
    const value = JSON.parse(localStorage.getItem('elvarProfile') || 'null');
    return value && typeof value === 'object' ? value : createProfile();
  } catch { return createProfile(); }
}

function saveProfile() {
  localStorage.setItem('elvarProfile', JSON.stringify(state.profile));
  localStorage.setItem('elvarTargetCountry', state.targetCountry);
  refreshProfileUi();
}

function refreshProfileUi() {
  const profile = state.profile || createProfile();
  setAvatarElement(ui.topAvatar, profile);
  setAvatarElement(ui.landingAvatar, profile);
  setAvatarElement(ui.pipFallback, profile);
  ui.topName.textContent = profile.name || 'Профиль';
  ui.landingName.textContent = profile.name || 'Профиль ещё не создан';
  ui.landingMeta.textContent = profile.name ? `${countryName(profile.country)} · ${profile.bio || 'без описания'}` : 'Имя · страна · описание';
  ui.pipLabel.textContent = profile.name || 'Ты';
  ui.adminTabButton.hidden = !isOwner();
  ui.settingsProfileBox.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'setting-profile';
  const avatar = document.createElement('span');
  avatar.className = 'avatar avatar-medium';
  setAvatarElement(avatar, profile);
  const copy = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = profile.name || 'Без имени';
  const small = document.createElement('small');
  small.textContent = profile.email || 'Email не указан';
  copy.append(strong, small);
  wrapper.append(avatar, copy);
  ui.settingsProfileBox.append(wrapper);
}

function setAvatarElement(element, profile) {
  element.innerHTML = '';
  if (profile?.image) {
    const image = document.createElement('img');
    image.src = profile.image;
    image.alt = '';
    element.append(image);
  } else {
    element.textContent = profile?.avatar || '+';
  }
}

function setView(view) {
  ui.landing.classList.toggle('active', view === 'landing');
  ui.room.classList.toggle('active', view === 'room');
  ui.settingsBtn.hidden = view !== 'room';
  state.uiMode = view;
  document.body.classList.toggle('in-room', view === 'room');
}

function openOverlay(element) {
  element.hidden = false;
  requestAnimationFrame(() => element.classList.add('showing'));
}

function closeOverlay(element) {
  element.classList.remove('showing');
  setTimeout(() => { element.hidden = true; }, 180);
}

function openModalOnOutsideClick(element) {
  element.addEventListener('click', (event) => {
    if (event.target === element) closeOverlay(element);
  });
}

function initProfileForm() {
  fillCountries(ui.profileCountry, false);
  fillCountries(ui.targetCountry, true);
  ui.avatarSelect.innerHTML = '';
  AVATARS.forEach((avatar) => addOption(ui.avatarSelect, avatar, avatar));
}

function populateProfileForm() {
  const profile = state.profile || createProfile();
  ui.profileName.value = profile.name || '';
  ui.profileEmail.value = profile.email || '';
  ui.profileCountry.value = profile.country || 'TR';
  ui.targetCountry.value = state.targetCountry || 'ANY';
  ui.profileBio.value = profile.bio || '';
  ui.avatarSelect.value = profile.avatar || '◉';
  ui.avatarFile.value = '';
  renderProfilePreview();
}

function renderProfilePreview() {
  setAvatarElement(ui.profilePreview, {
    ...state.profile,
    avatar: ui.avatarSelect.value || state.profile.avatar,
    image: state.profile.image || '',
  });
}

ui.profileBtn.addEventListener('click', () => { populateProfileForm(); openOverlay(ui.profileModal); });
ui.landingProfileSummary.addEventListener('click', () => { populateProfileForm(); openOverlay(ui.profileModal); });
ui.editProfileLanding.addEventListener('click', () => { populateProfileForm(); openOverlay(ui.profileModal); });
ui.editProfileSettings.addEventListener('click', () => { closeOverlay(ui.settingsModal); populateProfileForm(); openOverlay(ui.profileModal); });
ui.closeProfile.addEventListener('click', () => closeOverlay(ui.profileModal));
ui.cancelProfile.addEventListener('click', () => closeOverlay(ui.profileModal));
ui.avatarSelect.addEventListener('change', renderProfilePreview);
ui.avatarFile.addEventListener('change', async () => {
  const file = ui.avatarFile.files?.[0];
  if (!file) return;
  if (file.size > 2_000_000) {
    toast('Изображение слишком большое. Выбери файл до 2 МБ.');
    ui.avatarFile.value = '';
    return;
  }
  try {
    const data = await resizeImage(file, 96, .68);
    if (data.length > 9_000) throw new Error('large');
    state.profile.image = data;
    renderProfilePreview();
  } catch {
    toast('Не удалось подготовить изображение.');
    ui.avatarFile.value = '';
  }
});

ui.profileForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = normalizeName(ui.profileName.value);
  const email = ui.profileEmail.value.trim().toLowerCase();
  if (name.length < 2) {
    toast('Имя должно содержать минимум 2 символа.');
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    toast('Проверь email или оставь поле пустым.');
    return;
  }
  state.profile = {
    ...(state.profile || createProfile()),
    name,
    email,
    country: ui.profileCountry.value || 'TR',
    bio: ui.profileBio.value.trim().slice(0, 180),
    avatar: ui.avatarSelect.value || '◉',
    image: state.profile.image || '',
  };
  state.targetCountry = ui.targetCountry.value || 'ANY';
  saveProfile();
  if (state.ws?.readyState === WebSocket.OPEN) send({ type: 'profile', profile: profilePublic() });
  closeOverlay(ui.profileModal);
  toast(isOwner() ? 'Профиль владельца сохранён.' : 'Профиль сохранён.');
});

async function resizeImage(file, size, quality = .74) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const side = Math.min(image.width, image.height);
    const sx = (image.width - side) / 2;
    const sy = (image.height - side) / 2;
    ctx.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

ui.startBtn.addEventListener('click', () => {
  ensureSearchProfile();
  openOverlay(ui.permissionModal);
});
ui.cancelPermission.addEventListener('click', () => closeOverlay(ui.permissionModal));
ui.allowPermission.addEventListener('click', async () => {
  ui.allowPermission.disabled = true;
  try {
    await startSession();
    closeOverlay(ui.permissionModal);
  } catch (error) {
    console.error(error);
    toast(mediaErrorMessage(error));
  } finally {
    ui.allowPermission.disabled = false;
  }
});

async function startSession() {
  await requestMedia();
  state.active = true;
  state.intentionalClose = false;
  state.reconnectAttempts = 0;
  state.away = false;
  state.peerAway = false;
  state.localRtt = null;
  state.peerRtt = null;
  state.voiceDelay = null;
  state.avoidPeerId = null;
  setView('room');
  setRoomMode('searching');
  resetPeerConnection();
  resetRoomData();
  connectSocket();
}

async function requestMedia() {
  if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('unsupported'), { name: 'UnsupportedError' });
  if (state.media) {
    applyCameraUi();
    return state.media;
  }
  state.media = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 }, facingMode: 'user' },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 },
  });
  ui.localVideo.srcObject = state.media;
  applyCameraUi();
  await enumerateDevices();
  applyButtonStates();
  return state.media;
}

async function enumerateDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillDeviceSelect(ui.cameraSelect, devices.filter((device) => device.kind === 'videoinput'), state.camDevicePreference || state.media?.getVideoTracks()[0]?.getSettings().deviceId);
  fillDeviceSelect(ui.micSelect, devices.filter((device) => device.kind === 'audioinput'), state.micDevicePreference || state.media?.getAudioTracks()[0]?.getSettings().deviceId);
}

function fillDeviceSelect(select, devices, current) {
  const old = current || select.value;
  select.innerHTML = '';
  devices.forEach((device, index) => addOption(select, device.deviceId, device.label || `${device.kind === 'videoinput' ? 'Камера' : 'Микрофон'} ${index + 1}`));
  if ([...select.options].some((option) => option.value === old)) select.value = old;
}

function mediaErrorMessage(error) {
  if (!window.isSecureContext) return 'Для камеры и микрофона нужен HTTPS.';
  switch (error?.name) {
    case 'NotAllowedError': return 'Разрешение на камеру или микрофон отклонено.';
    case 'NotFoundError': return 'Камера или микрофон не найдены.';
    case 'NotReadableError': return 'Устройство занято другим приложением.';
    default: return 'Не удалось получить доступ к устройствам.';
  }
}

function connectSocket() {
  if (!state.active) return;
  clearTimeout(state.reconnectTimer);
  state.intentionalClose = false;
  const ws = new WebSocket(getWsUrl());
  state.ws = ws;

  ws.addEventListener('open', () => {
    if (state.ws !== ws) return;
    state.reconnectAttempts = 0;
    startHeartbeat();
    send({ type: 'hello', profile: profilePublic(), targetCountry: state.targetCountry });
    setRoomMode('searching');
    ui.chatConnection.textContent = 'Соединение установлено';
  });

  ws.addEventListener('message', async (event) => {
    if (state.ws !== ws) return;
    const message = safeJsonParse(event.data);
    if (message) await handleServer(message);
  });

  ws.addEventListener('close', () => {
    if (state.ws !== ws) return;
    state.ws = null;
    stopHeartbeat();
    if (state.intentionalClose || !state.active) return;
    resetPeerConnection();
    resetRoomData();
    setRoomMode('offline');
    ui.chatConnection.textContent = 'Сигнальное соединение потеряно';
    scheduleReconnect();
  });

  ws.addEventListener('error', () => {
    ui.chatConnection.textContent = 'Ошибка соединения';
  });
}

function scheduleReconnect() {
  clearTimeout(state.reconnectTimer);
  state.reconnectAttempts += 1;
  const wait = Math.min(800 * 2 ** Math.min(state.reconnectAttempts - 1, 5), 12_000);
  state.reconnectTimer = setTimeout(connectSocket, wait);
}

function send(payload) {
  if (state.ws?.readyState !== WebSocket.OPEN) return false;
  state.ws.send(JSON.stringify(payload));
  return true;
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    if (state.ws?.readyState !== WebSocket.OPEN) return;
    state.pingOutstanding = performance.now();
    state.ws.send(JSON.stringify({ type: 'ping', clientTs: Date.now() }));
  }, APP.wsHeartbeatMs);
}

function stopHeartbeat() {
  clearInterval(state.heartbeatTimer);
  state.heartbeatTimer = null;
}

async function handleServer(message) {
  switch (message.type) {
    case 'ready':
      state.clientId = message.clientId;
      state.geoCountry = message.geoCountry || 'ZZ';
      updateMetrics();
      break;
    case 'searching':
      resetPeerConnection();
      resetPeerDataOnly();
      setRoomMode('searching');
      break;
    case 'matched':
      await onMatched(message);
      break;
    case 'signal':
      await handleSignal(message.payload);
      break;
    case 'peer-profile':
      setPeerProfile(message.profile, message.country, message.isOwner, message.away);
      break;
    case 'peer-away':
      state.peerAway = Boolean(message.value);
      setPeerAwayUi();
      break;
    case 'chat':
      handleIncomingChat(message);
      break;
    case 'chat-ack':
      if (message.accepted === false) {
        state.pendingChat.delete(message.messageId || '');
        updateChatMessage(message.messageId || '', 'failed');
        if (message.reason === 'chat_rate_limited') toast('Слишком быстро. Попробуй ещё раз через секунду.');
      } else {
        markChatSent(message.messageId);
      }
      break;
    case 'reaction':
      if (state.reactionSounds) playReactionSound(message.sound, false);
      break;
    case 'peer-left':
      handlePeerLost(message.reason || 'left');
      break;
    case 'reported_disconnect':
      handlePeerLost('reported');
      toast('Собеседник отключён.');
      break;
    case 'report-saved':
      toast(message.emailHandled ? 'Жалоба отправлена и сохранена.' : 'Жалоба сохранена в панели администратора.');
      break;
    case 'pong':
      if (state.pingOutstanding) {
        state.localRtt = Math.max(0, performance.now() - state.pingOutstanding);
        updateMetrics();
        state.pingOutstanding = null;
      }
      break;
    case 'banned':
      handlePeerLost('banned');
      toast('Доступ ограничен администратором.');
      break;
    case 'error':
      toast(errorLabel(message.code));
      break;
  }
}

function errorLabel(code) {
  if (code === 'no_peer') return 'Собеседник уже отключился.';
  if (code === 'chat_not_allowed') return 'Чат недоступен без собеседника.';
  return 'Сервер отклонил действие.';
}

function setRoomMode(mode) {
  state.roomMode = mode;
  if (mode === 'searching') startSearchPulse();
  else stopSearchPulse();
  ui.stage.dataset.mode = mode;
  ui.statusDot.className = 'status-dot';
  const map = {
    searching: ['Поиск', 'Подбираем собеседника'],
    connecting: ['Подключение', 'Соединяем аудио и видео'],
    live: ['В эфире', ''],
    left: ['Поиск', 'Собеседник ушёл'],
    offline: ['Нет связи', 'Переподключаемся…'],
    failed: ['Ошибка', 'Не удалось завершить соединение'],
  };
  const [title, subtitle] = map[mode] || map.searching;
  ui.peerStatus.textContent = title;
  ui.statusDot.classList.toggle('live', mode === 'live');
  ui.statusDot.classList.toggle('error', mode === 'offline' || mode === 'failed');
  ui.searchFigures.hidden = !['searching', 'connecting', 'left'].includes(mode);
  ui.disconnectMark.hidden = !['offline', 'failed'].includes(mode);
  ui.stage.classList.toggle('live', mode === 'live');
  ui.nextBtn.disabled = !state.peerId && mode !== 'searching' && mode !== 'left';
  if (mode === 'live' && state.peerProfile) {
    ui.remoteTitle.textContent = `${state.peerProfile.name || 'Собеседник'}`;
    ui.remoteSubtitle.textContent = 'Подключение установлено';
  } else {
    ui.remoteTitle.textContent = title;
    ui.remoteSubtitle.textContent = subtitle;
  }
}


function startSearchPulse() {
  if (state.searchTimer) return;
  state.searchTimer = setInterval(() => {
    if (state.active && state.ws?.readyState === WebSocket.OPEN && state.roomMode === 'searching') {
      send({ type: 'search' });
    }
  }, 2200);
}

function stopSearchPulse() {
  clearInterval(state.searchTimer);
  state.searchTimer = null;
}

function setPeerProfile(profile, country, isOwner = false, away = false) {
  state.peerProfile = profile || null;
  state.peerGeoCountry = country || 'ZZ';
  state.peerAway = Boolean(away);
  ui.peerCard.hidden = !state.peerProfile;
  if (!state.peerProfile) return;
  setAvatarElement(ui.peerAvatar, state.peerProfile);
  ui.peerName.textContent = state.peerProfile.name || 'Собеседник';
  ui.peerCountry.textContent = `${countryName(state.peerProfile.country)} · сеть ${countryName(state.peerGeoCountry)}`;
  ui.chatPeerLabel.textContent = state.peerProfile.name || 'Собеседник';
  ui.peerOwnerBadge.hidden = !Boolean(isOwner);
  setPeerAwayUi();
  ui.chatToggle.hidden = false;
  ui.connectionStats.hidden = false;
  ui.reportBtn.disabled = false;
}

function setPeerAwayUi() {
  ui.peerAway.hidden = !state.peerAway;
  ui.peerAway.textContent = state.peerAway ? 'Отошёл' : '';
}

function resetPeerDataOnly() {
  state.peerId = null;
  state.roomId = null;
  state.role = null;
  state.peerProfile = null;
  state.peerGeoCountry = 'ZZ';
  state.peerAway = false;
  state.lastReceivedMessageId = '';
  state.pendingChat.clear();
  ui.peerCard.hidden = true;
  ui.chatToggle.hidden = true;
  ui.connectionStats.hidden = true;
  ui.chatPanel.hidden = true;
  ui.reportBtn.disabled = true;
  clearChat();
  setPeerAwayUi();
}

function resetRoomData() {
  resetPeerDataOnly();
  state.pendingCandidates = [];
  ui.remoteVideo.srcObject = null;
  ui.remoteTitle.textContent = 'Поиск';
  ui.remoteSubtitle.textContent = 'Подбираем собеседника';
}

function handlePeerLost(reason) {
  resetPeerConnection();
  resetPeerDataOnly();
  if (state.active) setRoomMode(reason === 'offline' ? 'offline' : 'left');
}

async function onMatched(message) {
  resetPeerConnection();
  state.peerId = message.peerId;
  state.roomId = message.roomId;
  state.role = message.role;
  state.peerAway = Boolean(message.peer?.away);
  setPeerProfile(message.peer?.profile, message.peer?.country, message.peer?.isOwner, message.peer?.away);
  setRoomMode('connecting');
  ui.chatConnection.textContent = 'Собеседник найден';

  if (message.role === 'caller') {
    const pc = await createPeerConnection();
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      send({ type: 'signal', payload: { kind: 'offer', description: pc.localDescription } });
    } catch (error) {
      console.error(error);
      setRoomMode('failed');
      toast('Не удалось начать WebRTC-соединение.');
    }
  } else {
    try {
      await createPeerConnection();
    } catch (error) {
      console.error(error);
      setRoomMode('failed');
    }
  }
}

async function createPeerConnection() {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  state.pc = pc;
  state.pendingCandidates = [];
  const audioTrack = state.outgoingAudioTrack || state.media?.getAudioTracks()[0];
  const videoTrack = state.media?.getVideoTracks()[0];

  if (videoTrack) {
    const sender = pc.addTrack(videoTrack, state.media);
    try {
      const parameters = sender.getParameters();
      parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
      parameters.encodings[0].maxBitrate = 900_000;
      parameters.encodings[0].maxFramerate = 30;
      await sender.setParameters(parameters);
    } catch {}
  }

  if (audioTrack) pc.addTrack(audioTrack, new MediaStream([audioTrack]));

  pc.onicecandidate = (event) => {
    if (state.pc !== pc || !event.candidate) return;
    send({ type: 'signal', payload: { kind: 'candidate', candidate: event.candidate } });
  };

  pc.ontrack = (event) => {
    if (state.pc !== pc) return;
    const stream = event.streams?.[0] || new MediaStream([event.track]);
    ui.remoteVideo.srcObject = stream;
    ui.remoteVideo.muted = false;
    ui.remoteVideo.volume = 1;
    try {
      const receiver = pc.getReceivers().find((item) => item.track === event.track);
      if (receiver && 'playoutDelayHint' in receiver) receiver.playoutDelayHint = 0;
    } catch {}
    ui.remoteVideo.play().catch(() => {});
    ui.stage.classList.add('has-remote-video');
  };

  pc.onconnectionstatechange = () => {
    if (state.pc !== pc) return;
    switch (pc.connectionState) {
      case 'connected':
        setRoomMode('live');
        startStatsPolling();
        ui.chatConnection.textContent = 'Чат и звонок активны';
        break;
      case 'disconnected':
        setRoomMode('offline');
        setTimeout(() => {
          if (state.pc === pc && pc.connectionState === 'disconnected') handlePeerLost('offline');
        }, 3000);
        break;
      case 'failed':
        setRoomMode('failed');
        ui.chatConnection.textContent = 'WebRTC-соединение не установлено';
        break;
    }
  };

  pc.oniceconnectionstatechange = () => {
    if (state.pc !== pc) return;
    if (['connected', 'completed'].includes(pc.iceConnectionState)) setRoomMode('live');
    if (pc.iceConnectionState === 'failed') setRoomMode('failed');
  };

  return pc;
}

async function handleSignal(payload) {
  const pc = state.pc;
  if (!pc || !payload) return;
  try {
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (payload.description.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'signal', payload: { kind: 'answer', description: pc.localDescription } });
      }
      for (const candidate of state.pendingCandidates.splice(0)) await pc.addIceCandidate(candidate).catch(() => {});
    }
    if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate).catch(() => {});
      else state.pendingCandidates.push(payload.candidate);
    }
  } catch (error) {
    console.error(error);
    if (state.pc === pc) setRoomMode('failed');
  }
}

function resetPeerConnection() {
  state.pendingCandidates = [];
  stopStatsPolling();
  const pc = state.pc;
  state.pc = null;
  if (pc) {
    try { pc.getSenders().forEach((sender) => { try { sender.replaceTrack(null); } catch {} }); } catch {}
    try { pc.close(); } catch {}
  }
  ui.remoteVideo.srcObject = null;
  ui.stage.classList.remove('has-remote-video');
}

async function replaceSender(kind, track) {
  const pc = state.pc;
  if (!pc) return;
  let sender = pc.getSenders().find((item) => item.track?.kind === kind);
  if (!sender) sender = pc.addTransceiver(kind, { direction: 'sendrecv' }).sender;
  await sender.replaceTrack(track);
}

async function ensureAudioGraph() {
  if (state.audio && state.audio.ctx?.state !== 'closed') return state.audio;
  const raw = state.media?.getAudioTracks()[0];
  if (!raw) throw new Error('no audio');
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) throw new Error('no audio context');
  const ctx = new Context({ latencyHint: 'interactive', sampleRate: 48000 });
  await ctx.resume();
  const source = ctx.createMediaStreamSource(new MediaStream([raw]));
  const volume = ctx.createGain();
  const sfxGain = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  volume.gain.value = state.volume;
  sfxGain.gain.value = 1;
  source.connect(volume);
  sfxGain.connect(dest);
  state.audio = { ctx, source, volume, sfxGain, dest, raw, processors: [] };
  rebuildEffectChain(ui.voiceEffect.value);
  state.outgoingAudioTrack = dest.stream.getAudioTracks()[0];
  await replaceSender('audio', state.outgoingAudioTrack);
  return state.audio;
}

function rebuildEffectChain(kind) {
  const graph = state.audio;
  if (!graph) return;
  graph.processors.forEach((node) => { try { node.stop?.(); } catch {} try { node.disconnect(); } catch {} });
  graph.processors = [];
  try { graph.volume.disconnect(); } catch {}
  let input = graph.volume;
  const ctx = graph.ctx;
  const makeFilter = (type, frequency, q = 1, gain = 0) => {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    filter.gain.value = gain;
    return filter;
  };
  if (kind === 'high') {
    const highpass = makeFilter('highpass', 250);
    const peak = makeFilter('peaking', 1800, 1, 7);
    input.connect(highpass).connect(peak).connect(graph.dest);
    graph.processors = [highpass, peak];
  } else if (kind === 'deep') {
    const lowpass = makeFilter('lowpass', 1900);
    const peak = makeFilter('peaking', 180, 1.1, 6);
    input.connect(lowpass).connect(peak).connect(graph.dest);
    graph.processors = [lowpass, peak];
  } else if (kind === 'radio') {
    const band = makeFilter('bandpass', 1100, .8);
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortion(12);
    input.connect(band).connect(shaper).connect(graph.dest);
    graph.processors = [band, shaper];
  } else if (kind === 'robot') {
    const band = makeFilter('bandpass', 1300, .9);
    const shaper = ctx.createWaveShaper();
    shaper.curve = makeDistortion(4);
    const tremolo = ctx.createGain();
    tremolo.gain.value = .7;
    const oscillator = ctx.createOscillator();
    const lfo = ctx.createGain();
    oscillator.frequency.value = 28;
    lfo.gain.value = .28;
    oscillator.connect(lfo).connect(tremolo.gain);
    oscillator.start();
    input.connect(band).connect(shaper).connect(tremolo).connect(graph.dest);
    graph.processors = [band, shaper, tremolo, lfo, oscillator];
  } else {
    input.connect(graph.dest);
  }
}

function makeDistortion(amount) {
  const samples = 44_100;
  const curve = new Float32Array(samples);
  const k = amount;
  for (let index = 0; index < samples; index += 1) {
    const x = index * 2 / samples - 1;
    curve[index] = (3 + k) * x * 20 * Math.PI / 180 / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

async function applyAudioSettings() {
  const raw = state.media?.getAudioTracks()[0];
  if (!raw) return;
  state.volume = Number(ui.volumeRange.value) / 100;
  ui.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  const effect = ui.voiceEffect.value;

  if (effect === 'off' && Date.now() - state.lastSfxAt > 1200) {
    try { await state.audio?.ctx?.close(); } catch {}
    state.audio = null;
    state.outgoingAudioTrack = null;
    await replaceSender('audio', raw);
    return;
  }

  const graph = await ensureAudioGraph();
  graph.volume.gain.value = state.volume;
  rebuildEffectChain(effect);
  state.outgoingAudioTrack = graph.dest.stream.getAudioTracks()[0];
  await replaceSender('audio', state.outgoingAudioTrack);
}

async function playReactionSound(kind, remote = true) {
  const allowed = new Set(['duck', 'pop', 'bell', 'laser', 'boing']);
  if (!allowed.has(kind)) return;
  const graph = await ensureAudioGraph().catch(() => null);
  if (!graph) return;
  const ctx = graph.ctx;
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const target = remote ? graph.sfxGain : ctx.destination;
  const now = ctx.currentTime;
  const gain = ctx.createGain();
  const oscillator = ctx.createOscillator();
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.22, now + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .55);
  gain.connect(target);
  oscillator.type = kind === 'duck' ? 'square' : kind === 'laser' ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime({ duck: 180, pop: 240, bell: 680, laser: 320, boing: 120 }[kind], now);
  oscillator.frequency.exponentialRampToValueAtTime({ duck: 90, pop: 60, bell: 900, laser: 1200, boing: 55 }[kind], now + .35);
  oscillator.connect(gain);
  oscillator.start(now);
  oscillator.stop(now + .58);
  state.lastSfxAt = Date.now();
  setTimeout(() => { if (ui.voiceEffect.value === 'off') applyAudioSettings().catch(() => {}); }, 1100);
}

function applyButtonStates() {
  const audioTrack = state.media?.getAudioTracks()[0];
  const videoTrack = state.media?.getVideoTracks()[0];
  const micOn = audioTrack?.enabled ?? false;
  const cameraOn = videoTrack?.enabled ?? false;
  ui.micBtn.classList.toggle('off', !micOn);
  ui.cameraBtn.classList.toggle('off', !cameraOn);
  ui.micBtn.setAttribute('aria-pressed', String(micOn));
  ui.cameraBtn.setAttribute('aria-pressed', String(cameraOn));
  ui.pip.classList.toggle('cam-off', !cameraOn);
}

ui.micBtn.addEventListener('click', () => {
  const track = state.media?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  applyButtonStates();
});

ui.cameraBtn.addEventListener('click', () => {
  const track = state.media?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  applyCameraUi();
  applyButtonStates();
});

ui.awayBtn.addEventListener('click', () => {
  if (!state.peerId) return;
  state.away = !state.away;
  ui.awayBtn.classList.toggle('active', state.away);
  send({ type: 'away', value: state.away });
  toast(state.away ? 'Статус «Отошёл» включён.' : 'Статус «Отошёл» выключен.');
});

ui.reactionBtn.addEventListener('click', () => {
  ui.reactionDock.hidden = !ui.reactionDock.hidden;
  ui.reactionBtn.classList.toggle('active', !ui.reactionDock.hidden);
});

ui.reactionSoundsToggle.checked = state.reactionSounds;
ui.reactionSoundsToggle.addEventListener('change', () => {
  state.reactionSounds = ui.reactionSoundsToggle.checked;
  localStorage.setItem('elvarReactionSounds', state.reactionSounds ? '1' : '0');
  if (!state.reactionSounds) ui.reactionDock.hidden = true;
});

ui.reactionDock.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-sound]');
  if (!button || !state.reactionSounds || !state.peerId) return;
  await playReactionSound(button.dataset.sound, false);
  send({ type: 'reaction', sound: button.dataset.sound });
});

ui.nextBtn.addEventListener('click', () => {
  if (state.ws?.readyState !== WebSocket.OPEN) {
    toast('Соединение с сервером ещё не готово.');
    return;
  }
  state.avoidPeerId = state.peerId;
  state.pendingChat.clear();
  resetPeerConnection();
  resetPeerDataOnly();
  setRoomMode('searching');
  const sent = send({ type: 'next' });
  ui.nextBtn.disabled = true;
  setTimeout(() => { ui.nextBtn.disabled = false; }, 700);
  if (!sent) toast('Не удалось начать новый поиск.');
});

ui.endBtn.addEventListener('click', stopSession);
ui.reportBtn.addEventListener('click', () => { if (state.peerId) openOverlay(ui.reportModal); });

ui.reportForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.peerId) return closeOverlay(ui.reportModal);
  const reason = ui.reportReason.value.trim();
  state.avoidPeerId = state.peerId;
  send({ type: 'report', reason });
  ui.reportReason.value = '';
  closeOverlay(ui.reportModal);
  handlePeerLost('left');
  setRoomMode('searching');
});
ui.cancelReport.addEventListener('click', () => closeOverlay(ui.reportModal));
ui.cancelReportAction.addEventListener('click', () => closeOverlay(ui.reportModal));

ui.supportBtn.addEventListener('click', () => {
  if (APP.donateUrl) window.open(APP.donateUrl, '_blank', 'noopener,noreferrer');
  else toast('Добавь ссылку поддержки в APP.donateUrl.');
});
ui.feedbackBtn.addEventListener('click', () => openOverlay(ui.feedbackModal));
ui.cancelFeedback.addEventListener('click', () => closeOverlay(ui.feedbackModal));
ui.cancelFeedbackAction.addEventListener('click', () => closeOverlay(ui.feedbackModal));

ui.feedbackForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    kind: 'feedback',
    name: ui.feedbackName.value.trim(),
    email: ui.feedbackEmail.value.trim(),
    message: ui.feedbackMessage.value.trim(),
  };
  try {
    const response = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!data.ok) throw new Error(data.error || 'failed');
    closeOverlay(ui.feedbackModal);
    ui.feedbackMessage.value = '';
    toast(data.emailHandled ? 'Сообщение отправлено владельцу.' : 'Сообщение сохранено.');
    if (!data.emailHandled) window.location.href = `mailto:${APP.supportEmail}?subject=${encodeURIComponent('ELVAR — обратная связь')}&body=${encodeURIComponent(body.message)}`;
  } catch {
    window.location.href = `mailto:${APP.supportEmail}?subject=${encodeURIComponent('ELVAR — обратная связь')}&body=${encodeURIComponent(body.message)}`;
  }
});

ui.chatToggle.addEventListener('click', toggleChat);
ui.chatBtnBottom.addEventListener('click', toggleChat);
ui.chatClose.addEventListener('click', () => { ui.chatPanel.hidden = true; });

function toggleChat() {
  if (!state.peerId) {
    toast('Чат появится после подключения к собеседнику.');
    return;
  }
  ui.chatPanel.hidden = !ui.chatPanel.hidden;
  if (!ui.chatPanel.hidden) requestAnimationFrame(() => ui.chatInput.focus());
}

ui.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = ui.chatInput.value.trim();
  if (!text || !state.peerId) return;
  if (state.ws?.readyState !== WebSocket.OPEN) {
    toast('Чат временно недоступен.');
    return;
  }
  const messageId = crypto.randomUUID();
  addChatMessage(text, 'me', messageId, 'pending');
  state.pendingChat.set(messageId, Date.now());
  const sent = send({ type: 'chat', messageId, text });
  if (!sent) {
    state.pendingChat.delete(messageId);
    updateChatMessage(messageId, 'failed');
    toast('Сообщение не отправлено.');
    return;
  }
  ui.chatInput.value = '';
});

function clearChat() {
  ui.chatMessages.innerHTML = '<div class="chat-empty">Когда вы соединитесь, сообщения будут появляться здесь.</div>';
}

function addChatMessage(text, who, messageId = '', delivery = '') {
  if (!text) return;
  const empty = ui.chatMessages.querySelector('.chat-empty');
  if (empty) empty.remove();
  const item = document.createElement('div');
  item.className = `message ${who === 'me' ? 'me' : 'peer'}`;
  if (messageId) item.dataset.messageId = messageId;
  const body = document.createElement('span');
  body.className = 'message-body';
  body.textContent = text;
  item.append(body);
  if (who === 'me') {
    const status = document.createElement('small');
    status.className = `message-state ${delivery}`;
    status.textContent = delivery === 'pending' ? 'отправка…' : delivery === 'failed' ? 'не отправлено' : 'отправлено';
    item.append(status);
  }
  ui.chatMessages.append(item);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

function updateChatMessage(messageId, stateName) {
  const item = ui.chatMessages.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
  if (!item) return;
  const stateElement = item.querySelector('.message-state');
  if (!stateElement) return;
  stateElement.className = `message-state ${stateName}`;
  stateElement.textContent = stateName === 'failed' ? 'не отправлено' : 'отправлено';
}

function markChatSent(messageId) {
  if (!messageId) return;
  state.pendingChat.delete(messageId);
  updateChatMessage(messageId, 'sent');
}

function handleIncomingChat(message) {
  if (message.messageId && message.messageId === state.lastReceivedMessageId) return;
  state.lastReceivedMessageId = message.messageId || '';
  addChatMessage(message.text, 'peer', message.messageId || '');
  if (ui.chatPanel.hidden) {
    ui.chatToggle.classList.add('attention');
    clearTimeout(ui.chatToggle.attentionTimer);
    ui.chatToggle.attentionTimer = setTimeout(() => ui.chatToggle.classList.remove('attention'), 2400);
  }
}

ui.fullscreenBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await ui.stage.requestFullscreen();
  } catch {}
});

ui.cameraFilter.addEventListener('change', () => { state.camFilter = ui.cameraFilter.value; applyCameraUi(); });
ui.mirrorToggle.addEventListener('change', () => { state.mirror = ui.mirrorToggle.checked; applyCameraUi(); });
ui.cameraSelect.addEventListener('change', () => switchDevice('video', ui.cameraSelect.value).catch(() => toast('Не удалось сменить камеру.')));
ui.micSelect.addEventListener('change', () => switchDevice('audio', ui.micSelect.value).catch(() => toast('Не удалось сменить микрофон.')));
ui.volumeRange.addEventListener('input', () => applyAudioSettings().catch(() => {}));
ui.voiceEffect.addEventListener('change', () => applyAudioSettings().catch(() => toast('Эффект недоступен в этом браузере.')));

async function switchDevice(kind, deviceId) {
  if (!state.media || !deviceId) return;
  const isVideo = kind === 'video';
  const constraints = isVideo
    ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } }
    : { audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 } };
  const fresh = await navigator.mediaDevices.getUserMedia(constraints);
  const newTrack = isVideo ? fresh.getVideoTracks()[0] : fresh.getAudioTracks()[0];
  const oldTrack = isVideo ? state.media.getVideoTracks()[0] : state.media.getAudioTracks()[0];
  if (oldTrack) {
    newTrack.enabled = oldTrack.enabled;
    state.media.removeTrack(oldTrack);
    oldTrack.stop();
  }
  state.media.addTrack(newTrack);
  if (isVideo) {
    state.camDevicePreference = deviceId;
    localStorage.setItem('elvarCameraDevice', deviceId);
    ui.localVideo.srcObject = state.media;
    await replaceSender('video', newTrack);
  } else {
    state.micDevicePreference = deviceId;
    localStorage.setItem('elvarMicDevice', deviceId);
    try { await state.audio?.ctx?.close(); } catch {}
    state.audio = null;
    state.outgoingAudioTrack = null;
    await applyAudioSettings();
    if (ui.voiceEffect.value === 'off') await replaceSender('audio', newTrack);
  }
  await enumerateDevices();
  applyButtonStates();
}

function applyCameraUi() {
  const filters = {
    normal: 'none',
    soft: 'saturate(.92) brightness(1.02) contrast(.96)',
    mono: 'grayscale(1)',
    contrast: 'contrast(1.16) saturate(1.04)',
    warm: 'sepia(.14) saturate(1.08)',
  };
  ui.localVideo.style.filter = filters[state.camFilter] || 'none';
  ui.localVideo.style.transform = state.mirror ? 'scaleX(-1)' : 'scaleX(1)';
}

function startStatsPolling() {
  stopStatsPolling();
  sampleStats();
  state.statsTimer = setInterval(sampleStats, APP.statsMs);
}

function stopStatsPolling() {
  clearInterval(state.statsTimer);
  state.statsTimer = null;
}

async function sampleStats() {
  if (!state.pc) return;
  try {
    const report = await state.pc.getStats();
    let rtt = null;
    let jitter = null;
    report.forEach((item) => {
      if (item.type === 'candidate-pair' && item.state === 'succeeded' && typeof item.currentRoundTripTime === 'number') rtt = Math.min(rtt == null ? Infinity : rtt, item.currentRoundTripTime * 1000);
      if (item.type === 'inbound-rtp' && (item.kind === 'audio' || item.mediaType === 'audio') && item.jitterBufferEmittedCount > 0 && typeof item.jitterBufferDelay === 'number') jitter = Math.min(jitter == null ? Infinity : jitter, (item.jitterBufferDelay / item.jitterBufferEmittedCount) * 1000);
    });
    if (Number.isFinite(rtt)) state.peerRtt = rtt;
    state.voiceDelay = Number.isFinite(state.peerRtt) ? Math.max(0, state.peerRtt / 2 + (jitter || 0)) : null;
    updateMetrics();
  } catch {}
}

function updateMetrics() {
  ui.rttValue.textContent = fmtMs(state.peerRtt);
  ui.voiceDelayValue.textContent = fmtMs(state.voiceDelay);
  ui.localLatencyMetric.textContent = fmtMs(state.localRtt);
  ui.peerLatencyMetric.textContent = fmtMs(state.peerRtt);
  ui.voiceMetric.textContent = fmtMs(state.voiceDelay);
  ui.localGeoMetric.textContent = countryName(state.geoCountry);
  ui.networkNote.textContent = state.peerRtt ? `Собеседник: ${countryName(state.peerGeoCountry)} · показатели обновляются автоматически.` : 'Подключись к собеседнику, чтобы увидеть реальные значения.';
}

function fmtMs(value) { return Number.isFinite(value) ? `${Math.round(value)} мс` : '—'; }

ui.settingsBtn.addEventListener('click', async () => {
  await enumerateDevices().catch(() => {});
  refreshProfileUi();
  openOverlay(ui.settingsModal);
});
ui.closeSettings.addEventListener('click', () => closeOverlay(ui.settingsModal));

document.querySelectorAll('.settings-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.settings-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.settings-section').forEach((section) => section.classList.toggle('active', section.dataset.panel === tab.dataset.tab));
  if (tab.dataset.tab === 'admin' && isOwner()) loadAdmin();
}));

ui.adminTokenButton.addEventListener('click', () => {
  const token = prompt('Введи ADMIN_TOKEN из Cloudflare Secret:');
  if (!token) return;
  state.adminToken = token;
  sessionStorage.setItem('elvarAdminToken', token);
  loadAdmin();
});
ui.adminRefresh.addEventListener('click', loadAdmin);

async function loadAdmin() {
  if (!isOwner()) return;
  if (!state.adminToken) {
    ui.adminGate.textContent = 'Нажми «Ключ» и вставь ADMIN_TOKEN. Он хранится только в текущей сессии браузера.';
    return;
  }
  try {
    const response = await fetch('/api/admin', { headers: { 'x-admin-token': state.adminToken } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'unauthorized');
    state.adminData = data;
    renderAdmin(data);
    ui.adminGate.textContent = `Онлайн: ${data.users.length}. Владелец: ${data.ownerEmail}`;
  } catch {
    ui.adminGate.textContent = 'Ключ не принят или сервер не настроен.';
  }
}

function renderAdmin(data) {
  ui.adminUsers.innerHTML = '';
  data.users.forEach((user) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const strong = document.createElement('strong');
    strong.textContent = `${user.name} · ${countryName(user.country)}`;
    const small = document.createElement('small');
    small.textContent = `${user.email || 'без email'} · сеть ${countryName(user.geoCountry)} · ${user.status}`;
    const actions = document.createElement('div');
    actions.className = 'admin-item-actions';
    const ban = document.createElement('button');
    ban.textContent = 'Бан 1ч';
    ban.onclick = () => adminAction({ action: 'ban', profileId: user.profileId, minutes: 60, reason: 'Администратор' });
    actions.append(ban);
    item.append(strong, small, actions);
    ui.adminUsers.append(item);
  });
  renderRecords(ui.adminReports, data.reports, 'report');
  renderRecords(ui.adminFeedback, data.feedback, 'feedback');
}

function renderRecords(root, records, type) {
  root.innerHTML = '';
  records.forEach((record) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const strong = document.createElement('strong');
    strong.textContent = type === 'report' ? `Жалоба · ${record.reason}` : `${record.kind || 'feedback'}`;
    const small = document.createElement('small');
    small.textContent = type === 'report'
      ? `${record.reporter?.name || '?'} → ${record.reported?.name || '?'} · ${new Date(record.createdAt).toLocaleString()}`
      : `${record.name || 'anonymous'} ${record.email ? `· ${record.email}` : ''} · ${record.message || ''}`;
    item.append(strong, small);
    root.append(item);
  });
}

async function adminAction(body) {
  try {
    const response = await fetch('/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-token': state.adminToken }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'failed');
    toast('Готово.');
    loadAdmin();
  } catch {
    toast('Админ-действие не выполнено.');
  }
}

// Mini-games

document.querySelectorAll('[data-game]').forEach((button) => button.addEventListener('click', () => openGame(button.dataset.game)));
function openGame(name) {
  openOverlay(ui.gameModal);
  ui.snakeGame.hidden = name !== 'snake';
  ui.reactionGame.hidden = name !== 'reaction';
  ui.gameTitle.textContent = name === 'snake' ? 'Snake' : 'Reaction';
}
ui.closeGame.addEventListener('click', () => closeOverlay(ui.gameModal));

let snakeTimer = null;
let snakeRunning = false;
let snake = null;
let food = null;
let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
ui.snakeStart.addEventListener('click', startSnake);
function startSnake() {
  clearInterval(snakeTimer);
  snakeRunning = true;
  snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
  food = { x: 14, y: 10 };
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  ui.snakeScore.textContent = '0';
  drawSnake();
  snakeTimer = setInterval(stepSnake, 110);
}
function stepSnake() {
  if (!snakeRunning) return;
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.y < 0 || head.x >= 18 || head.y >= 18 || snake.some((part) => part.x === head.x && part.y === head.y)) {
    snakeRunning = false;
    clearInterval(snakeTimer);
    toast('Конец игры.');
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    ui.snakeScore.textContent = String(Number(ui.snakeScore.textContent) + 1);
    food = { x: Math.floor(Math.random() * 18), y: Math.floor(Math.random() * 18) };
  } else snake.pop();
  drawSnake();
}
function drawSnake() {
  const canvas = ui.snakeCanvas;
  const context = canvas.getContext('2d');
  const cell = canvas.width / 18;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#0e1115';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#87b9a8';
  context.fillRect(food.x * cell + 3, food.y * cell + 3, cell - 6, cell - 6);
  context.fillStyle = '#f4f6f7';
  snake.forEach((part, index) => {
    context.globalAlpha = index ? .68 : 1;
    context.fillRect(part.x * cell + 3, part.y * cell + 3, cell - 6, cell - 6);
  });
  context.globalAlpha = 1;
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  const map = { arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 } };
  const next = map[key];
  if (next && !isOpposite(next, dir)) {
    nextDir = next;
    event.preventDefault();
  }
});
function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y; }

let reactionStartAt = 0;
let reactionTimer = null;
ui.reactionStart.addEventListener('click', startReaction);
function startReaction() {
  clearTimeout(reactionTimer);
  reactionStartAt = 0;
  ui.reactionTarget.textContent = 'Жди…';
  ui.reactionTarget.className = 'reaction-target';
  ui.reactionScore.textContent = '';
  const delay = 900 + Math.random() * 2500;
  reactionTimer = setTimeout(() => {
    reactionStartAt = performance.now();
    ui.reactionTarget.textContent = 'ЖМИ';
    ui.reactionTarget.classList.add('ready');
  }, delay);
}
ui.reactionTarget.addEventListener('click', () => {
  if (!reactionStartAt) return;
  const milliseconds = Math.round(performance.now() - reactionStartAt);
  ui.reactionScore.textContent = `${milliseconds} мс`;
  ui.reactionTarget.classList.add('hit');
  reactionStartAt = 0;
});

// Draggable local preview

let drag = null;
ui.pip.addEventListener('pointerdown', (event) => {
  drag = { sx: event.clientX, sy: event.clientY, left: ui.pip.offsetLeft, top: ui.pip.offsetTop };
  ui.pip.setPointerCapture(event.pointerId);
  ui.pip.classList.add('dragging');
});
ui.pip.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const rect = ui.stage.getBoundingClientRect();
  const width = ui.pip.offsetWidth;
  const height = ui.pip.offsetHeight;
  const left = Math.min(Math.max(10, drag.left + event.clientX - drag.sx), rect.width - width - 10);
  const top = Math.min(Math.max(10, drag.top + event.clientY - drag.sy), rect.height - height - 10);
  ui.pip.style.left = `${left}px`;
  ui.pip.style.top = `${top}px`;
  ui.pip.style.right = 'auto';
  ui.pip.style.bottom = 'auto';
});
ui.pip.addEventListener('pointerup', () => {
  drag = null;
  ui.pip.classList.remove('dragging');
  localStorage.setItem('elvarPip', JSON.stringify({ left: ui.pip.style.left, top: ui.pip.style.top }));
});
ui.pip.addEventListener('pointercancel', () => {
  drag = null;
  ui.pip.classList.remove('dragging');
});
function restorePip() {
  try {
    const position = JSON.parse(localStorage.getItem('elvarPip') || 'null');
    if (!position) return;
    ui.pip.style.left = position.left || '';
    ui.pip.style.top = position.top || '';
    ui.pip.style.right = position.left ? 'auto' : '';
    ui.pip.style.bottom = position.top ? 'auto' : '';
  } catch {}
}

function stopSession() {
  state.active = false;
  state.intentionalClose = true;
  clearTimeout(state.reconnectTimer);
  stopHeartbeat();
  stopSearchPulse();
  try { state.ws?.close(1000, 'leave'); } catch {}
  state.ws = null;
  resetPeerConnection();
  state.peerId = null;
  state.peerProfile = null;
  state.away = false;
  state.avoidPeerId = null;
  if (state.audio?.ctx) state.audio.ctx.close().catch(() => {});
  state.audio = null;
  state.outgoingAudioTrack = null;
  state.media?.getTracks().forEach((track) => track.stop());
  state.media = null;
  ui.localVideo.srcObject = null;
  ui.remoteVideo.srcObject = null;
  ui.settingsBtn.hidden = true;
  ui.chatPanel.hidden = true;
  ui.reactionDock.hidden = true;
  ui.reactionBtn.classList.remove('active');
  ui.micBtn.classList.remove('off');
  ui.cameraBtn.classList.remove('off');
  ui.awayBtn.classList.remove('active');
  resetPeerDataOnly();
  setRoomMode('searching');
  setView('landing');
}

window.addEventListener('online', () => {
  if (state.active && !state.ws) {
    clearTimeout(state.reconnectTimer);
    connectSocket();
  }
});
window.addEventListener('pagehide', () => {
  state.intentionalClose = true;
  try { state.ws?.close(1000, 'unload'); } catch {}
  state.media?.getTracks().forEach((track) => track.stop());
});
navigator.mediaDevices?.addEventListener?.('devicechange', () => enumerateDevices().catch(() => {}));

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const overlays = [ui.gameModal, ui.reportModal, ui.feedbackModal, ui.settingsModal, ui.profileModal, ui.permissionModal];
  const open = overlays.find((overlay) => !overlay.hidden);
  if (open) closeOverlay(open);
});

// Initial state
initProfileForm();
refreshProfileUi();
restorePip();
ui.targetCountry.value = state.targetCountry;
state.geoCountry = 'ZZ';
updateMetrics();
applyButtonStates();
openModalOnOutsideClick(ui.profileModal);
openModalOnOutsideClick(ui.settingsModal);
openModalOnOutsideClick(ui.permissionModal);
openModalOnOutsideClick(ui.reportModal);
openModalOnOutsideClick(ui.feedbackModal);
openModalOnOutsideClick(ui.gameModal);
