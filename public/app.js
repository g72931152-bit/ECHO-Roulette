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
  startBtn: $('startBtn'), editProfileLanding: $('editProfileLanding'),
  landingAvatar: $('landingAvatar'), landingName: $('landingName'), landingMeta: $('landingMeta'),
  topAvatar: $('topAvatar'), topName: $('topName'), profileBtn: $('profileBtn'),
  supportBtn: $('supportBtn'), feedbackBtn: $('feedbackBtn'), settingsBtn: $('settingsBtn'),
  remoteVideo: $('remoteVideo'), localVideo: $('localVideo'), remotePlaceholder: $('remotePlaceholder'),
  disconnectMark: $('disconnectMark'), searchFigures: $('searchFigures'), roomTitle: $('roomTitle'), roomSubtitle: $('roomSubtitle'),
  peerStatus: $('peerStatus'), statusDot: $('statusDot'), peerCard: $('peerCard'), peerAvatar: $('peerAvatar'), peerName: $('peerName'), peerCountry: $('peerCountry'), peerOwnerBadge: $('peerOwnerBadge'), peerAway: $('peerAway'),
  pip: $('pip'), pipLabel: $('pipLabel'), pipFallback: $('pipAvatarFallback'),
  micBtn: $('micBtn'), cameraBtn: $('cameraBtn'), reactionBtn: $('reactionBtn'), awayBtn: $('awayBtn'), chatBtnBottom: $('chatBtnBottom'), nextBtn: $('nextBtn'), reportBtn: $('reportBtn'), endBtn: $('endBtn'),
  reactionDock: $('reactionDock'), reactionSoundsToggle: $('reactionSoundsToggle'), chatToggle: $('chatToggle'), fullscreenBtn: $('fullscreenBtn'), chatPanel: $('chatPanel'), chatClose: $('chatClose'), chatMessages: $('chatMessages'), chatForm: $('chatForm'), chatInput: $('chatInput'), chatPeerLabel: $('chatPeerLabel'),
  connectionStats: $('connectionStats'), rttValue: $('rttValue'), voiceDelayValue: $('voiceDelayValue'),
  permissionModal: $('permissionModal'), allowPermission: $('allowPermission'), cancelPermission: $('cancelPermission'),
  profileModal: $('profileModal'), profileForm: $('profileForm'), profileName: $('profileName'), profileEmail: $('profileEmail'), profileCountry: $('profileCountry'), targetCountry: $('targetCountry'), profileBio: $('profileBio'), avatarSelect: $('avatarSelect'), avatarFile: $('avatarFile'), profilePreview: $('profilePreview'), closeProfile: $('closeProfile'),
  settingsModal: $('settingsModal'), closeSettings: $('closeSettings'), micSelect: $('micSelect'), cameraSelect: $('cameraSelect'), volumeRange: $('volumeRange'), volumeValue: $('volumeValue'), voiceEffect: $('voiceEffect'), cameraFilter: $('cameraFilter'), mirrorToggle: $('mirrorToggle'), settingsProfileBox: $('settingsProfileBox'), editProfileSettings: $('editProfileSettings'),
  localLatencyMetric: $('localLatencyMetric'), peerLatencyMetric: $('peerLatencyMetric'), voiceMetric: $('voiceMetric'), localGeoMetric: $('localGeoMetric'), networkNote: $('networkNote'),
  adminTabButton: $('adminTabButton'), adminGate: $('adminGate'), adminRefresh: $('adminRefresh'), adminTokenButton: $('adminTokenButton'), adminUsers: $('adminUsers'), adminReports: $('adminReports'), adminFeedback: $('adminFeedback'),
  reportModal: $('reportModal'), reportForm: $('reportForm'), reportReason: $('reportReason'), cancelReport: $('cancelReport'),
  feedbackModal: $('feedbackModal'), feedbackForm: $('feedbackForm'), feedbackName: $('feedbackName'), feedbackEmail: $('feedbackEmail'), feedbackMessage: $('feedbackMessage'), cancelFeedback: $('cancelFeedback'),
  gameModal: $('gameModal'), closeGame: $('closeGame'), gameTitle: $('gameTitle'), snakeGame: $('snakeGame'), snakeCanvas: $('snakeCanvas'), snakeScore: $('snakeScore'), snakeStart: $('snakeStart'), reactionGame: $('reactionGame'), reactionTarget: $('reactionTarget'), reactionScore: $('reactionScore'), reactionStart: $('reactionStart'),
  toast: $('toast'),
};

const state = {
  profile: loadProfile(),
  targetCountry: localStorage.getItem('elvarTargetCountry') || 'ANY',
  geoCountry: 'ZZ',
  ws: null, pc: null, media: null,
  peerId: null, roomId: null, role: null, peerProfile: null, peerGeoCountry: 'ZZ', peerAway: false,
  pendingCandidates: [],
  avoidPeerId: null,
  active: false, intentionalClose: false,
  reconnectTimer: null, reconnectAttempts: 0,
  heartbeatTimer: null, pingOutstanding: null,
  statsTimer: null, localRtt: null, peerRtt: null, voiceDelay: null,
  away: false,
  audio: null, outgoingAudioTrack: null, volume: 1,
  lastSfxAt: 0, reactionSounds: localStorage.getItem('elvarReactionSounds') !== '0',
  camFilter: 'normal', mirror: true,
  adminToken: sessionStorage.getItem('elvarAdminToken') || '', adminData: null,
  uiMode: 'landing',
};

