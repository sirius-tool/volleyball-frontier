'use strict';
/* VOLLEY FRONTIER - 6v6 volleyball (HTML/CSS/JS only) - Visual & Audio Enhanced Edition */

/* ===== 設定 ===== */
const CFG = { target: 15, winBy: 2, gravity: 14, netH: 2.2, reach: 1.8, cpuSkill: 0.75, cpuSpeed: 0.88 };
const CW = 9, CL = 18, NET = 9, W = 960, H = 660;
const TEAMS = [
  { name: 'BLUE FALCONS', c: '#2f7bff', d: '#1b4fc0', hair: '#3a2e2b', skin: '#f3c19d' },
  { name: 'RED TIGERS', c: '#ff4d5e', d: '#b8202f', hair: '#1a1a1a', skin: '#e8b088' }
];
const FONT = "'Segoe UI','Hiragino Sans','Meiryo',sans-serif";

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const oppY = (t, yy) => (t === 0 ? yy : CL - yy);

/* ===== 観客（Crowd）データ生成 ===== */
const AUDIENCE = [];
function initAudience() {
  AUDIENCE.length = 0;
  // 奥のスタンド（段差3列）
  for (let row = 0; row < 3; row++) {
    const yPos = -2.8 - row * 0.8;
    const zPos = 0.5 + row * 0.6;
    for (let xPos = -4; xPos <= 13; xPos += 0.45) {
      if (Math.random() < 0.85) {
        AUDIENCE.push({
          x: xPos + rnd(-0.1, 0.1),
          y: yPos,
          z: zPos,
          c: Math.random() < 0.5 ? (Math.random() < 0.5 ? '#2f7bff' : '#ff4d5e') : ['#e0e0e0', '#f1c40f', '#2ecc71', '#9b59b6'][Math.floor(Math.random() * 4)],
          skin: ['#f5d0a9', '#e0ac69', '#8d5524', '#c68642'][Math.floor(Math.random() * 4)],
          phase: Math.random() * Math.PI * 2
        });
      }
    }
  }
}
initAudience();

/* ===== サウンドシステム (長尺BGM・SE・歓声) ===== */
let audioCtx = null, crowdBuffer = null, lastCrowdAt = -10;
let bgmTimer = null, bgmStep = 0, crowdAudio = null;

function initAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) {
      audioCtx = new AC();
      const length = Math.floor(audioCtx.sampleRate * 1.3);
      crowdBuffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
      const data = crowdBuffer.getChannelData(0);
      let smooth = 0;
      for (let i = 0; i < length; i++) {
        smooth = smooth * 0.94 + (Math.random() * 2 - 1) * 0.06;
        data[i] = smooth * (0.55 + Math.random() * 0.45);
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

function tone(freq, duration, type, volume, endFreq) {
  if (!audioCtx) return;
  try {
    const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type || 'sine'; osc.frequency.setValueAtTime(freq, now);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(30, endFreq), now + duration);
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + duration + 0.02);
  } catch (e) {}
}

function noiseBurst(duration, volume, frequency, q) {
  if (!audioCtx || !crowdBuffer) return;
  try {
    const now = audioCtx.currentTime, src = audioCtx.createBufferSource(), filter = audioCtx.createBiquadFilter(), gain = audioCtx.createGain();
    src.buffer = crowdBuffer; filter.type = 'bandpass'; filter.frequency.value = frequency || 900; filter.Q.value = q || 0.7;
    gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.08, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination); src.start(now); src.stop(now + duration);
  } catch (e) {}
}

function bgmNote(freq, duration, volume, type) {
  if (!audioCtx || freq <= 0) return;
  try {
    const now = audioCtx.currentTime, osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.02);
    gain.gain.setValueAtTime(Math.max(0.0002, volume) * 0.7, now + duration * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + duration + 0.02);
  } catch (e) {}
}

