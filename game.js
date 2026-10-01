// ANDROMEDA COLLISION - an Asteroids-style vector shooter
(() => {
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
const W = cv.width, H = cv.height, TILE = 80, TAU = Math.PI * 2;

// ---------- Teams: four space force bases, each with its own ship configuration ----------
const TEAMS = {
  usa:    { name:'US Space Force',      pilot:'Col. James Reyes',     img:'usa_col_james_reyes.png',        color:'#6af',
            desc:'Balanced fighter. Good all-rounder.',
            hull:[[16,0],[-12,-10],[-6,0],[-12,10]], thrust:.16, turn:.075, cool:11, maxB:4, speed:9, hp:1, size:14 },
  china:  { name:'China Space Force',   pilot:'Cmdr. Lin Wei',        img:'china_cmdr_lin_wei.png',         color:'#f55',
            desc:'Wing-dart. Rapid fire, slow to accelerate.',
            hull:[[14,0],[-4,-5],[-14,-16],[-9,0],[-14,16],[-4,5]], thrust:.12, turn:.07, cool:5, maxB:7, speed:8, hp:1, size:15 },
  france: { name:'French Space Force',  pilot:'Capt. Amelie Laurent', img:'france_capt_amelie_laurent.png', color:'#8cf',
            desc:'Needle-ship. Fastest and most agile, few shots.',
            hull:[[20,0],[-10,-6],[-4,0],[-10,6]], thrust:.22, turn:.1, cool:13, maxB:3, speed:11, hp:1, size:13 },
  russia: { name:'Russian Space Force', pilot:'Maj. Dmitri Volkov',   img:'russia_maj_dmitri_volkov.png',   color:'#fc4',
            desc:'Armoured hull. Takes 3 hits, turns slowly.',
            hull:[[15,-4],[15,4],[2,12],[-14,12],[-14,-12],[2,-12]], thrust:.13, turn:.05, cool:12, maxB:4, speed:8, hp:3, size:16 }
};
const KEYS = Object.keys(TEAMS);

// ---------- state ----------
let state = 'select', team = null, ship, rocks, bullets, rivals, ebullets, parts, stars, score, lives, wave, collision, msg = '', msgT = 0, paused = false, t = 0;
const keys = {};
const R = (a, b) => a + Math.random() * (b - a);
const wrap = o => { o.x = (o.x + W) % W; o.y = (o.y + H) % H; };
const dist = (a, b) => { let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); dx = Math.min(dx, W - dx); dy = Math.min(dy, H - dy); return Math.hypot(dx, dy); };

// ---------- audio (tiny synth beeps) ----------
let ac; function beep(f, d = .08, type = 'square', v = .04) {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = v; g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d); } catch (e) {}
}

// ---------- team select UI ----------
const box = document.getElementById('teams');
KEYS.forEach((k, i) => {
  const T = TEAMS[k], el = document.createElement('div');
  el.className = 'team'; el.tabIndex = 0; el.style.setProperty('--c', T.color);
  el.innerHTML = `<img src="assets/characters/${T.img}" alt="${T.pilot}"><b>${i + 1}. ${T.name}</b>${T.pilot}<span>${T.desc}</span>`;
  el.onclick = () => start(k); el.onkeydown = e => { if (e.key === 'Enter') start(k); };
  box.appendChild(el);
});