const RTC_CONFIG = { iceServers: APP.stun, bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' };

/* ---------- helpers ---------- */
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
function addOption(select, value, label) { const opt = document.createElement('option'); opt.value = value; opt.textContent = label; select.append(opt); }
function safeJsonParse(raw) { try { return JSON.parse(raw); } catch { return null; } }
function toast(message) { ui.toast.textContent = message; ui.toast.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => ui.toast.classList.remove('show'), 3000); }
function getWsUrl() { const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'; const url = new URL(`${proto}//${location.host}/ws`); if (state.avoidPeerId) url.searchParams.set('avoid', state.avoidPeerId); return url.toString(); }
function normalizeName(name) { return (name || '').trim().slice(0,32); }
function isOwner() { return Boolean(state.profile?.email && state.profile.email.toLowerCase() === APP.ownerEmail.toLowerCase()); }
function profileComplete() { return Boolean(state.profile?.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.profile.email || '') && state.profile.country); }
function profilePublic() { return state.profile ? {...state.profile} : null; }
function createProfile() { return { profileId: crypto.randomUUID(), name:'', email:'', country:'TR', bio:'', avatar:'◉', image:'' }; }
function loadProfile() { try { const v = JSON.parse(localStorage.getItem('elvarProfile') || 'null'); return v && typeof v === 'object' ? v : createProfile(); } catch { return createProfile(); } }
function saveProfile() { localStorage.setItem('elvarProfile', JSON.stringify(state.profile)); localStorage.setItem('elvarTargetCountry', state.targetCountry); refreshProfileUi(); }
function refreshProfileUi() {
  const p = state.profile || createProfile();
  setAvatarElement(ui.topAvatar, p); setAvatarElement(ui.landingAvatar, p); setAvatarElement(ui.pipFallback, p);
  ui.topName.textContent = p.name || 'Профиль';
  ui.landingName.textContent = p.name || 'Профиль ещё не создан';
  ui.landingMeta.textContent = p.name ? `${countryName(p.country)} · ${p.bio || 'без описания'}` : 'Имя · страна · описание';
  ui.pipLabel.textContent = p.name || 'Ты';
  ui.adminTabButton.hidden = !isOwner();
  ui.settingsProfileBox.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'setting-profile';
  const av = document.createElement('span'); av.className='avatar'; setAvatarElement(av,p);
  const copy=document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=p.name||'Без имени'; const small=document.createElement('small'); small.textContent=p.email||'Email не указан'; small.style.color='var(--muted)'; copy.append(strong,small); wrap.append(av,copy); ui.settingsProfileBox.append(wrap);
}
function setAvatarElement(el, p) { el.innerHTML=''; if (p?.image) { const img=document.createElement('img'); img.src=p.image; img.alt=''; el.append(img); } else el.textContent=p?.avatar || '+'; }
function setView(view) { ui.landing.classList.toggle('active', view==='landing'); ui.room.classList.toggle('active', view==='room'); ui.settingsBtn.hidden = view!=='room'; state.uiMode=view; document.body.classList.toggle('in-room', view==='room'); }
function openOverlay(el) { el.hidden=false; requestAnimationFrame(()=>el.classList.add('showing')); }
function closeOverlay(el) { el.classList.remove('showing'); setTimeout(()=>{el.hidden=true;},160); }
function openModalOnOutsideClick(el) { el.addEventListener('click', e=>{ if(e.target===el) closeOverlay(el); }); }

/* ---------- profile ---------- */
function initProfileForm() {
  fillCountries(ui.profileCountry, false); fillCountries(ui.targetCountry, true);
  ui.avatarSelect.innerHTML=''; AVATARS.forEach(v=>addOption(ui.avatarSelect,v,v));
  populateProfileForm();
}
function populateProfileForm() {
  const p=state.profile||createProfile(); ui.profileName.value=p.name||''; ui.profileEmail.value=p.email||''; ui.profileCountry.value=p.country||'TR'; ui.targetCountry.value=state.targetCountry||'ANY'; ui.profileBio.value=p.bio||''; ui.avatarSelect.value=p.avatar||'◉'; renderProfilePreview();
}
function renderProfilePreview() { setAvatarElement(ui.profilePreview,{...state.profile, avatar:ui.avatarSelect.value || state.profile.avatar, image:state.profile.image||''}); }
ui.profileBtn.addEventListener('click',()=>{populateProfileForm();openOverlay(ui.profileModal)});
ui.editProfileLanding.addEventListener('click',()=>{populateProfileForm();openOverlay(ui.profileModal)});
ui.editProfileSettings.addEventListener('click',()=>{closeOverlay(ui.settingsModal);populateProfileForm();openOverlay(ui.profileModal)});
ui.closeProfile.addEventListener('click',()=>closeOverlay(ui.profileModal));
ui.avatarSelect.addEventListener('change',renderProfilePreview);
ui.avatarFile.addEventListener('change', async()=>{ const file=ui.avatarFile.files?.[0]; if(!file) return; if(file.size>2_000_000){toast('Изображение слишком большое. Выбери файл до 2 МБ.');ui.avatarFile.value='';return;} const data=await resizeImage(file,96,.68); if(data.length>9000){toast('Слишком тяжёлое изображение. Выбери более простую картинку.');ui.avatarFile.value='';return;} state.profile.image=data; renderProfilePreview(); });
ui.profileForm.addEventListener('submit',e=>{e.preventDefault(); const name=normalizeName(ui.profileName.value); const email=ui.profileEmail.value.trim().toLowerCase(); if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){toast('Заполни имя и корректный email.');return;} state.profile={...(state.profile||createProfile()),name,email,country:ui.profileCountry.value||'TR',bio:ui.profileBio.value.trim().slice(0,180),avatar:ui.avatarSelect.value||'◉',image:state.profile.image||''}; state.targetCountry=ui.targetCountry.value||'ANY'; saveProfile(); if(state.ws?.readyState===WebSocket.OPEN) send({type:'profile',profile:profilePublic()}); closeOverlay(ui.profileModal); toast(isOwner()?'Профиль владельца сохранён.':'Профиль сохранён.'); });
async function resizeImage(file, size, quality=.74){ const url=URL.createObjectURL(file); const img=new Image(); img.src=url; await img.decode(); const canvas=document.createElement('canvas'); canvas.width=size;canvas.height=size;const ctx=canvas.getContext('2d');const side=Math.min(img.width,img.height);const sx=(img.width-side)/2,sy=(img.height-side)/2;ctx.drawImage(img,sx,sy,side,side,0,0,size,size);URL.revokeObjectURL(url);return canvas.toDataURL('image/jpeg',quality); }