/* ② 改良長尺BGMループ（メロディ・コード・ベース・ドラムの多層サウンド） */
function startBgm() {
  if (!audioCtx || bgmTimer) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();

  // 64ステップ（16小節相当）の長尺メロディ
  const melody = [
    659, 0, 784, 0, 880, 784, 659, 587,  523, 0, 659, 0, 784, 659, 587, 0,
    659, 0, 784, 0, 880, 988, 1046, 988, 880, 784, 659, 0, 587, 659, 784, 0,
    523, 0, 659, 0, 784, 0, 880, 0,     659, 0, 587, 0, 523, 0, 494, 0,
    440, 0, 523, 0, 659, 0, 784, 880,   988, 0, 880, 784, 659, 0, 587, 0
  ];
  const harmony = [
    329, 0, 392, 0, 440, 392, 329, 293,  261, 0, 329, 0, 392, 329, 293, 0,
    329, 0, 392, 0, 440, 493, 523, 493,  440, 392, 329, 0, 293, 329, 392, 0,
    261, 0, 329, 0, 392, 0, 440, 0,     329, 0, 293, 0, 261, 0, 246, 0,
    220, 0, 261, 0, 329, 0, 392, 440,   493, 0, 440, 392, 329, 0, 293, 0
  ];
  const bass = [
    131, 0, 131, 0, 147, 0, 147, 0, 110, 0, 110, 0, 123, 0, 123, 0,
    131, 0, 131, 0, 165, 0, 165, 0, 147, 0, 147, 0, 123, 0, 123, 0,
    110, 0, 110, 0, 131, 0, 131, 0, 147, 0, 147, 0, 123, 0, 123, 0,
    110, 0, 110, 0, 123, 0, 123, 0, 131, 0, 147, 0, 165, 0, 131, 0
  ];

  bgmStep = 0;
  bgmTimer = setInterval(() => {
    if (!audioCtx || G.paused || G.mode === 'title' || G.mode === 'over') return;
    const idx = bgmStep % melody.length;

    // 主旋律＆ハモり
    if (melody[idx]) bgmNote(melody[idx], 0.16, 0.02, 'triangle');
    if (harmony[idx] && (bgmStep % 2 === 0)) bgmNote(harmony[idx], 0.14, 0.012, 'sine');

    // ベース
    if (bgmStep % 2 === 0) {
      const bNote = bass[(bgmStep >> 1) % bass.length];
      if (bNote) bgmNote(bNote, 0.22, 0.03, 'sawtooth');
    }

    // ドラムリズム (キック & ノイズハイハット)
    if (bgmStep % 4 === 0) tone(80, 0.08, 'sine', 0.025, 30); // Kick
    if (bgmStep % 2 === 1) noiseBurst(0.03, 0.01, 3500, 2.5); // Hi-Hat

    bgmStep++;
  }, 130);
}

function stopBgm() {
  if (bgmTimer) clearInterval(bgmTimer);
  bgmTimer = null;
}

function playSfx(kind) {
  if (!audioCtx) return;
  if (kind === 'receive') { noiseBurst(0.10, 0.22, 420, 1.1); tone(145, 0.09, 'triangle', 0.12, 85); }
  else if (kind === 'set') { tone(620, 0.075, 'sine', 0.11, 360); noiseBurst(0.055, 0.08, 1400, 1); }
  else if (kind === 'spike') { noiseBurst(0.19, 0.34, 650, 0.55); tone(180, 0.2, 'triangle', 0.24, 55); }
  else if (kind === 'serve') { noiseBurst(0.15, 0.28, 520, 0.7); tone(210, 0.15, 'triangle', 0.18, 75); }
  else if (kind === 'net') { tone(260, 0.16, 'sawtooth', 0.08, 90); }
  else if (kind === 'bounce') { tone(125, 0.12, 'triangle', 0.13, 55); }
}

function cheer(big) {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  if (now - lastCrowdAt < 1.1) return;
  lastCrowdAt = now;
  try {
    if (!crowdAudio) crowdAudio = document.getElementById('crowdAudio');
    if (crowdAudio) {
      crowdAudio.pause(); crowdAudio.currentTime = 0; crowdAudio.volume = big ? 0.88 : 0.62;
      const promise = crowdAudio.play();
      if (promise && promise.catch) promise.catch(() => {});
    }
  } catch (e) {}
  noiseBurst(big ? 0.5 : 0.3, big ? 0.055 : 0.035, 1250, 0.35);
  tone(big ? 520 : 430, 0.18, 'sine', 0.018, big ? 760 : 580);
}

/* ===== ゲーム状態 ===== */
const G = { mode: 'title', paused: false, score: [0, 0], server: 0, srv: null, serveStage: 0, serveT: 0,
  players: [], ball: null, ctrl: null, pointT: 0, rallyT: 0, sinceHit: 1, cpuReact: 0.3, msg: '', msgT: 0, flash: 0, t: 0 };
const keys = {};
const kd = (...c) => c.some(k => keys[k]);

/* ===== データ生成 ===== */
function makePlayers() {
  const ps = [], nums = [4, 3, 2, 5, 6, 1], hxs = [1.5, 4.5, 7.5];
  for (let t = 0; t < 2; t++) for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
    let hy = r === 0 ? 11.2 : 15.4; if (t === 1) hy = CL - hy;
    ps.push({ team: t, slot: r * 3 + i, num: nums[r * 3 + i], row: r === 0 ? 'front' : 'back',
      hx: hxs[i], hy, x: hxs[i], y: hy, tx: hxs[i], ty: hy,
      spd: (t === 1 ? CFG.cpuSpeed : 1) * rnd(4.8, 5.4),
      skill: Math.min(1, (t === 1 ? CFG.cpuSkill : 0.96) * rnd(0.95, 1.05)),
      cd: 0, swing: 0, jump: 0, vx: 0, vy: 0, animT: rnd(0, 10) });
  }
  return ps;
}
const newBall = () => ({ x: 4.5, y: 9, z: 1, vx: 0, vy: 0, vz: 0, last: -1, touches: 0, lastP: null, live: false, trail: [] });