// ---------- setup ----------
function start(k) {
  team = TEAMS[k]; score = 0; lives = 3; wave = 0;
  stars = Array.from({ length: 90 }, () => ({ x: R(0, W), y: R(0, H), z: R(.2, 1) }));
  ebullets = []; parts = []; rivals = [];
  document.getElementById('select').style.display = 'none';
  spawnShip(); nextWave(); state = 'play'; beep(440, .2);
}
function spawnShip() { ship = { x: W / 2, y: H / 2, vx: 0, vy: 0, a: -Math.PI / 2, cd: 0, inv: 150, hp: team.hp }; bullets = []; }
function nextWave() {
  wave++; collision = Math.min(100, wave * 8); rocks = [];
  for (let i = 0; i < 3 + wave; i++) {
    let x, y; do { x = R(0, W); y = R(0, H); } while (Math.hypot(x - ship.x, y - ship.y) < 180);
    rocks.push(mkRock(x, y, 3));
  }
  say(`WAVE ${wave} - GALAXIES ${collision}% MERGED`);
}
function mkRock(x, y, s) {
  const n = 10, r = [12, 24, 42][s - 1], pts = [];
  for (let i = 0; i < n; i++) pts.push([Math.cos(i / n * TAU) * r * R(.7, 1.2), Math.sin(i / n * TAU) * r * R(.7, 1.2)]);
  const a = R(0, TAU), v = R(.4, 1.2) + (4 - s) * .35 + wave * .05;
  return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s, r, pts, rot: R(0, TAU), vr: R(-.02, .02) };
}
function spawnRival() {
  const others = KEYS.filter(k => TEAMS[k] !== team), T = TEAMS[others[Math.floor(Math.random() * 3)]];
  const side = Math.random() < .5;
  rivals.push({ x: side ? 0 : W - 1, y: R(60, H - 60), vx: side ? 1.4 : -1.4, vy: R(-.5, .5), a: 0, cd: 60, T, hp: T.hp });
}
function say(m) { msg = m; msgT = 150; }

// ---------- input ----------
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (state === 'select') { const i = parseInt(e.key) - 1; if (KEYS[i]) start(KEYS[i]); }
  else if (state === 'over' && e.code === 'Enter') { state = 'select'; document.getElementById('select').style.display = 'flex'; }
  else if (e.code === 'KeyP') paused = !paused;
  else if (state === 'play' && (e.code === 'ShiftLeft' || e.code === 'ShiftRight')) { ship.x = R(0, W); ship.y = R(0, H); ship.vx = ship.vy = 0; if (Math.random() < .12) die(); }
});
addEventListener('keyup', e => keys[e.code] = false);

// ---------- helpers ----------
function boom(x, y, n, col) { for (let i = 0; i < n; i++) { const a = R(0, TAU), v = R(.5, 3.5); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, l: R(20, 50), col }); } }
function die() {
  if (ship.inv > 0) return;
  if (--ship.hp > 0) { ship.inv = 60; boom(ship.x, ship.y, 12, '#fff'); beep(120, .15, 'sawtooth'); return; }
  boom(ship.x, ship.y, 40, team.color); beep(70, .5, 'sawtooth', .08);
  if (--lives <= 0) { state = 'over'; ship = null; } else spawnShip();
}
function shoot(o, T, list, speed, life) {
  list.push({ x: o.x + Math.cos(o.a) * T.size, y: o.y + Math.sin(o.a) * T.size, vx: o.vx * .4 + Math.cos(o.a) * speed, vy: o.vy * .4 + Math.sin(o.a) * speed, l: life, col: T.color });
}
function breakRock(i) {
  const k = rocks[i]; rocks.splice(i, 1); score += [100, 50, 20][k.s - 1]; boom(k.x, k.y, 8 + k.s * 3, '#fff'); beep(160 - k.s * 25, .12, 'sawtooth');
  if (k.s > 1) { rocks.push(mkRock(k.x, k.y, k.s - 1), mkRock(k.x, k.y, k.s - 1)); }
}

