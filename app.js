const gameCanvas = document.querySelector("#game");
const radarCanvas = document.querySelector("#radar");
const ctx = gameCanvas.getContext("2d");
const radar = radarCanvas.getContext("2d");

const ui = {
  pauseButton: document.querySelector("#pauseButton"),
  soundButton: document.querySelector("#soundButton"),
  status: document.querySelector("#statusText"),
  wave: document.querySelector("#waveText"),
  speed: document.querySelector("#speedText"),
  ammo: document.querySelector("#ammoText"),
  message: document.querySelector("#messageText"),
  hull: document.querySelector("#hullMeter"),
  energy: document.querySelector("#energyMeter"),
  score: document.querySelector("#scoreText"),
  hits: document.querySelector("#hitsText"),
  boss: document.querySelector("#bossText"),
  link: document.querySelector("#linkText"),
  transcript: document.querySelector("#transcript"),
  taunt: document.querySelector("#tauntButton"),
  turkey: document.querySelector("#turkeyButton"),
};

const keys = new Set();
const world = {
  width: 3600,
  height: 2600,
  time: 0,
  last: performance.now(),
  paused: false,
  sound: false,
  score: 0,
  hits: 0,
  wave: 1,
  messageClock: 0,
  turkeyClock: 0,
};

const player = {
  x: world.width / 2,
  y: world.height / 2,
  vx: 0,
  vy: 0,
  angle: -Math.PI / 2,
  radius: 16,
  hull: 100,
  energy: 100,
  cooldown: 0,
};

let audioContext;
const shots = [];
const enemies = [];
const particles = [];
const stars = Array.from({ length: 260 }, () => ({
  x: Math.random() * world.width,
  y: Math.random() * world.height,
  z: 0.35 + Math.random() * 1.6,
}));

function boot() {
  log("Lighthouse Design link initialized.");
  log("Void local sector loaded.");
  log("Boss channel idle.");
  spawnWave();
  resize();
  requestAnimationFrame(frame);
}

function resize() {
  const rect = gameCanvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  gameCanvas.width = Math.max(640, Math.floor(rect.width * ratio));
  gameCanvas.height = Math.max(420, Math.floor(rect.height * ratio));
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function spawnWave() {
  enemies.length = 0;
  const count = 5 + world.wave * 2;
  for (let i = 0; i < count; i += 1) {
    spawnEnemy(i === count - 1 && world.wave % 3 === 0);
  }
  showMessage(`Sector ${String(world.wave).padStart(2, "0")} open. Clear all bogies.`);
}

function spawnEnemy(isBoss = false) {
  const edge = Math.floor(Math.random() * 4);
  const x = edge === 0 ? 140 : edge === 1 ? world.width - 140 : Math.random() * world.width;
  const y = edge === 2 ? 140 : edge === 3 ? world.height - 140 : Math.random() * world.height;
  enemies.push({
    x,
    y,
    vx: 0,
    vy: 0,
    radius: isBoss ? 34 : 18,
    hull: isBoss ? 120 : 28,
    maxHull: isBoss ? 120 : 28,
    boss: isBoss,
    phase: Math.random() * Math.PI * 2,
    cooldown: 0,
  });
  if (isBoss) {
    log("Boss has entered the void.");
  }
}

function frame(now) {
  const dt = Math.min(0.033, (now - world.last) / 1000);
  world.last = now;
  if (!world.paused) {
    update(dt);
  }
  draw();
  requestAnimationFrame(frame);
}

function update(dt) {
  world.time += dt;
  world.messageClock = Math.max(0, world.messageClock - dt);
  world.turkeyClock = Math.max(0, world.turkeyClock - dt);
  player.cooldown = Math.max(0, player.cooldown - dt);

  const turn = (keys.has("ArrowLeft") || keys.has("KeyA") ? -1 : 0) +
    (keys.has("ArrowRight") || keys.has("KeyD") ? 1 : 0);
  const thrust = keys.has("ArrowUp") || keys.has("KeyW");
  const brake = keys.has("ArrowDown") || keys.has("KeyS");
  player.angle += turn * dt * 3.8;

  if (thrust && player.energy > 0) {
    player.vx += Math.cos(player.angle) * 460 * dt;
    player.vy += Math.sin(player.angle) * 460 * dt;
    player.energy = Math.max(0, player.energy - 16 * dt);
    puff(player.x - Math.cos(player.angle) * 17, player.y - Math.sin(player.angle) * 17, "#ffd66e", 1);
    tone(72, 0.025, "sawtooth", 0.025);
  } else {
    player.energy = Math.min(100, player.energy + 12 * dt);
  }

  if (brake) {
    player.vx *= 0.975;
    player.vy *= 0.975;
  }

  if (keys.has("Space")) {
    fire();
  }

  player.vx *= 0.995;
  player.vy *= 0.995;
  player.x = wrap(player.x + player.vx * dt, world.width);
  player.y = wrap(player.y + player.vy * dt, world.height);

  updateShots(dt);
  updateEnemies(dt);
  updateParticles(dt);

  if (enemies.length === 0) {
    world.wave += 1;
    spawnWave();
  }

  syncUi();
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i];
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    if (shot.life <= 0 || shot.x < 0 || shot.y < 0 || shot.x > world.width || shot.y > world.height) {
      shots.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      if (distance(shot, enemy) < enemy.radius + 4) {
        enemy.hull -= 18;
        shots.splice(i, 1);
        world.hits += 1;
        world.score += enemy.boss ? 40 : 10;
        puff(shot.x, shot.y, enemy.boss ? "#ff6464" : "#70d8ff", 10);
        tone(enemy.boss ? 130 : 210, 0.08, "square", 0.05);
        if (enemy.hull <= 0) {
          explode(enemy);
          enemies.splice(j, 1);
        }
        break;
      }
    }
  }
}