/* ===== 試合進行 ===== */
function newMatch() {
  G.score = [0, 0]; G.players = makePlayers(); G.paused = false;
  show('title', false); show('over', false); show('pause', false);
  startServe(0);
}
function startServe(team) {
  G.server = team; G.mode = 'serve'; G.serveStage = 0; G.serveT = 0; G.sinceHit = 1;
  for (const p of G.players) { p.x = p.tx = p.hx; p.y = p.ty = p.hy; p.cd = p.swing = p.jump = 0; }
  const s = G.players.find(p => p.team === team && p.slot === 4);
  s.x = s.tx = 4.5; s.y = s.ty = team === 0 ? CL - 0.4 : 0.4;
  G.srv = s; G.ball = newBall(); G.ball.x = s.x; G.ball.y = s.y; G.ball.z = 1.1;
  G.ctrl = team === 0 ? s : G.players.find(p => p.team === 0 && p.slot === 4);
  G.msg = team === 0 ? 'あなたのサーブ' : 'CPUのサーブ'; G.msgT = 1.6;
}
function score(w, msg) {
  if (G.mode !== 'rally') return;
  G.score[w]++; G.server = w; G.mode = 'point'; G.pointT = 2.2; G.flash = 1;
  G.msg = msg + '  ' + TEAMS[w].name + ' +1'; G.msgT = 2.2; G.ball.live = false;
  cheer(w === 0);
}
function afterPoint() {
  let w = -1;
  for (const t of [0, 1]) if (G.score[t] >= CFG.target && G.score[t] - G.score[1 - t] >= CFG.winBy) w = t;
  if (w < 0) return startServe(G.server);
  G.mode = 'over'; stopBgm();
  $('overTitle').textContent = w === 0 ? 'YOU WIN!' : 'YOU LOSE...';
  $('overScore').textContent = TEAMS[0].name + ' ' + G.score[0] + ' - ' + G.score[1] + ' ' + TEAMS[1].name;
  show('over', true);
}
function show(id, on) { $(id).classList.toggle('hide', !on); }

/* ===== ボール物理 ===== */
function predict(b, h) {
  const g = CFG.gravity, disc = b.vz * b.vz + 2 * g * (b.z - h);
  let t = disc >= 0 ? (b.vz + Math.sqrt(disc)) / g : 0;
  if (b.z < h && b.vz <= 0) t = 0;
  t = Math.max(0, t);
  return { x: b.x + b.vx * t, y: b.y + b.vy * t, t };
}
function launch(b, tx, ty, T, clear) {
  const g = CFG.gravity, minZ = CFG.netH + 0.55;
  let vz = (0.5 * g * T * T - b.z) / T, Tl;
  for (let i = 0; i < 3; i++) {
    Tl = (vz + Math.sqrt(vz * vz + 2 * g * b.z)) / g;
    if (clear && (b.y - NET) * (ty - NET) < 0) {
      const tc = Tl * (NET - b.y) / (ty - b.y), zc = b.z + vz * tc - 0.5 * g * tc * tc;
      if (tc > 0.05 && zc < minZ) { vz += (minZ - zc) / tc; continue; }
    }
    break;
  }
  Tl = (vz + Math.sqrt(vz * vz + 2 * g * b.z)) / g;
  b.vx = (tx - b.x) / Tl; b.vy = (ty - b.y) / Tl; b.vz = vz;
}
function stepBall(b, dt) {
  const py = b.y;
  b.vz -= CFG.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  b.trail.push({ x: b.x, y: b.y, z: b.z }); if (b.trail.length > 8) b.trail.shift();
  if (b.live && G.mode === 'rally' && (py - NET) * (b.y - NET) < 0 && b.z < CFG.netH) {
    playSfx('net'); b.vy *= -0.15; b.vx *= 0.3; score(1 - b.last, 'ネット！'); return;
  }
  if (b.z <= 0) {
    b.z = 0;
    if (b.live && G.mode === 'rally') {
      const inC = b.x >= 0 && b.x <= CW && b.y >= 0 && b.y <= CL;
      playSfx('bounce');
      if (inC) score(b.y > NET ? 1 : 0, 'ポイント！'); else score(1 - b.last, 'アウト！');
    }
    if (b.vz < -1) { b.vz = -b.vz * 0.5; b.vx *= 0.7; b.vy *= 0.7; } else { b.vz = 0; b.vx *= 0.9; b.vy *= 0.9; }
  }
  b.x = clamp(b.x, -12, 21); b.y = clamp(b.y, -10, 28);
}