/* ---------- permission/media ---------- */
ui.startBtn.addEventListener('click',()=>{ if(!profileComplete()){populateProfileForm();openOverlay(ui.profileModal);return;} openOverlay(ui.permissionModal); });
ui.cancelPermission.addEventListener('click',()=>closeOverlay(ui.permissionModal));
ui.allowPermission.addEventListener('click',async()=>{ui.allowPermission.disabled=true;try{await startSession();closeOverlay(ui.permissionModal);}catch(e){console.error(e);toast(mediaErrorMessage(e));}finally{ui.allowPermission.disabled=false;}});
async function startSession(){ await requestMedia(); state.active=true;state.intentionalClose=false;state.reconnectAttempts=0;state.away=false;state.avoidPeerId=null;setView('room');setRoomMode('searching');connectSocket(); }
async function requestMedia(){ if(!navigator.mediaDevices?.getUserMedia)throw Object.assign(new Error('unsupported'),{name:'UnsupportedError'}); if(state.media){applyCameraUi();return state.media;} state.media=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30},facingMode:'user'},audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000}}); ui.localVideo.srcObject=state.media; applyCameraUi(); await enumerateDevices();return state.media; }
async function enumerateDevices(){if(!navigator.mediaDevices?.enumerateDevices)return;const devices=await navigator.mediaDevices.enumerateDevices();fillDeviceSelect(ui.cameraSelect,devices.filter(d=>d.kind==='videoinput'),state.media?.getVideoTracks()[0]?.getSettings().deviceId);fillDeviceSelect(ui.micSelect,devices.filter(d=>d.kind==='audioinput'),state.media?.getAudioTracks()[0]?.getSettings().deviceId);}
function fillDeviceSelect(select,devices,current){const old=current||select.value;select.innerHTML='';devices.forEach((d,i)=>addOption(select,d.deviceId,d.label||`${d.kind==='videoinput'?'Камера':'Микрофон'} ${i+1}`));if([...select.options].some(o=>o.value===old))select.value=old;}
function mediaErrorMessage(e){if(!window.isSecureContext)return'Нужен HTTPS.';switch(e?.name){case'NotAllowedError':return'Разрешение на камеру или микрофон отклонено.';case'NotFoundError':return'Камера или микрофон не найдены.';case'NotReadableError':return'Устройство занято другим приложением.';default:return'Не удалось получить доступ к устройствам.';}}

/* ---------- websocket ---------- */
function connectSocket(){ if(!state.active)return;clearTimeout(state.reconnectTimer);state.intentionalClose=false;const ws=new WebSocket(getWsUrl());state.ws=ws;ws.addEventListener('open',()=>{if(state.ws!==ws)return;state.reconnectAttempts=0;startHeartbeat();send({type:'hello',profile:profilePublic(),targetCountry:state.targetCountry});setRoomMode('searching');});ws.addEventListener('message',async e=>{if(state.ws!==ws)return;const msg=safeJsonParse(e.data);if(msg)await handleServer(msg);});ws.addEventListener('close',e=>{if(state.ws!==ws)return;state.ws=null;stopHeartbeat();if(state.intentionalClose||!state.active)return;if(state.peerId)handlePeerLost('offline');setRoomMode('offline');scheduleReconnect();});ws.addEventListener('error',()=>{});}
function scheduleReconnect(){clearTimeout(state.reconnectTimer);state.reconnectAttempts++;const wait=Math.min(900*2**Math.min(state.reconnectAttempts-1,5),12000);state.reconnectTimer=setTimeout(connectSocket,wait);}
function send(payload){if(state.ws?.readyState===WebSocket.OPEN)state.ws.send(JSON.stringify(payload));}
function startHeartbeat(){stopHeartbeat();state.heartbeatTimer=setInterval(()=>{if(state.ws?.readyState===WebSocket.OPEN){state.pingOutstanding=performance.now();state.ws.send(JSON.stringify({type:'ping',clientTs:Date.now()}));}},APP.wsHeartbeatMs);}
function stopHeartbeat(){clearInterval(state.heartbeatTimer);state.heartbeatTimer=null;}
async function handleServer(msg){switch(msg.type){case'ready':state.clientId=msg.clientId;state.geoCountry=msg.geoCountry||'ZZ';updateMetrics();break;case'searching':setRoomMode('searching');break;case'matched':await onMatched(msg);break;case'signal':await handleSignal(msg.payload);break;case'peer-profile':setPeerProfile(msg.profile,msg.country,msg.isOwner);break;case'peer-away':state.peerAway=Boolean(msg.value);setPeerAwayUi();break;case'chat':addChatMessage(msg.text,'peer');break;case'reaction':if(state.reactionSounds)playReactionSound(msg.sound,false);break;case'peer-left':handlePeerLost(msg.reason||'left');break;case'reported_disconnect':handlePeerLost('reported');toast('Собеседник отключён.');break;case'report-saved':toast(msg.emailHandled?'Жалоба отправлена и сохранена.':'Жалоба сохранена в панели администратора.');break;case'pong':if(state.pingOutstanding){state.localRtt=Math.max(0,performance.now()-state.pingOutstanding);updateMetrics();state.pingOutstanding=null;}break;case'banned':handlePeerLost('banned');toast('Доступ ограничен администратором.');break;case'error':toast('Сервер отклонил действие.');break;}}