// ---------- update ----------
function update() {
  t++;
  stars.forEach(s => { s.x -= s.z * .15 * (1 + (collision || 0) / 50); if (s.x < 0) s.x += W; });
  parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.l--; }); parts = parts.filter(p => p.l > 0);
  if (msgT > 0) msgT--;
  if (state !== 'play') { rocks.forEach(moveRock); return; }

  const s = ship;
  if (keys.ArrowLeft || keys.KeyA) s.a -= team.turn;
  if (keys.ArrowRight || keys.KeyD) s.a += team.turn;
  if (keys.ArrowUp || keys.KeyW) { s.vx += Math.cos(s.a) * team.thrust; s.vy += Math.sin(s.a) * team.thrust; if (t % 4 === 0) beep(60, .03, 'sawtooth', .02); }
  const sp = Math.hypot(s.vx, s.vy); if (sp > team.speed) { s.vx *= team.speed / sp; s.vy *= team.speed / sp; }
  s.vx *= .992; s.vy *= .992; s.x += s.vx; s.y += s.vy; wrap(s);
  if (s.cd > 0) s.cd--; if (s.inv > 0) s.inv--;
  if (keys.Space && s.cd <= 0 && bullets.length < team.maxB) { shoot(s, team, bullets, 8, 55); s.cd = team.cool; beep(880, .05); }

  [bullets, ebullets].forEach(l => { l.forEach(b => { b.x += b.vx; b.y += b.vy; b.l--; wrap(b); }); });
  bullets = bullets.filter(b => b.l > 0); ebullets = ebullets.filter(b => b.l > 0);
  rocks.forEach(moveRock);

  // rival fleets from the three other bases
  if (rivals.length < Math.min(3, 1 + Math.floor(wave / 2)) && Math.random() < .004) spawnRival();
  rivals.forEach(r => {
    const aim = Math.atan2(s.y - r.y, s.x - r.x); r.a = aim + R(-.35, .35);
    r.vy += Math.sin(t / 40 + r.x) * .02; r.x += r.vx; r.y += r.vy; wrap(r);
    if (--r.cd <= 0) { shoot(r, r.T, ebullets, 4.5, 90); r.cd = R(70, 120) - wave * 2; beep(300, .06, 'triangle'); }
    if (dist(r, s) < r.T.size + team.size - 4) { r.hp = 0; die(); }
  });

  // collisions
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; let hit = false;
    for (let j = rocks.length - 1; j >= 0; j--) if (dist(b, rocks[j]) < rocks[j].r) { breakRock(j); hit = true; break; }
    if (!hit) for (const r of rivals) if (dist(b, r) < r.T.size) { hit = true; if (--r.hp <= 0) { score += 250; boom(r.x, r.y, 30, r.T.color); beep(90, .3, 'sawtooth'); } else boom(b.x, b.y, 5, '#fff'); break; }
    if (hit) bullets.splice(i, 1);
  }
  rivals = rivals.filter(r => r.hp > 0);
  rocks.forEach(k => { if (dist(k, s) < k.r + team.size * .6) { die(); } });
  ebullets.forEach(b => { if (dist(b, s) < team.size * .8) { b.l = 0; die(); } });
  ebullets.forEach(b => rocks.forEach((k, j) => { if (dist(b, k) < k.r) { b.l = 0; } }));

  if (!rocks.length) { rivals = []; ebullets = []; nextWave(); beep(660, .3); }
}
function moveRock(k) { k.x += k.vx; k.y += k.vy; k.rot += k.vr; wrap(k); }