/* ===== プレー ===== */
const canSpike = (p, b) => p.row === 'front' && b.z >= 1.5 && Math.abs(b.y - NET) < 3.4;
function playBall(p, kind, aim) {
  const b = G.ball, t = p.team;
  if (G.mode !== 'rally' || !b.live || p.cd > 0 || G.sinceHit < 0.20) return false;
  if (t === 0 ? b.y < NET - 0.3 : b.y > NET + 0.3) return false;
  if (b.last === t && b.lastP === p) return false;
  const d = Math.hypot(b.x - p.x, b.y - p.y);
  if (d > CFG.reach || b.z > 3.8) return false;
  const n = (b.last === t ? b.touches : 0) + 1, inc = b.last !== t ? Math.hypot(b.vx, b.vy, b.vz) : 0;
  b.last = t; b.touches = n; b.lastP = p; G.sinceHit = 0; p.cd = 0.3; p.swing = 0.25;
  if (n > 3) { score(1 - t, '4回目のタッチ！'); return true; }
  const isSpike = kind === 'atk' && canSpike(p, b);
  playSfx(isSpike ? 'spike' : (n === 1 ? 'receive' : (n === 2 && kind === 'atk' ? 'set' : 'receive')));
  const q = clamp(1 - 0.42 * d / CFG.reach - 0.17 * Math.abs(b.z - 1.2), 0.22, 1) * p.skill * clamp(1 - (inc - 11) * 0.05, 0.4, 1);
  const sp = (1 - q) * 2.8, near = t === 0 ? NET + 1.9 : NET - 1.9;
  let tx, ty, T, clear = false;
  const shank = n === 1 && Math.random() < clamp((inc > 13 ? (inc - 13) * 0.08 : 0) + (1 - q) * 0.3, 0, 0.6);
  if (shank) { tx = 4.5 + rnd(-7, 7); ty = near + rnd(-5, 5); T = rnd(0.9, 1.4); }
  else if (isSpike) { tx = 4.5 + aim.x * 3.2; ty = oppY(t, 4.2 - aim.y * 2.6); T = 0.55; clear = true; p.jump = 0.45; }
  else if (n === 1) { tx = 4.5 + aim.x * 2; ty = near; T = 1.3; }
  else if (n === 2 && kind === 'atk') { tx = 4.5 + aim.x * 3; ty = near; T = 1.0; }
  else { tx = 4.5 + aim.x * 3; ty = oppY(t, 4.5 - aim.y * 3); T = 1.2; clear = true; }
  tx += rnd(-1, 1) * sp; ty += rnd(-1, 1) * sp * 0.6;
  if (!clear && !shank) { tx = clamp(tx, 0.6, 8.4); ty = t === 0 ? Math.max(ty, NET + 0.8) : Math.min(ty, NET - 0.8); }
  if (t === 0) G.cpuReact = rnd(0.3, 0.6);
  launch(b, tx, ty, T, clear); autoSwitch(); return true;
}
function autoSwitch() {
  const b = G.ball, L = predict(b, 1.0);
  if (L.y <= NET) return;
  let best = null, bd = 1e9;
  for (const p of G.players) {
    if (p.team !== 0 || p === b.lastP) continue;
    const d = Math.hypot(p.x - L.x, p.y - L.y); if (d < bd) { bd = d; best = p; }
  }
  if (best) G.ctrl = best;
}
function switchCtrl() {
  if (G.mode === 'serve' && G.server === 0) return;
  const b = G.ball, L = b.live ? predict(b, 1.0) : { x: b.x, y: b.y };
  const arr = G.players.filter(p => p.team === 0).sort((a, c) =>
    Math.hypot(a.x - L.x, a.y - L.y) - Math.hypot(c.x - L.x, c.y - L.y));
  G.ctrl = arr.indexOf(G.ctrl) === 0 ? arr[1] : arr[0];
}

/* ===== サーブ ===== */
function doToss() { const b = G.ball; G.serveStage = 1; b.vx = b.vy = 0; b.z = 1.2; b.vz = 7.2; }
function serveHit(q, aim) {
  initAudio(); playSfx('serve');
  const b = G.ball, s = G.srv, t = G.server, sp = (1 - q) * 3.4;
  const tx = 4.5 + aim.x * 3.3 + rnd(-1, 1) * sp, ty = oppY(t, 4.5 - aim.y * 2.8 + rnd(-1, 1) * sp * 0.7);
  launch(b, tx, ty, 1.15, true);
  b.live = true; b.last = t; b.touches = 1; b.lastP = s;
  G.mode = 'rally'; G.rallyT = 0; G.sinceHit = 0; s.swing = 0.3; s.cd = 0.5; G.msgT = 0; G.cpuReact = rnd(0.3, 0.6);
  autoSwitch();
}
function updateServe(dt) {
  const b = G.ball, s = G.srv; G.serveT += dt;
  if (G.serveStage === 0) {
    b.x = s.x; b.y = s.y; b.z = 1.1;
    if (G.server === 1 && G.serveT > 1.4) doToss();
  } else {
    b.vz -= CFG.gravity * dt; b.z += b.vz * dt;
    if (G.server === 1 && b.vz < 0 && b.z <= 2.95) serveHit(rnd(0.6, 1) * s.skill, aiAim(1, 1));
    else if (b.vz < 0 && b.z < 1.0) serveHit(0.2, { x: 0, y: 0 });
  }
}