/* ---------- room UI ---------- */
function setRoomMode(mode){ui.stage.classList.toggle('live',mode==='live');ui.statusDot.className='status-dot';const map={searching:['Поиск','Подбираем собеседника'],connecting:['Подключение','Настраиваем аудио и видео'],live:['В эфире',''],left:['Поиск','Собеседник ушёл — ищем нового'],offline:['Нет связи','Соединение потеряно — переподключаемся'],failed:['Ошибка','Попробуй «Следующий».']};const [title,sub]=map[mode]||map.searching;ui.peerStatus.textContent=title;ui.roomTitle.textContent=title==='В эфире'&&state.peerProfile?'':title;ui.roomSubtitle.textContent=sub;ui.statusDot.classList.toggle('live',mode==='live');ui.statusDot.classList.toggle('error',mode==='offline'||mode==='failed');ui.disconnectMark.style.display=(mode==='offline'||mode==='failed'||mode==='left')?'block':'block';ui.searchFigures.style.display=(mode==='searching'||mode==='connecting'||mode==='left')?'block':'none';if(mode==='offline'||mode==='failed'){ui.disconnectMark.style.display='block';}if(mode==='searching'||mode==='left'){ui.disconnectMark.style.display='none';}if(mode==='live'&&state.peerProfile){ui.roomTitle.textContent='';ui.roomSubtitle.textContent='';} }
function setPeerProfile(profile,country,isOwner=false){state.peerProfile=profile||null;state.peerGeoCountry=country||'ZZ';ui.peerCard.hidden=!state.peerProfile;if(!state.peerProfile)return;setAvatarElement(ui.peerAvatar,state.peerProfile);ui.peerName.textContent=state.peerProfile.name||'Собеседник';ui.peerCountry.textContent=`${countryName(state.peerProfile.country)} · сеть: ${countryName(state.peerGeoCountry)}`;ui.chatPeerLabel.textContent=state.peerProfile.name||'Собеседник';ui.peerOwnerBadge.hidden=!Boolean(isOwner);setPeerAwayUi();ui.chatToggle.hidden=false;ui.connectionStats.hidden=false;ui.reportBtn.disabled=false;}
function setPeerAwayUi(){ui.peerAway.hidden=!state.peerAway;ui.peerAway.textContent=state.peerAway?'Отошёл':'';}
function handlePeerLost(reason){resetPeerConnection();state.peerId=null;state.roomId=null;state.peerProfile=null;state.peerAway=false;ui.peerCard.hidden=true;ui.chatToggle.hidden=true;ui.connectionStats.hidden=true;clearChat();ui.chatPanel.hidden=true;setPeerAwayUi();ui.reportBtn.disabled=true;if(state.active){setRoomMode(reason==='offline'?'offline':'left');}}

/* ---------- WebRTC ---------- */
async function onMatched(msg){resetPeerConnection();state.peerId=msg.peerId;state.roomId=msg.roomId;state.role=msg.role;setPeerProfile(msg.peer?.profile,msg.peer?.country);setRoomMode('connecting');if(msg.role==='caller'){const pc=await createPeerConnection();try{const offer=await pc.createOffer();await pc.setLocalDescription(offer);send({type:'signal',payload:{kind:'offer',description:pc.localDescription}});}catch(e){console.error(e);setRoomMode('failed');}}else{createPeerConnection().catch(()=>setRoomMode('failed'));}}
async function createPeerConnection(){const pc=new RTCPeerConnection(RTC_CONFIG);state.pc=pc;state.pendingCandidates=[];const sendTrack=state.outgoingAudioTrack||state.media?.getAudioTracks()[0];const video=state.media?.getVideoTracks()[0];if(video){const sender=pc.addTrack(video,state.media);try{const p=sender.getParameters();p.encodings=p.encodings?.length?p.encodings:[{}];p.encodings[0].maxBitrate=900000;p.encodings[0].maxFramerate=30;await Promise.resolve(sender.setParameters(p));}catch{}}if(sendTrack)pc.addTrack(sendTrack,new MediaStream([sendTrack]));pc.onicecandidate=e=>{if(state.pc===pc&&e.candidate)send({type:'signal',payload:{kind:'candidate',candidate:e.candidate}})};pc.ontrack=e=>{if(state.pc!==pc)return;const stream=e.streams?.[0]||new MediaStream([e.track]);ui.remoteVideo.srcObject=stream;ui.remoteVideo.muted=false;ui.remoteVideo.volume=1;try{if('playoutDelayHint' in e.receiver)e.receiver.playoutDelayHint=0;}catch{}ui.remoteVideo.play().catch(()=>{});};pc.onconnectionstatechange=()=>{if(state.pc!==pc)return;const s=pc.connectionState;if(s==='connected'){setRoomMode('live');startStatsPolling();}else if(s==='disconnected'){setRoomMode('offline');setTimeout(()=>{if(state.pc===pc&&pc.connectionState==='disconnected')handlePeerLost('offline');},3000);}else if(s==='failed'){setRoomMode('failed');}};pc.oniceconnectionstatechange=()=>{if(state.pc!==pc)return;if(['connected','completed'].includes(pc.iceConnectionState)){setRoomMode('live');}if(pc.iceConnectionState==='failed'){setRoomMode('failed');}};return pc;}
async function handleSignal(payload){const pc=state.pc;if(!pc||!payload)return;try{if(payload.description){await pc.setRemoteDescription(payload.description);if(payload.description.type==='offer'){const answer=await pc.createAnswer();await pc.setLocalDescription(answer);send({type:'signal',payload:{kind:'answer',description:pc.localDescription}});}for(const c of state.pendingCandidates.splice(0))await pc.addIceCandidate(c).catch(()=>{});}if(payload.candidate){if(pc.remoteDescription)await pc.addIceCandidate(payload.candidate).catch(()=>{});else state.pendingCandidates.push(payload.candidate);}}catch(e){console.error(e);if(state.pc===pc)setRoomMode('failed');}}
function resetPeerConnection(){state.pendingCandidates=[];stopStatsPolling();const pc=state.pc;state.pc=null;if(pc){try{pc.getSenders().forEach(s=>{try{s.replaceTrack(null)}catch{}});pc.close();}catch{}}ui.remoteVideo.srcObject=null;}
async function replaceSender(kind,track){const pc=state.pc;if(!pc)return;let sender=pc.getSenders().find(s=>s.track?.kind===kind);if(!sender){sender=pc.addTransceiver(kind,{direction:'sendrecv'}).sender;}await sender.replaceTrack(track);}