// ---------- draw ----------
function poly(pts, x, y, a, close = true) {
  const c = Math.cos(a), s = Math.sin(a); ctx.beginPath();
  pts.forEach((p, i) => { const px = x + p[0] * c - p[1] * s, py = y + p[0] * s + p[1] * c; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
  if (close) ctx.closePath(); ctx.stroke();
}
// draw an object at its position plus wrapped ghost copies so it crosses tile edges seamlessly
function tiled(o, r, fn) {
  for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) {
    if (o.x + dx < -r || o.x + dx > W + r || o.y + dy < -r || o.y + dy > H + r) continue;
    fn(o.x + dx, o.y + dy);
  }
}
function drawBackground() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // Andromeda: grows and drifts into view as the collision progresses
  const p = (collision || 0) / 100, gx = W * (1.05 - p * .45), gy = H * (.3 + p * .1), sz = 90 + p * 260;
  ctx.save(); ctx.translate(gx, gy); ctx.rotate(-.5 + t * .0003);
  for (let i = 0; i < 9; i++) {
    ctx.strokeStyle = `rgba(150,120,255,${.05 + i * .02})`; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 0, sz * (1 - i * .09), sz * .3 * (1 - i * .08), 0, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,240,200,.5)'; ctx.beginPath(); ctx.arc(0, 0, 4 + p * 8, 0, TAU); ctx.fill(); ctx.restore();
  // Milky Way arm band
  ctx.strokeStyle = 'rgba(100,180,255,.08)'; ctx.lineWidth = 40; ctx.beginPath(); ctx.moveTo(-20, H * .9); ctx.quadraticCurveTo(W * .3, H * .6, W * .55, H * 1.05); ctx.stroke();
  // tile grid (the playfield is a wrapping 80px tile map, like the arcade screen)
  ctx.strokeStyle = 'rgba(80,120,160,.07)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += TILE) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += TILE) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  stars.forEach(s => { ctx.fillStyle = `rgba(255,255,255,${.3 + s.z * .6})`; ctx.fillRect(s.x, s.y, s.z > .7 ? 2 : 1, s.z > .7 ? 2 : 1); });
}
function drawShip(o, T, thrusting, blink) {
  if (blink && Math.floor(t / 4) % 2) return;
  ctx.strokeStyle = T.color; ctx.lineWidth = 2;
  tiled(o, 30, (x, y) => {
    poly(T.hull, x, y, o.a);
    if (thrusting) { ctx.strokeStyle = '#fa4'; poly([[-T.size * .6, -4], [-T.size - R(4, 12), 0], [-T.size * .6, 4]], x, y, o.a, false); ctx.strokeStyle = T.color; }
  });
}
function draw() {
  drawBackground();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff';
  rocks.forEach(k => tiled(k, k.r * 1.3, (x, y) => poly(k.pts, x, y, k.rot)));
  rivals && rivals.forEach(r => drawShip(r, r.T, false, false));
  if (ship) drawShip(ship, team, keys.ArrowUp || keys.KeyW, ship.inv > 0);
  if (ship && ship.hp > 1) { ctx.strokeStyle = team.color; ctx.globalAlpha = .4; tiled(ship, 30, (x, y) => { ctx.beginPath(); ctx.arc(x, y, team.size + 8, 0, TAU); ctx.stroke(); }); ctx.globalAlpha = 1; }
  bullets && bullets.concat(ebullets).forEach(b => { ctx.fillStyle = b.col; ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3); });
  parts.forEach(p => { ctx.fillStyle = p.col; ctx.globalAlpha = Math.min(1, p.l / 25); ctx.fillRect(p.x, p.y, 2, 2); }); ctx.globalAlpha = 1;
  if (state !== 'select') hud();
}
function hud() {
  ctx.font = 'bold 22px "Courier New"'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(String(score).padStart(6, '0'), 20, 16);
  ctx.fillStyle = team.color; ctx.font = '14px "Courier New"'; ctx.fillText(team.name.toUpperCase() + ' - ' + team.pilot, 20, 46);
  for (let i = 0; i < lives; i++) { ctx.strokeStyle = team.color; ctx.lineWidth = 1.5; poly(team.hull.map(p => [p[0] * .8, p[1] * .8]), 30 + i * 28, 82, -Math.PI / 2); }
  ctx.textAlign = 'right'; ctx.fillStyle = '#b9f'; ctx.fillText('ANDROMEDA COLLISION ' + collision + '%', W - 20, 20);
  ctx.strokeStyle = '#b9f'; ctx.strokeRect(W - 220, 44, 200, 8); ctx.fillStyle = '#b9f'; ctx.fillRect(W - 220, 44, 2 * collision, 8);
  ctx.textAlign = 'center';
  if (msgT > 0) { ctx.fillStyle = '#fff'; ctx.font = '24px "Courier New"'; ctx.fillText(msg, W / 2, H * .18); }
  if (paused) { ctx.fillStyle = '#fff'; ctx.font = '40px "Courier New"'; ctx.fillText('PAUSED', W / 2, H / 2 - 20); }
  if (state === 'over') {
    ctx.fillStyle = '#fff'; ctx.font = '48px "Courier New"'; ctx.fillText('GAME OVER', W / 2, H / 2 - 50);
    ctx.font = '20px "Courier New"'; ctx.fillStyle = team.color; ctx.fillText(team.name + ' fell at wave ' + wave + ' with ' + score + ' points', W / 2, H / 2 + 10);
    ctx.fillStyle = '#9bd'; ctx.fillText('Press Enter to choose a base again', W / 2, H / 2 + 50);
  }
}

// ---------- boot ----------
collision = 10; wave = 1; rocks = []; parts = []; bullets = []; ebullets = []; rivals = [];
stars = Array.from({ length: 90 }, () => ({ x: R(0, W), y: R(0, H), z: R(.2, 1) }));
for (let i = 0; i < 6; i++) rocks.push(mkRock(R(0, W), R(0, H), 3));
(function loop() { if (!paused) update(); draw(); requestAnimationFrame(loop); })();
})();