/* ===== AI ===== */
function aiAim(t, n) {
  if (n === 2) return { x: [-1, 0, 1][Math.random() * 3 | 0], y: 0 };
  const opp = G.players.filter(p => p.team !== t); let best = 0, bs = -1;
  for (const cx of [-1, 0, 1]) {
    const m = Math.min(...opp.map(p => Math.abs(p.x - (4.5 + cx * 3)))), sc = m + rnd(0, 1.5);
    if (sc > bs) { bs = sc; best = cx; }
  }
  return { x: best, y: rnd(-0.7, 1) };
}
function aiHit(p) {
  const b = G.ball, t = p.team;
  if (!b.live || p.cd > 0 || G.sinceHit < 0.3 || (b.last === t && b.lastP === p)) return;
  if (t === 0 ? b.y < NET - 0.3 : b.y > NET + 0.3) return;
  const inc = b.last !== t ? Math.hypot(b.vx, b.vy, b.vz) : 0, rk = inc > 13 ? 0.7 : 0.92;
  if (Math.hypot(b.x - p.x, b.y - p.y) > CFG.reach * rk) return;
  const missChance = clamp(0.012 + Math.max(0, inc - 12) * 0.003
    + Math.max(0, Math.hypot(b.x - p.x, b.y - p.y) / Math.max(0.1, CFG.reach) - 0.60) * 0.045, 0.008, 0.075);
  if (Math.random() < missChance) { p.cd = 0.72; p.swing = 0.12; return; }
  const n = (b.last === t ? b.touches : 0) + 1, aim = aiAim(t, n);
  if (b.vz >= 0) return;
  if (n === 3 && canSpike(p, b) && b.z <= 2.9) playBall(p, 'atk', aim);
  else if (b.z <= 1.25) playBall(p, n === 1 ? 'bump' : 'atk', aim);
}
function aiTeam(t) {
  const b = G.ball, ps = G.players.filter(p => p.team === t);
  let chaser = null, L = null;
  if (b.live) {
    L = predict(b, 1.0);
    if ((t === 0 ? L.y > NET : L.y < NET) && !(t === 1 && b.last === 0 && G.sinceHit < G.cpuReact)) {
      let bd = 1e9;
      for (const p of ps) {
        if (p === G.ctrl && t === 0) continue;
        if (b.last === t && b.lastP === p) continue;
        const d = Math.hypot(p.x - L.x, p.y - L.y) / p.spd; if (d < bd) { bd = d; chaser = p; }
      }
    }
  }
  const poss = b.live && b.last === t;
  for (const p of ps) {
    if (p === G.ctrl && t === 0) continue;
    if (G.mode === 'serve' && p === G.srv) { p.tx = p.x; p.ty = p.y; continue; }
    let tx = p.hx + (b.live ? (b.x - 4.5) * 0.12 : 0), ty = p.hy;
    if (p === chaser) { tx = L.x; ty = L.y; }
    else if (poss && p.row === 'front') { tx = p.hx; ty = t === 0 ? NET + 1.8 : NET - 1.8; }
    p.tx = tx; p.ty = ty;
  }
}

/* ===== 選手移動 ===== */
function movePlayers(dt) {
  for (const p of G.players) {
    p.cd = Math.max(0, p.cd - dt); p.swing = Math.max(0, p.swing - dt); p.jump = Math.max(0, p.jump - dt);
    p.animT += dt * 10;
    const oldX = p.x, oldY = p.y;

    if (p === G.ctrl && G.mode !== 'point') {
      let vx = (kd('KeyD', 'ArrowRight') ? 1 : 0) - (kd('KeyA', 'ArrowLeft') ? 1 : 0), vy = (kd('KeyS', 'ArrowDown') ? 1 : 0) - (kd('KeyW', 'ArrowUp') ? 1 : 0);
      if (G.mode === 'serve' && (G.serveStage > 0 || p === G.srv)) { vy = 0; if (G.serveStage > 0) vx = 0; }
      const m = Math.hypot(vx, vy) || 1; p.x += vx / m * p.spd * dt; p.y += vy / m * p.spd * dt;
    } else {
      const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
      if (d > 0.02) { const s = Math.min(p.spd * dt, d); p.x += dx / d * s; p.y += dy / d * s; }
    }
    p.x = clamp(p.x, 0.3, CW - 0.3);
    p.y = p.team === 0 ? clamp(p.y, NET + 0.45, CL - 0.3) : clamp(p.y, 0.3, NET - 0.45);
    p.vx = (p.x - oldX) / dt; p.vy = (p.y - oldY) / dt;
  }
}

/* ===== 更新 ===== */
function update(dt) {
  G.t += dt; G.msgT -= dt; G.flash = Math.max(0, G.flash - dt * 1.5);
  const b = G.ball;
  if (G.mode === 'point') {
    stepBall(b, dt);
    for (const p of G.players) { p.tx = p.hx; p.ty = p.hy; }
    movePlayers(dt);
    if ((G.pointT -= dt) <= 0) afterPoint();
    return;
  }
  if (G.mode === 'serve') { updateServe(dt); aiTeam(0); aiTeam(1); movePlayers(dt); return; }
  if (G.mode === 'rally') {
    G.rallyT += dt; G.sinceHit += dt;
    aiTeam(0); aiTeam(1); movePlayers(dt);
    stepBall(b, dt);
    for (const p of G.players) {
      if (G.mode !== 'rally') break;
      if (p.team === 1) aiHit(p);
    }
    if (G.mode === 'rally' && G.rallyT > 45) score(Math.random() < 0.5 ? 0 : 1, 'タイムアップ');
  }
}

/* ===== 入力 ===== */
const getAim = () => ({ x: (kd('KeyD', 'ArrowRight') ? 1 : 0) - (kd('KeyA', 'ArrowLeft') ? 1 : 0), y: (kd('KeyW', 'ArrowUp') ? 1 : 0) - (kd('KeyS', 'ArrowDown') ? 1 : 0) });
function act(kind) {
  const p = G.ctrl, aim = getAim(), b = G.ball;
  if (G.mode === 'serve') {
    if (G.server !== 0) return;
    if (G.serveStage === 0) doToss(); else serveHit(clamp(1 - Math.abs(b.z - 2.9) * 0.45, 0.2, 1), aim);
    return;
  }
  if (!playBall(p, kind, aim)) {
    p.swing = 0.2; p.cd = 0.12;
    if (kind === 'atk' && p.row === 'front' && Math.abs(p.y - NET) < 3.5) p.jump = 0.45;
  }
}