/* ---------- audio effects ---------- */
async function ensureAudioGraph(){if(state.audio?.ctx?.state!=='closed')return state.audio;const raw=state.media?.getAudioTracks()[0];if(!raw)throw new Error('no audio');const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)throw new Error('no audio context');const ctx=new Ctx({latencyHint:'interactive',sampleRate:48000});await ctx.resume();const source=ctx.createMediaStreamSource(new MediaStream([raw]));const volume=ctx.createGain();const sfxGain=ctx.createGain();volume.gain.value=state.volume;sfxGain.gain.value=1;const dest=ctx.createMediaStreamDestination();source.connect(volume);sfxGain.connect(dest);state.audio={ctx,source,volume,sfxGain,dest,raw,processors:[]};rebuildEffectChain(ui.voiceEffect.value);state.outgoingAudioTrack=dest.stream.getAudioTracks()[0];await replaceSender('audio',state.outgoingAudioTrack);return state.audio;}
function rebuildEffectChain(kind){const g=state.audio;if(!g)return;g.processors.forEach(n=>{try{n.stop?.()}catch{}try{n.disconnect()}catch{}});g.processors=[];try{g.volume.disconnect()}catch{}let input=g.volume;const ctx=g.ctx;const makeFilter=(type,freq,q=1,gain=0)=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=q;f.gain.value=gain;return f;};if(kind==='high'){const f=makeFilter('highpass',250);const p=makeFilter('peaking',1800,1,7);input.connect(f).connect(p).connect(g.dest);g.processors=[f,p];}else if(kind==='deep'){const f=makeFilter('lowpass',1900);const p=makeFilter('peaking',180,1.1,6);input.connect(f).connect(p).connect(g.dest);g.processors=[f,p];}else if(kind==='radio'){const f=makeFilter('bandpass',1100,.8);const sh=ctx.createWaveShaper();sh.curve=makeDistortion(12);input.connect(f).connect(sh).connect(g.dest);g.processors=[f,sh];}else if(kind==='robot'){const band=makeFilter('bandpass',1300,.9);const sh=ctx.createWaveShaper();sh.curve=makeDistortion(4);const trem=ctx.createGain();trem.gain.value=.7;const osc=ctx.createOscillator();const lfo=ctx.createGain();osc.frequency.value=28;lfo.gain.value=.28;osc.connect(lfo).connect(trem.gain);osc.start();input.connect(band).connect(sh).connect(trem).connect(g.dest);g.processors=[band,sh,trem,lfo,osc];}else{input.connect(g.dest);}}
function makeDistortion(amount){const n=44100;const c=new Float32Array(n);const k=amount;for(let i=0;i<n;i++){const x=i*2/n-1;c[i]=(3+k)*x*20*Math.PI/180/(Math.PI+k*Math.abs(x));}return c;}
async function applyAudioSettings(){const raw=state.media?.getAudioTracks()[0];if(!raw)return;const effect=ui.voiceEffect.value;state.volume=Number(ui.volumeRange.value)/100;ui.volumeValue.textContent=`${Math.round(state.volume*100)}%`;if(effect==='off'&&Date.now()-state.lastSfxAt>1200){try{state.audio?.processors?.forEach(n=>{try{n.disconnect()}catch{}});state.audio?.ctx?.close();}catch{}state.audio=null;state.outgoingAudioTrack=null;await replaceSender('audio',raw);return;}const g=await ensureAudioGraph();g.volume.gain.value=state.volume;rebuildEffectChain(effect);state.outgoingAudioTrack=g.dest.stream.getAudioTracks()[0];await replaceSender('audio',state.outgoingAudioTrack);}
async function playReactionSound(kind,remote=true){const allowed=new Set(['duck','pop','bell','laser','boing']);if(!allowed.has(kind))return;const g=await ensureAudioGraph().catch(()=>null);if(!g)return;const ctx=g.ctx;if(ctx.state==='suspended')await ctx.resume().catch(()=>{});const target=remote?g.sfxGain:ctx.destination;const now=ctx.currentTime;const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.22,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.55);gain.connect(target);const osc=ctx.createOscillator();osc.type=kind==='duck'?'square':kind==='laser'?'sawtooth':'sine';const start={duck:180,pop:240,bell:680,laser:320,boing:120}[kind];const end={duck:90,pop:60,bell:900,laser:1200,boing:55}[kind];osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+.35);osc.connect(gain);osc.start(now);osc.stop(now+.58);state.lastSfxAt=Date.now();setTimeout(()=>{if(ui.voiceEffect.value==='off')applyAudioSettings().catch(()=>{});},1100);}