function updateEnemies(dt) {
  for (const enemy of enemies) {
    enemy.phase += dt;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    const dx = shortest(player.x - enemy.x, world.width);
    const dy = shortest(player.y - enemy.y, world.height);
    const d = Math.hypot(dx, dy) || 1;
    const chase = enemy.boss ? 155 : 105;
    enemy.vx += (dx / d) * chase * dt + Math.cos(enemy.phase * 2.1) * 24 * dt;
    enemy.vy += (dy / d) * chase * dt + Math.sin(enemy.phase * 1.7) * 24 * dt;
    enemy.vx *= 0.988;
    enemy.vy *= 0.988;
    enemy.x = wrap(enemy.x + enemy.vx * dt, world.width);
    enemy.y = wrap(enemy.y + enemy.vy * dt, world.height);

    if (d < player.radius + enemy.radius) {
      player.hull = Math.max(0, player.hull - (enemy.boss ? 28 : 12) * dt);
      showMessage(enemy.boss ? "Boss collision. Hull compromised." : "Contact damage.");
      puff(player.x, player.y, "#ff6464", 2);
      if (player.hull <= 0) {
        resetRun();
        return;
      }
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function fire() {
  if (player.cooldown > 0 || player.energy < 8) return;
  player.cooldown = 0.16;
  player.energy -= 8;
  shots.push({
    x: player.x + Math.cos(player.angle) * 22,
    y: player.y + Math.sin(player.angle) * 22,
    vx: Math.cos(player.angle) * 760 + player.vx * 0.35,
    vy: Math.sin(player.angle) * 760 + player.vy * 0.35,
    life: 1.15,
  });
  tone(520, 0.055, "square", 0.04);
}

function resetRun() {
  log("Ship lost. Fresh clone launched from dock.");
  showMessage("Clone restored. Try not to leave so much wreckage.");
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.hull = 100;
  player.energy = 100;
  world.score = Math.max(0, Math.floor(world.score * 0.5));
  world.wave = 1;
  shots.length = 0;
  particles.length = 0;
  spawnWave();
}

function draw() {
  const width = gameCanvas.clientWidth;
  const height = gameCanvas.clientHeight;
  const camera = { x: player.x - width / 2, y: player.y - height / 2 };

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#050608";
  ctx.fillRect(0, 0, width, height);
  drawStars(camera, width, height);
  drawGrid(camera, width, height);

  for (const shot of shots) drawShot(shot, camera);
  for (const enemy of enemies) drawEnemy(enemy, camera);
  for (const particle of particles) drawParticle(particle, camera);
  drawPlayer(width / 2, height / 2);
  if (world.turkeyClock > 0) drawTurkey(width, height);
  drawRadar();
}

function drawStars(camera, width, height) {
  ctx.fillStyle = "#dadada";
  for (const star of stars) {
    const x = mod(star.x - camera.x * star.z * 0.18, world.width);
    const y = mod(star.y - camera.y * star.z * 0.18, world.height);
    const sx = x > width + 20 ? x - world.width : x;
    const sy = y > height + 20 ? y - world.height : y;
    if (sx >= -20 && sy >= -20 && sx <= width + 20 && sy <= height + 20) {
      ctx.globalAlpha = 0.45 + star.z * 0.25;
      ctx.fillRect(sx, sy, star.z, star.z);
    }
  }
  ctx.globalAlpha = 1;
}

function drawGrid(camera, width, height) {
  ctx.strokeStyle = "rgba(112,216,255,0.08)";
  ctx.lineWidth = 1;
  const step = 120;
  const startX = -mod(camera.x, step);
  const startY = -mod(camera.y, step);
  for (let x = startX; x < width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = startY; y < height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawPlayer(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(player.angle);
  ctx.strokeStyle = "#72ff9b";
  ctx.fillStyle = "#0d2316";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(-14, -12);
  ctx.lineTo(-8, 0);
  ctx.lineTo(-14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,214,110,0.75)";
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-29 - Math.random() * 6, 0);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(enemy, camera) {
  const p = screenPoint(enemy, camera);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(enemy.phase);
  ctx.strokeStyle = enemy.boss ? "#ff6464" : "#70d8ff";
  ctx.fillStyle = enemy.boss ? "#2a0909" : "#071b23";
  ctx.lineWidth = enemy.boss ? 3 : 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const r = enemy.radius * (i % 2 ? 0.58 : 1);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  const bar = enemy.radius * 1.8;
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(p.x - bar / 2, p.y - enemy.radius - 12, bar, 4);
  ctx.fillStyle = enemy.boss ? "#ff6464" : "#70d8ff";
  ctx.fillRect(p.x - bar / 2, p.y - enemy.radius - 12, bar * (enemy.hull / enemy.maxHull), 4);
}

function drawShot(shot, camera) {
  const p = screenPoint(shot, camera);
  ctx.strokeStyle = "#ffd66e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x - shot.vx * 0.025, p.y - shot.vy * 0.025);
  ctx.stroke();
}

function drawParticle(p, camera) {
  const s = screenPoint(p, camera);
  ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
  ctx.fillStyle = p.color;
  ctx.fillRect(s.x, s.y, p.size, p.size);
  ctx.globalAlpha = 1;
}

function drawTurkey(width, height) {
  const x = width * 0.78;
  const y = height * 0.72 + Math.sin(world.time * 8) * 10;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#6b3b18";
  ctx.strokeStyle = "#ffd66e";
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.ellipse(i * 9, -16 - Math.abs(i) * 3, 10, 22, i * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = "#9f5a20";
  ctx.beginPath();
  ctx.ellipse(0, 2, 26, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#d64b32";
  ctx.beginPath();
  ctx.arc(22, -10, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffd66e";
  ctx.beginPath();
  ctx.moveTo(30, -10);
  ctx.lineTo(43, -6);
  ctx.lineTo(30, -2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawRadar() {
  const size = radarCanvas.width;
  radar.clearRect(0, 0, size, size);
  radar.fillStyle = "#08100b";
  radar.fillRect(0, 0, size, size);
  radar.strokeStyle = "rgba(114,255,155,0.45)";
  radar.lineWidth = 1;
  radar.beginPath();
  radar.arc(size / 2, size / 2, 96, 0, Math.PI * 2);
  radar.moveTo(size / 2, 14);
  radar.lineTo(size / 2, size - 14);
  radar.moveTo(14, size / 2);
  radar.lineTo(size - 14, size / 2);
  radar.stroke();

  radar.fillStyle = "#72ff9b";
  radar.fillRect(size / 2 - 3, size / 2 - 3, 6, 6);
  for (const enemy of enemies) {
    const dx = shortest(enemy.x - player.x, world.width) / 15;
    const dy = shortest(enemy.y - player.y, world.height) / 15;
    if (Math.hypot(dx, dy) < 96) {
      radar.fillStyle = enemy.boss ? "#ff6464" : "#70d8ff";
      radar.fillRect(size / 2 + dx - 3, size / 2 + dy - 3, enemy.boss ? 8 : 5, enemy.boss ? 8 : 5);
    }
  }
}

function syncUi() {
  ui.status.textContent = player.hull <= 25 ? "DANGER" : world.paused ? "PAUSED" : "ACTIVE";
  ui.wave.textContent = `SECTOR ${String(world.wave).padStart(2, "0")}`;
  ui.speed.textContent = `${Math.round(Math.hypot(player.vx, player.vy)).toString().padStart(3, "0")}`;
  ui.ammo.textContent = player.energy < 8 ? "LOW" : "LASER";
  ui.message.textContent = world.messageClock > 0 ? ui.message.textContent : "Arrows/WASD steer. Space fires. Clear the sector.";
  ui.hull.value = player.hull;
  ui.energy.value = player.energy;
  ui.score.textContent = world.score.toString();
  ui.hits.textContent = world.hits.toString();
  ui.boss.textContent = enemies.some((enemy) => enemy.boss) ? "In sector" : "Waiting";
  ui.link.textContent = world.sound ? "DSP audio" : "Silent";
  ui.pauseButton.classList.toggle("is-active", world.paused);
  ui.soundButton.classList.toggle("is-active", world.sound);
}

function showMessage(message) {
  ui.message.textContent = message;
  world.messageClock = 3.2;
}

function log(message) {
  const p = document.createElement("p");
  p.textContent = `> ${message}`;
  ui.transcript.prepend(p);
  while (ui.transcript.children.length > 7) {
    ui.transcript.lastElementChild.remove();
  }
}

function puff(x, y, color, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 180;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      color,
      size: 2 + Math.random() * 4,
      life: 0.25 + Math.random() * 0.65,
      maxLife: 0.9,
    });
  }
}

function explode(enemy) {
  world.score += enemy.boss ? 500 : 100;
  puff(enemy.x, enemy.y, enemy.boss ? "#ff6464" : "#70d8ff", enemy.boss ? 70 : 28);
  log(enemy.boss ? "Boss channel closed." : "Bogey removed from sector.");
  tone(enemy.boss ? 52 : 92, enemy.boss ? 0.45 : 0.18, "sawtooth", enemy.boss ? 0.12 : 0.06);
}

function tone(frequency, duration, type, gain) {
  if (!world.sound) return;
  audioContext ||= new AudioContext();
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  amp.gain.value = gain;
  amp.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  osc.connect(amp).connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration);
}

function turkeyCall() {
  world.turkeyClock = 4.5;
  showMessage("A Space Turkey gobbles sweet nothings over the DSP.");
  log("Unlisted poultry object detected.");
  if (world.sound) {
    [210, 155, 125, 180, 112].forEach((freq, i) => {
      setTimeout(() => tone(freq, 0.11, "sawtooth", 0.08), i * 95);
    });
  }
}

function screenPoint(point, camera) {
  return {
    x: point.x - camera.x,
    y: point.y - camera.y,
  };
}

function wrap(value, max) {
  return mod(value, max);
}

function mod(value, max) {
  return ((value % max) + max) % max;
}

function shortest(value, max) {
  if (value > max / 2) return value - max;
  if (value < -max / 2) return value + max;
  return value;
}

function distance(a, b) {
  return Math.hypot(shortest(a.x - b.x, world.width), shortest(a.y - b.y, world.height));
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => keys.delete(event.code));

gameCanvas.addEventListener("pointerdown", () => {
  gameCanvas.focus();
  showMessage("Pilot input captured.");
});

ui.pauseButton.addEventListener("click", () => {
  world.paused = !world.paused;
  showMessage(world.paused ? "Simulation paused." : "Simulation resumed.");
  syncUi();
});

ui.soundButton.addEventListener("click", () => {
  world.sound = !world.sound;
  if (world.sound) {
    audioContext ||= new AudioContext();
    audioContext.resume();
    tone(330, 0.09, "square", 0.05);
  }
  syncUi();
});

ui.taunt.addEventListener("click", () => {
  const hasBoss = enemies.some((enemy) => enemy.boss);
  if (!hasBoss) spawnEnemy(true);
  log("You: Nice cube, boss.");
  showMessage("Boss taunted onto local channel.");
});

ui.turkey.addEventListener("click", turkeyCall);

boot();