function setPause(on) {
  if (!['serve', 'rally', 'point'].includes(G.mode)) return;
  G.paused = on; show('pause', on); 
  if (on) {
    stopBgm();
  } else {
    startBgm(); // ← ポーズ解除時にBGMを再開する処理を追加
  }
}

addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Escape') return setPause(!G.paused);
  if (G.paused || (G.mode !== 'serve' && G.mode !== 'rally')) return;
  if (e.code === 'KeyQ') switchCtrl();
  else if (e.code === 'Space') act('bump');
  else if (e.code === 'KeyE') act('atk');
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; setPause(true); });
$('start').onclick = () => { initAudio(); newMatch(); startBgm(); };
$('again').onclick = () => { initAudio(); newMatch(); startBgm(); };
$('resume').onclick = () => { setPause(false); startBgm(); };
const toTitle = () => { stopBgm(); if (crowdAudio) crowdAudio.pause(); G.paused = false; G.mode = 'title'; show('pause', false); show('over', false); show('title', true); };
$('toTitle').onclick = toTitle; $('toTitle2').onclick = toTitle;

/* ===== 描画システム ===== */
function P(x, y, z) { z = z || 0; const s = 36 + 18 * (y / CL); return { x: W / 2 + (x - CW / 2) * s, y: 130 + y * 25 - z * s * 0.85, s }; }
function rr(x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function poly(pts, fill, stroke, lw) {
  ctx.beginPath(); pts.forEach((p, i) => { const q = P(p[0], p[1]); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function ln(a, b) { const u = P(a[0], a[1]), v = P(b[0], b[1]); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke(); }
function ellipse(x, y, rx, ry, fill, stroke, lw) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

/* ① 観客席（スタンド）および背景描画 */
function drawCourt() {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1020'); bg.addColorStop(1, '#05070e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // スタンド（観客席の構造体）
  poly([[-5, -5], [14, -5], [14, -1.8], [-5, -1.8]], '#151e33');
  poly([[-5, -4], [14, -4], [14, -1.8], [-5, -1.8]], '#1c2844');
  poly([[-5, -3], [14, -3], [14, -1.8], [-5, -1.8]], '#233254');

  // スポンサーボード / 広告フェンス
  poly([[-3.2, -1.8], [12.2, -1.8], [12.2, -1.3], [-3.2, -1.3]], '#0f172a', '#334155', 1.5);
  ctx.fillStyle = '#64748b'; ctx.font = 'bold 12px ' + FONT; ctx.textAlign = 'center';
  const pA = P(-1, -1.55), pB = P(4.5, -1.55), pC = P(10, -1.55);
  ctx.fillText('VOLLEY FRONTIER', pA.x, pA.y);
  ctx.fillText('POWER SPIKE', pB.x, pB.y);
  ctx.fillText('CHAMPIONSHIP', pC.x, pC.y);

  // ① 観客（ドットキャラクター）を描画
  const cheerExcitement = (G.mode === 'rally' || G.mode === 'point') ? Math.sin(G.t * 12) * 2 : 0;
  for (const a of AUDIENCE) {
    const q = P(a.x, a.y, a.z);
    const armY = cheerExcitement < 0 ? -a.z * 10 : 0;
    // 体
    ctx.fillStyle = a.c;
    ctx.fillRect(q.x - 3, q.y - 10 + armY, 6, 8);
    // 頭
    ctx.fillStyle = a.skin;
    ctx.beginPath(); ctx.arc(q.x, q.y - 13 + armY, 3.5, 0, 7); ctx.fill();
  }

  // コート外周
  poly([[-2.6, -1.2], [11.6, -1.2], [11.6, 19.4], [-2.6, 19.4]], '#1e293b');
  // コート本体
  poly([[0, 0], [CW, 0], [CW, CL], [0, CL]], '#d97706');
  poly([[0, 0], [CW, 0], [CW, 6], [0, 6]], 'rgba(255,255,255,.08)');
  poly([[0, 12], [CW, 12], [CW, CL], [0, CL]], 'rgba(255,255,255,.08)');

  // コートライン
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
  poly([[0, 0], [CW, 0], [CW, CL], [0, CL]], null, '#ffffff', 3.5);
  ln([0, NET], [CW, NET]); ln([0, 6], [CW, 6]); ln([0, 12], [CW, 12]);
}

function drawNet() {
  const z1 = CFG.netH, z0 = 1.2, a = -0.3, c = CW + 0.3;
  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 4;
  for (const x of [a, c]) { const g = P(x, NET, 0), t = P(x, NET, 2.5); ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(t.x, t.y); ctx.stroke(); }
  const t1 = P(a, NET, z1), t2 = P(c, NET, z1), b1 = P(a, NET, z0), b2 = P(c, NET, z0);
  ctx.fillStyle = 'rgba(241,245,249,.25)'; ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(b1.x, b1.y); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
  for (let x = a; x <= c; x += 0.4) { const u = P(x, NET, z1), v = P(x, NET, z0); ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(v.x, v.y); ctx.stroke(); }
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.stroke();
}

/* ③ リアルな選手アバター描画 */
function drawPlayer(p) {
  const jz = p.jump > 0 ? 0.9 * Math.sin(Math.PI * (1 - p.jump / 0.45)) : 0;
  const f = P(p.x, p.y, jz), s = f.s * 0.85, T = TEAMS[p.team];
  const isMoving = Math.hypot(p.vx, p.vy) > 0.5;
  const runCycle = isMoving ? Math.sin(p.animT) : 0;

  ctx.save();
  ctx.translate(f.x, f.y);

  // 1. 脚（関節・ソックス・シューズ）
  const legSwing = runCycle * 0.22 * s;
  ctx.lineWidth = 0.11 * s; ctx.lineCap = 'round';

  // 左脚
  ctx.strokeStyle = T.skin;
  ctx.beginPath(); ctx.moveTo(-0.12 * s, -0.6 * s); ctx.lineTo(-0.16 * s + legSwing, -0.15 * s); ctx.stroke();
  // 右脚
  ctx.beginPath(); ctx.moveTo(0.12 * s, -0.6 * s); ctx.lineTo(0.16 * s - legSwing, -0.15 * s); ctx.stroke();

  // シューズ
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-0.22 * s + legSwing, -0.1 * s, 0.14 * s, 0.1 * s);
  ctx.fillRect(0.08 * s - legSwing, -0.1 * s, 0.14 * s, 0.1 * s);

  // 2. パンツ（ボトムス）
  ctx.fillStyle = T.d;
  rr(-0.24 * s, -0.82 * s, 0.48 * s, 0.3 * s, 3); ctx.fill();

  // 3. ユニフォーム（シャツ・襟・チームアクセント）
  ctx.fillStyle = T.c;
  rr(-0.28 * s, -1.35 * s, 0.56 * s, 0.58 * s, 6); ctx.fill();
  // Vネックライン
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(-0.1 * s, -1.35 * s); ctx.lineTo(0.1 * s, -1.35 * s); ctx.lineTo(0, -1.22 * s); ctx.closePath(); ctx.fill();

  // 背番号/胸番号
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + (0.34 * s) + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(p.num, 0, -1.06 * s);

  // 4. 腕と手（打撃・走行ポーズ）
  const up = p.swing > 0 || p.jump > 0;
  const armAngle = up ? -1.8 : runCycle * 0.4;
  ctx.strokeStyle = T.skin; ctx.lineWidth = 0.1 * s;
  // 左腕
  ctx.beginPath(); ctx.moveTo(-0.28 * s, -1.28 * s);
  ctx.lineTo(-0.38 * s - Math.sin(armAngle) * 0.3 * s, -1.0 * s + Math.cos(armAngle) * 0.3 * s); ctx.stroke();
  // 右腕
  ctx.beginPath(); ctx.moveTo(0.28 * s, -1.28 * s);
  ctx.lineTo(0.38 * s + Math.sin(armAngle) * 0.3 * s, -1.0 * s - Math.cos(armAngle) * 0.3 * s); ctx.stroke();

  // 5. 頭部・髪型・顔
  const headY = -1.62 * s;
  // 肌（顔）
  ctx.fillStyle = T.skin; ctx.beginPath(); ctx.arc(0, headY, 0.21 * s, 0, Math.PI * 2); ctx.fill();
  // 髪の毛
  ctx.fillStyle = T.hair; ctx.beginPath(); ctx.arc(0, headY - 0.04 * s, 0.22 * s, Math.PI * 0.8, Math.PI * 2.2); ctx.fill();
  // ハチマキ / ヘアバンド
  ctx.fillStyle = T.d; ctx.fillRect(-0.2 * s, headY - 0.1 * s, 0.4 * s, 0.07 * s);

  ctx.restore();

  // 操作中マーカー
  if (p === G.ctrl) {
    const y = f.y - 2.5 * s - Math.sin(G.t * 6) * 4;
    ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.moveTo(f.x - 7, y - 10); ctx.lineTo(f.x + 7, y - 10); ctx.lineTo(f.x, y); ctx.closePath(); ctx.fill();
  }
}

function drawBall(b) {
  const q = P(b.x, b.y, b.z), r = Math.max(5, 0.3 * q.s * (1 + b.z * 0.04)), sp = Math.hypot(b.vx, b.vy, b.vz);
  if (sp > 9) b.trail.forEach((t, i) => {
    const u = P(t.x, t.y, t.z); ctx.fillStyle = 'rgba(255,255,255,' + (i / b.trail.length * 0.25) + ')';
    ctx.beginPath(); ctx.arc(u.x, u.y, r * (0.4 + i / 16), 0, 7); ctx.fill();
  });
  ctx.save(); ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.clip();
  ctx.fillStyle = '#fdfdf6'; ctx.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
  ctx.translate(q.x, q.y); ctx.rotate(G.t * (2 + sp * 0.1));
  ctx.fillStyle = '#2f7bff'; ctx.fillRect(-r, -r * 0.5, 2 * r, r * 0.35);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(-r, r * 0.15, 2 * r, r * 0.35);
  ctx.restore();
  ctx.strokeStyle = '#3a4a6a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.stroke();
}

function drawShadows() {
  for (const p of G.players) {
    const g = P(p.x, p.y, 0);
    if (p === G.ctrl) ellipse(g.x, g.y, g.s * 0.6, g.s * 0.28, 'rgba(245,158,11,.25)', '#f59e0b', 3);
    ellipse(g.x, g.y, g.s * 0.38, g.s * 0.14, 'rgba(0,0,0,.35)');
  }
  const b = G.ball; if (!b) return;
  if (b.live) {
    const L = predict(b, 0), m = P(L.x, L.y, 0);
    ellipse(m.x, m.y, m.s * 0.4, m.s * 0.15, null, 'rgba(255,255,255,.55)', 2);
  }
  const g = P(b.x, b.y, 0);
  ellipse(g.x, g.y, g.s * 0.3 * (1 + b.z * 0.05), g.s * 0.11 * (1 + b.z * 0.05), 'rgba(0,0,0,' + 0.4 / (1 + b.z * 0.3) + ')');
}

function text(s, x, y, size, color, align, weight) {
  ctx.font = (weight || 'bold') + ' ' + size + 'px ' + FONT; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
}

function drawHUD() {
  const x0 = W / 2 - 215, b = G.ball;
  ctx.fillStyle = 'rgba(8,14,30,.85)'; rr(x0, 8, 430, 56, 16); ctx.fill();
  for (const t of [0, 1]) {
    const left = t === 0, x = left ? x0 + 14 : x0 + 416;
    ctx.fillStyle = TEAMS[t].c; rr(left ? x0 : x0 + 424, 18, 6, 36, 3); ctx.fill();
    text(TEAMS[t].name, x + (left ? 4 : -4), 26, 13, '#cdd6ea', left ? 'left' : 'right');
    if (G.server === t && G.mode !== 'over') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(left ? x + 126 : x - 126, 26, 5, 0, 7); ctx.fill(); }
    const n = b && b.live && b.last === t ? b.touches : 0;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < n ? (n >= 3 ? '#ff7a45' : TEAMS[t].c) : 'rgba(255,255,255,.18)';
      ctx.beginPath(); ctx.arc(left ? x + 8 + i * 16 : x - 8 - i * 16, 46, 5, 0, 7); ctx.fill();
    }
    text(String(G.score[t]), W / 2 + (left ? -52 : 52), 36, 40, '#fff');
  }
  text(':', W / 2, 35, 32, '#8fa0c4');
  text(CFG.target + '点先取 / ' + CFG.winBy + '点差', W / 2, 62, 11, '#8fa0c4', 'center', 'normal');
  text('TOUCH', W / 2, 18, 10, '#8fa0c4', 'center', 'normal');

  let st = '';
  if (G.mode === 'serve') st = G.server === 0 ? (G.serveStage === 0 ? 'Space：ボールをトス（A/Dで位置、W/Sで強さ方向）' : 'もう一度Space：頂点で打つと成功率UP') : 'CPUがサーブします…';
  else if (G.mode === 'rally' && b.live) st = TEAMS[b.last].name + '  ' + b.touches + 'タッチ目';
  if (st) text(st, W / 2, 86, 15, '#ffe9a8');

  if (G.msgT > 0) {
    ctx.globalAlpha = clamp(G.msgT, 0, 1); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineJoin = 'round';
    ctx.font = 'bold 46px ' + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(G.msg, W / 2, 300); ctx.fillStyle = '#fff'; ctx.fillText(G.msg, W / 2, 300); ctx.globalAlpha = 1;
  }
  if (G.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + G.flash * 0.25 + ')'; ctx.fillRect(0, 0, W, H); }
  ctx.fillStyle = 'rgba(8,14,30,.75)'; ctx.fillRect(0, H - 34, W, 34);
  const c = G.ctrl;
  text('操作中: #' + (c ? c.num : '-') + (c ? (c.row === 'front' ? '（前衛）' : '（後衛）') : ''), 14, H - 17, 13, '#ffd23f', 'left');
  text('WASD/矢印:移動  Q:選手交代  Space:レシーブ/サーブ  E:トス・スパイク  Esc:ポーズ', W - 14, H - 17, 13, '#b8c4de', 'right', 'normal');
}

function draw() {
  drawCourt(); drawShadows();
  const items = G.players.map(p => ({ y: p.y, f: () => drawPlayer(p) }));
  items.push({ y: NET, f: drawNet });
  if (G.ball) items.push({ y: G.ball.y, f: () => drawBall(G.ball) });
  items.sort((a, c) => a.y - c.y).forEach(i => i.f());
  drawHUD();
}

/* ===== メインループ ===== */
G.players = makePlayers(); G.ball = newBall(); G.ctrl = G.players[4];
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now;
  try {
    if (!G.paused && G.mode !== 'title' && G.mode !== 'over') update(dt);
    draw();
  } catch (err) { console.error(err); }
}
requestAnimationFrame(frame);