/* ---------- devices and UI toggles ---------- */
ui.micBtn.addEventListener('click',()=>{const t=state.media?.getAudioTracks()[0];if(!t)return;t.enabled=!t.enabled;ui.micBtn.classList.toggle('off',!t.enabled);ui.micBtn.textContent=t.enabled?'◉':'⊘';});
ui.cameraBtn.addEventListener('click',()=>{const t=state.media?.getVideoTracks()[0];if(!t)return;t.enabled=!t.enabled;ui.cameraBtn.classList.toggle('off',!t.enabled);ui.cameraBtn.textContent=t.enabled?'▣':'□';ui.pip.classList.toggle('cam-off',!t.enabled);});
ui.awayBtn.addEventListener('click',()=>{if(!state.peerId)return;state.away=!state.away;ui.awayBtn.classList.toggle('active',state.away);send({type:'away',value:state.away});toast(state.away?'Статус «Отошёл» включён':'Ты снова здесь');});
ui.reactionBtn.addEventListener('click',()=>{ui.reactionDock.hidden=!ui.reactionDock.hidden;ui.reactionBtn.classList.toggle('active',!ui.reactionDock.hidden)});
ui.reactionSoundsToggle.checked=state.reactionSounds;ui.reactionSoundsToggle.addEventListener('change',()=>{state.reactionSounds=ui.reactionSoundsToggle.checked;localStorage.setItem('elvarReactionSounds',state.reactionSounds?'1':'0');if(!state.reactionSounds)ui.reactionDock.hidden=true;});
ui.reactionDock.addEventListener('click',async e=>{const b=e.target.closest('[data-sound]');if(!b||!state.reactionSounds)return;await playReactionSound(b.dataset.sound,false);send({type:'reaction',sound:b.dataset.sound});});
ui.nextBtn.addEventListener('click',()=>{if(!state.ws||state.ws.readyState!==WebSocket.OPEN)return toast('Сервер ещё подключается.');state.avoidPeerId=state.peerId;handlePeerLost('left');setRoomMode('searching');send({type:'next'});ui.nextBtn.disabled=true;setTimeout(()=>ui.nextBtn.disabled=false,650);});
ui.endBtn.addEventListener('click',stopSession);
ui.reportBtn.addEventListener('click',()=>{if(state.peerId)openOverlay(ui.reportModal)});
ui.reportForm.addEventListener('submit',e=>{e.preventDefault();if(!state.peerId)return closeOverlay(ui.reportModal);const reason=ui.reportReason.value.trim();state.avoidPeerId=state.peerId;send({type:'report',reason});ui.reportReason.value='';closeOverlay(ui.reportModal);handlePeerLost('left');setRoomMode('searching');});ui.cancelReport.addEventListener('click',()=>closeOverlay(ui.reportModal));
ui.supportBtn.addEventListener('click',()=>{if(APP.donateUrl)window.open(APP.donateUrl,'_blank','noopener,noreferrer');else toast('Добавь ссылку пожертвований в APP.donateUrl.');});
ui.feedbackBtn.addEventListener('click',()=>openOverlay(ui.feedbackModal));ui.cancelFeedback.addEventListener('click',()=>closeOverlay(ui.feedbackModal));
ui.feedbackForm.addEventListener('submit',async e=>{e.preventDefault();const body={kind:'feedback',name:ui.feedbackName.value.trim(),email:ui.feedbackEmail.value.trim(),message:ui.feedbackMessage.value.trim()};try{const res=await fetch('/api/feedback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await res.json();if(!data.ok)throw new Error(data.error||'failed');closeOverlay(ui.feedbackModal);ui.feedbackMessage.value='';toast(data.emailHandled?'Сообщение отправлено владельцу.':'Сообщение сохранено. Email-канал можно включить в Cloudflare.');if(!data.emailHandled)window.location.href=`mailto:${APP.supportEmail}?subject=${encodeURIComponent('ELVAR — обратная связь')}&body=${encodeURIComponent(body.message)}`;}catch(e){window.location.href=`mailto:${APP.supportEmail}?subject=${encodeURIComponent('ELVAR — обратная связь')}&body=${encodeURIComponent(body.message)}`;}});
ui.chatToggle.addEventListener('click',toggleChat);ui.chatBtnBottom.addEventListener('click',toggleChat);ui.chatClose.addEventListener('click',()=>ui.chatPanel.hidden=true);
function toggleChat(){ui.chatPanel.hidden=!ui.chatPanel.hidden;if(!ui.chatPanel.hidden)ui.chatInput.focus()}
ui.chatForm.addEventListener('submit',e=>{e.preventDefault();const text=ui.chatInput.value.trim();if(!text||!state.peerId)return;addChatMessage(text,'me');send({type:'chat',text});ui.chatInput.value='';});
function clearChat(){ui.chatMessages.innerHTML='<div class="chat-empty">Напиши что-нибудь, если голосом неудобно.</div>';}
function addChatMessage(text,who){if(!text)return;const empty=ui.chatMessages.querySelector('.chat-empty');if(empty)empty.remove();const div=document.createElement('div');div.className=`message ${who==='me'?'me':'peer'}`;div.textContent=text;ui.chatMessages.append(div);ui.chatMessages.scrollTop=ui.chatMessages.scrollHeight;}
ui.fullscreenBtn.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await ui.stage.requestFullscreen();}catch{}});
ui.cameraFilter.addEventListener('change',()=>{state.camFilter=ui.cameraFilter.value;applyCameraUi()});ui.mirrorToggle.addEventListener('change',()=>{state.mirror=ui.mirrorToggle.checked;applyCameraUi()});
ui.cameraSelect.addEventListener('change',()=>switchDevice('video',ui.cameraSelect.value).catch(()=>toast('Не удалось сменить камеру.')));ui.micSelect.addEventListener('change',()=>switchDevice('audio',ui.micSelect.value).catch(()=>toast('Не удалось сменить микрофон.')));ui.volumeRange.addEventListener('input',()=>applyAudioSettings().catch(()=>{}));ui.voiceEffect.addEventListener('change',()=>applyAudioSettings().catch(()=>toast('Эффект недоступен в этом браузере.')));
async function switchDevice(kind,deviceId){if(!state.media||!deviceId)return;const isVideo=kind==='video';const c=isVideo?{video:{deviceId:{exact:deviceId},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30,max:30}}}:{audio:{deviceId:{exact:deviceId},echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1,sampleRate:48000}};const fresh=await navigator.mediaDevices.getUserMedia(c);const nt=isVideo?fresh.getVideoTracks()[0]:fresh.getAudioTracks()[0];const ot=isVideo?state.media.getVideoTracks()[0]:state.media.getAudioTracks()[0];if(ot){nt.enabled=ot.enabled;state.media.removeTrack(ot);ot.stop();}state.media.addTrack(nt);if(isVideo){ui.localVideo.srcObject=state.media;await replaceSender('video',nt);}else{if(state.audio){state.audio.ctx.close().catch(()=>{});state.audio=null;state.outgoingAudioTrack=null;}await applyAudioSettings();if(ui.voiceEffect.value==='off')await replaceSender('audio',nt);}await enumerateDevices();}
function applyCameraUi(){ui.localVideo.style.filter={normal:'none',soft:'saturate(.92) brightness(1.02) contrast(.96)',mono:'grayscale(1)',contrast:'contrast(1.18) saturate(1.05)',warm:'sepia(.18) saturate(1.1)'}[state.camFilter]||'none';ui.localVideo.style.transform=state.mirror?'scaleX(-1)':'scaleX(1)';}

/* ---------- stats ---------- */
function startStatsPolling(){stopStatsPolling();sampleStats();state.statsTimer=setInterval(sampleStats,APP.statsMs)}
function stopStatsPolling(){clearInterval(state.statsTimer);state.statsTimer=null}
async function sampleStats(){if(!state.pc)return;try{const report=await state.pc.getStats();let rtt=null;let jb=null;report.forEach(r=>{if(r.type==='candidate-pair'&&r.state==='succeeded'&&typeof r.currentRoundTripTime==='number')rtt=Math.min(rtt==null?Infinity:rtt,r.currentRoundTripTime*1000);if(r.type==='inbound-rtp'&&(r.kind==='audio'||r.mediaType==='audio')&&r.jitterBufferEmittedCount>0&&typeof r.jitterBufferDelay==='number')jb=Math.min(jb==null?Infinity:jb,(r.jitterBufferDelay/r.jitterBufferEmittedCount)*1000);});if(Number.isFinite(rtt))state.peerRtt=rtt;state.voiceDelay=Number.isFinite(state.peerRtt)?Math.max(0,state.peerRtt/2+(jb||0)):null;updateMetrics();}catch{}}
function updateMetrics(){const local=state.localRtt;const peer=state.peerRtt;const voice=state.voiceDelay;ui.rttValue.textContent=fmtMs(peer);ui.voiceDelayValue.textContent=fmtMs(voice);ui.localLatencyMetric.textContent=fmtMs(local);ui.peerLatencyMetric.textContent=fmtMs(peer);ui.voiceMetric.textContent=fmtMs(voice);ui.localGeoMetric.textContent=countryName(state.geoCountry);ui.networkNote.textContent=peer?`Собеседник: ${countryName(state.peerGeoCountry)} · значения обновляются автоматически.`:'Подключись к собеседнику, чтобы увидеть реальные значения.';}
function fmtMs(v){return Number.isFinite(v)?`${Math.round(v)} мс`:'—'}

/* ---------- settings ---------- */
ui.settingsBtn.addEventListener('click',async()=>{await enumerateDevices().catch(()=>{});refreshProfileUi();openOverlay(ui.settingsModal);});ui.closeSettings.addEventListener('click',()=>closeOverlay(ui.settingsModal));
document.querySelectorAll('.settings-tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('.settings-tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('.settings-section').forEach(x=>x.classList.toggle('active',x.dataset.panel===tab.dataset.tab));if(tab.dataset.tab==='admin'&&isOwner())loadAdmin();}));
ui.adminTokenButton.addEventListener('click',()=>{const token=prompt('Введи ADMIN_TOKEN из Cloudflare Secret:');if(!token)return;state.adminToken=token;sessionStorage.setItem('elvarAdminToken',token);loadAdmin();});ui.adminRefresh.addEventListener('click',loadAdmin);
async function loadAdmin(){if(!isOwner())return;if(!state.adminToken){ui.adminGate.textContent='Нажми «Ключ» и вставь ADMIN_TOKEN. Он хранится только в текущей сессии браузера.';return;}try{const res=await fetch('/api/admin',{headers:{'x-admin-token':state.adminToken}});const data=await res.json();if(!res.ok)throw new Error(data.error||'unauthorized');state.adminData=data;renderAdmin(data);ui.adminGate.textContent=`Онлайн: ${data.users.length}. Владелец: ${data.ownerEmail}`;}catch(e){ui.adminGate.textContent='Ключ не принят или сервер не настроен.';}}
function renderAdmin(data){ui.adminUsers.innerHTML='';data.users.forEach(u=>{const d=document.createElement('div');d.className='admin-item';const strong=document.createElement('strong');strong.textContent=`${u.name} · ${countryName(u.country)}`;const sm=document.createElement('small');sm.textContent=`${u.email||'без email'} · сеть ${countryName(u.geoCountry)} · ${u.status}`;const acts=document.createElement('div');acts.className='admin-item-actions';const ban=document.createElement('button');ban.textContent='Бан 1ч';ban.onclick=()=>adminAction({action:'ban',profileId:u.profileId,minutes:60,reason:'Администратор'});acts.append(ban);d.append(strong,sm,acts);ui.adminUsers.append(d);});renderRecords(ui.adminReports,data.reports,'report');renderRecords(ui.adminFeedback,data.feedback,'feedback');}
function renderRecords(root,records,type){root.innerHTML='';records.forEach(r=>{const d=document.createElement('div');d.className='admin-item';const strong=document.createElement('strong');strong.textContent=type==='report'?`Жалоба · ${r.reason}`:`${r.kind||'feedback'}`;const sm=document.createElement('small');sm.textContent=type==='report'?`${r.reporter?.name||'?'} → ${r.reported?.name||'?'} · ${new Date(r.createdAt).toLocaleString()}`:`${r.name||'anonymous'} ${r.email?`· ${r.email}`:''} · ${r.message||''}`;d.append(strong,sm);root.append(d);});}
async function adminAction(body){try{const res=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json','x-admin-token':state.adminToken},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw new Error(data.error||'failed');toast('Готово.');loadAdmin();}catch(e){toast('Админ-действие не выполнено.');}}

/* ---------- games ---------- */
document.querySelectorAll('[data-game]').forEach(b=>b.addEventListener('click',()=>openGame(b.dataset.game)));
function openGame(name){openOverlay(ui.gameModal);ui.snakeGame.hidden=name!=='snake';ui.reactionGame.hidden=name!=='reaction';ui.gameTitle.textContent=name==='snake'?'Snake':'Reaction';}
ui.closeGame.addEventListener('click',()=>closeOverlay(ui.gameModal));
let snakeTimer=null,snakeRunning=false,snake=null,food=null,dir={x:1,y:0},nextDir={x:1,y:0};
ui.snakeStart.addEventListener('click',startSnake);function startSnake(){clearInterval(snakeTimer);snakeRunning=true;snake=[{x:8,y:8},{x:7,y:8},{x:6,y:8}];food={x:14,y:10};dir={x:1,y:0};nextDir={x:1,y:0};ui.snakeScore.textContent='0';drawSnake();snakeTimer=setInterval(stepSnake,110)}
function stepSnake(){if(!snakeRunning)return;dir=nextDir;const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y};if(head.x<0||head.y<0||head.x>=18||head.y>=18||snake.some(s=>s.x===head.x&&s.y===head.y)){snakeRunning=false;clearInterval(snakeTimer);toast('Конец игры');return;}snake.unshift(head);if(head.x===food.x&&head.y===food.y){ui.snakeScore.textContent=String(Number(ui.snakeScore.textContent)+1);food={x:Math.floor(Math.random()*18),y:Math.floor(Math.random()*18)};}else snake.pop();drawSnake()}
function drawSnake(){const c=ui.snakeCanvas.getContext('2d');const s=c.width/18;c.clearRect(0,0,c.width,c.height);c.fillStyle='#10151b';c.fillRect(0,0,c.width,c.height);c.fillStyle='#8ab4f8';c.fillRect(food.x*s+3,food.y*s+3,s-6,s-6);c.fillStyle='#e8eef5';snake.forEach((p,i)=>{c.globalAlpha=i?0.7:1;c.fillRect(p.x*s+3,p.y*s+3,s-6,s-6)});c.globalAlpha=1}
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();const map={arrowup:{x:0,y:-1},w:{x:0,y:-1},arrowdown:{x:0,y:1},s:{x:0,y:1},arrowleft:{x:-1,y:0},a:{x:-1,y:0},arrowright:{x:1,y:0},d:{x:1,y:0}};const nd=map[k];if(nd&&!isOpposite(nd,dir)){nextDir=nd;e.preventDefault();}});function isOpposite(a,b){return a.x===-b.x&&a.y===-b.y}
let reactionStartAt=0,reactionTimer=null;ui.reactionStart.addEventListener('click',startReaction);function startReaction(){clearTimeout(reactionTimer);ui.reactionTarget.textContent='Жди…';ui.reactionTarget.className='reaction-target';ui.reactionScore.textContent='';const delay=900+Math.random()*2500;reactionTimer=setTimeout(()=>{reactionStartAt=performance.now();ui.reactionTarget.textContent='ЖМИ';ui.reactionTarget.classList.add('ready');},delay)}ui.reactionTarget.addEventListener('click',()=>{if(!reactionStartAt)return;const ms=Math.round(performance.now()-reactionStartAt);ui.reactionScore.textContent=`${ms} мс`;ui.reactionTarget.classList.add('hit');reactionStartAt=0});

/* ---------- draggable PIP ---------- */
let drag=null;ui.pip.addEventListener('pointerdown',e=>{drag={sx:e.clientX,sy:e.clientY,left:ui.pip.offsetLeft,top:ui.pip.offsetTop};ui.pip.setPointerCapture(e.pointerId);ui.pip.classList.add('dragging')});ui.pip.addEventListener('pointermove',e=>{if(!drag)return;const rect=ui.stage.getBoundingClientRect();const w=ui.pip.offsetWidth,h=ui.pip.offsetHeight;const left=Math.min(Math.max(8,drag.left+e.clientX-drag.sx),rect.width-w-8);const top=Math.min(Math.max(8,drag.top+e.clientY-drag.sy),rect.height-h-8);ui.pip.style.left=`${left}px`;ui.pip.style.top=`${top}px`;ui.pip.style.right='auto';ui.pip.style.bottom='auto'});ui.pip.addEventListener('pointerup',()=>{drag=null;ui.pip.classList.remove('dragging');localStorage.setItem('elvarPip',JSON.stringify({left:ui.pip.style.left,top:ui.pip.style.top}));});
function restorePip(){try{const p=JSON.parse(localStorage.getItem('elvarPip')||'null');if(p){ui.pip.style.left=p.left||'';ui.pip.style.top=p.top||'';ui.pip.style.right=p.left?'auto':'';ui.pip.style.bottom=p.top?'auto':'';}}catch{}}

/* ---------- stop/reconnect ---------- */
function stopSession(){state.active=false;state.intentionalClose=true;clearTimeout(state.reconnectTimer);stopHeartbeat();try{state.ws?.close(1000,'leave')}catch{}state.ws=null;resetPeerConnection();state.peerId=null;state.peerProfile=null;state.away=false;state.avoidPeerId=null;state.uiMode='landing';if(state.audio?.ctx)state.audio.ctx.close().catch(()=>{});state.audio=null;state.outgoingAudioTrack=null;state.media?.getTracks().forEach(t=>t.stop());state.media=null;ui.localVideo.srcObject=null;ui.remoteVideo.srcObject=null;ui.settingsBtn.hidden=true;ui.chatPanel.hidden=true;ui.reactionDock.hidden=true;ui.micBtn.classList.remove('off');ui.cameraBtn.classList.remove('off');ui.awayBtn.classList.remove('active');setView('landing');}
window.addEventListener('online',()=>{if(state.active&&!state.ws){clearTimeout(state.reconnectTimer);connectSocket();}});window.addEventListener('pagehide',()=>{state.intentionalClose=true;try{state.ws?.close(1000,'unload')}catch{}state.media?.getTracks().forEach(t=>t.stop())});navigator.mediaDevices?.addEventListener?.('devicechange',()=>enumerateDevices().catch(()=>{}));

/* ---------- initialization ---------- */
initProfileForm();refreshProfileUi();restorePip();ui.targetCountry.value=state.targetCountry;state.geoCountry='ZZ';updateMetrics();
openModalOnOutsideClick(ui.profileModal);openModalOnOutsideClick(ui.settingsModal);openModalOnOutsideClick(ui.permissionModal);openModalOnOutsideClick(ui.reportModal);openModalOnOutsideClick(ui.feedbackModal);openModalOnOutsideClick(ui.gameModal);
