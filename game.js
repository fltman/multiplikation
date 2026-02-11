// ============================================================
// Multiplikationsspelet - Fanga ratt svar med handerna!
// ============================================================

const CONFIG = {
  numAnswers: 5,
  baseFallSpeed: 1.2,
  handRadius: 70,
  bubbleRadius: 64,
  spawnDelay: 900,       // ms between each bubble spawn
  newRoundDelay: 1500,   // ms before next problem after catch
  feedbackDuration: 800,
  particleCount: 20,
  maxFallSpeed: 3,
  speedIncreasePerPoint: 0.03,
};

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE',
  '#85C1E9', '#F8B500', '#FF8A5C', '#EA5455',
];

// ============================================================
// Game State
// ============================================================

const state = {
  mode: 'multiply',
  score: 0,
  streak: 0,
  bestStreak: 0,
  problem: null,
  answers: [],
  hands: [],
  particles: [],
  gameActive: false,
  waitingForNext: false,
  selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  answersSpawned: 0,
  lastSpawnTime: 0,
  missedThisRound: false,
  fireworks: [],
  tableProgress: {},
  completedTables: new Set(),
  celebration: null,
  unlockedAchievements: new Set(),
  achievementQueue: [],    // queued popups to show
  activeAchievement: null, // currently showing popup
  perfectTables: new Set(), // tables completed without any errors
  tableErrors: {},         // { 3: true } if any error occurred in table 3
};

// ============================================================
// Achievements
// ============================================================

const ACHIEVEMENTS = [
  // Streak
  { id: 'streak5',    name: 'Stjärnskott',       desc: '5 rätt i rad',               icon: 'badges/streak5.png',    check: () => state.streak >= 5 },
  { id: 'streak10',   name: 'Eldfingrar',        desc: '10 rätt i rad',              icon: 'badges/streak10.png',   check: () => state.streak >= 10 },
  { id: 'streak20',   name: 'Kometjakten',       desc: '20 rätt i rad',              icon: 'badges/streak20.png',   check: () => state.streak >= 20 },
  { id: 'streak50',   name: 'Legenden',          desc: '50 rätt i rad',              icon: 'badges/streak50.png',   check: () => state.streak >= 50 },
  // Score
  { id: 'score25',    name: 'Räknenansen',       desc: '25 poäng',                   icon: 'badges/score25.png',    check: () => state.score >= 25 },
  { id: 'score50',    name: 'Siffermästaren',     desc: '50 poäng',                   icon: 'badges/score50.png',    check: () => state.score >= 50 },
  { id: 'score100',   name: 'Matteprofessorn',   desc: '100 poäng',                  icon: 'badges/score100.png',   check: () => state.score >= 100 },
  // Tables
  { id: 'table1',     name: 'Tabellknäckaren',   desc: 'Klara din första tabell',    icon: 'badges/table1.png',     check: () => state.completedTables.size >= 1 },
  { id: 'table5',     name: 'Halvvägs!',         desc: 'Klara 5 tabeller',           icon: 'badges/table5.png',     check: () => state.completedTables.size >= 5 },
  { id: 'tableAll',   name: 'Grandmästaren',     desc: 'Klara alla valda tabeller',  icon: 'badges/tableAll.png',   check: () => state.completedTables.size >= state.selectedTables.length && state.selectedTables.length > 0 },
  // Special
  { id: 'perfect',    name: 'Perfektionisten',   desc: 'Klara en tabell utan ett enda fel', icon: 'badges/perfect.png', check: () => state.perfectTables.size >= 1 },
];

const achievementImages = {};

function preloadAchievementImages() {
  for (const a of ACHIEVEMENTS) {
    const img = new Image();
    img.src = a.icon;
    achievementImages[a.id] = img;
  }
}

function checkAchievements() {
  for (const a of ACHIEVEMENTS) {
    if (state.unlockedAchievements.has(a.id)) continue;
    if (a.check()) {
      state.unlockedAchievements.add(a.id);
      state.achievementQueue.push(a);
    }
  }
}

function updateAchievementPopup() {
  if (state.activeAchievement) {
    state.activeAchievement.timer--;
    if (state.activeAchievement.timer <= 0) {
      state.activeAchievement = null;
    }
  }

  if (!state.activeAchievement && state.achievementQueue.length > 0) {
    const a = state.achievementQueue.shift();
    state.activeAchievement = { ...a, timer: 180 }; // ~3 seconds
  }
}

function renderAchievementPopup() {
  const a = state.activeAchievement;
  if (!a) return;

  const fadeIn = Math.min(1, (180 - a.timer) / 15);
  const fadeOut = Math.min(1, a.timer / 20);
  const alpha = Math.min(fadeIn, fadeOut);

  // Slide in from right
  const slideOffset = (1 - fadeIn) * 100;

  const boxW = 300;
  const boxH = 80;
  const boxX = $canvas.width - boxW - 20 + slideOffset;
  const boxY = $canvas.height - boxH - 80;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Background
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 16);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Badge image
  const img = achievementImages[a.id];
  const imgSize = 56;
  const imgX = boxX + 12;
  const imgY = boxY + (boxH - imgSize) / 2;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
  } else {
    // Fallback: gold circle with star
    ctx.beginPath();
    ctx.arc(imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2 - 4, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(imgX + imgSize / 2 - 5, imgY + imgSize / 2 - 5, 0, imgX + imgSize / 2, imgY + imgSize / 2, imgSize / 2);
    grad.addColorStop(0, '#FFF8B0');
    grad.addColorStop(0.6, '#FFD700');
    grad.addColorStop(1, '#B8860B');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2B50', imgX + imgSize / 2, imgY + imgSize / 2);
  }

  // Text
  const textX = imgX + imgSize + 12;
  ctx.fillStyle = '#FFD700';
  ctx.font = `bold 11px 'Nunito', sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ACHIEVEMENT UNLOCKED', textX, boxY + 12);

  ctx.fillStyle = '#fff';
  ctx.font = `bold 18px 'Fredoka One', cursive`;
  ctx.fillText(a.name, textX, boxY + 28);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = `14px 'Nunito', sans-serif`;
  ctx.fillText(a.desc, textX, boxY + 52);

  ctx.restore();
}

function renderUnlockedBadges() {
  if (state.unlockedAchievements.size === 0) return;

  const size = 48;
  const gap = 6;
  const margin = 16;
  const x = $canvas.width - margin - size;

  // Stack badges vertically along the right edge, below the top bar
  const startY = 80;

  ctx.save();
  let i = 0;
  for (const achId of state.unlockedAchievements) {
    const y = startY + i * (size + gap);
    const img = achievementImages[achId];

    // Subtle background
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fill();

    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      // Fallback
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(x + size / 2 - 4, y + size / 2 - 4, 0, x + size / 2, y + size / 2, size / 2);
      grad.addColorStop(0, '#FFF8B0');
      grad.addColorStop(0.6, '#FFD700');
      grad.addColorStop(1, '#B8860B');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('\u2B50', x + size / 2, y + size / 2);
    }

    i++;
  }
  ctx.restore();
}

// ============================================================
// Difficulty Tracker
// Tracks how hard each problem is for the player.
// Key format: "3x7" (always smaller x larger for consistency)
// Higher weight = harder for the player = shown more often.
// ============================================================

const difficulty = {};

function problemKey(a, b) {
  // Normalize: always "smallerxlarger"
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return `${lo}x${hi}`;
}

function getDifficulty(a, b) {
  return difficulty[problemKey(a, b)] || 0;
}

function adjustDifficulty(a, b, delta) {
  const key = problemKey(a, b);
  difficulty[key] = Math.max(0, (difficulty[key] || 0) + delta);
}

function pickWeightedProblem() {
  // Build list of all possible (table, factor) pairs, excluding completed tables
  const pairs = [];
  for (const table of state.selectedTables) {
    if (state.completedTables.has(table)) continue;
    for (let factor = 1; factor <= 10; factor++) {
      pairs.push({ table, factor });
    }
  }

  // If all tables are done, nothing left to practice
  if (pairs.length === 0) return null;

  // Assign weights:
  // - Unsolved problems get high base weight (5) so they appear often
  // - Solved (but in incomplete table) get low base weight (0.5)
  // - Difficulty score adds on top
  const weights = pairs.map(p => {
    const progress = state.tableProgress[p.table];
    const solved = progress && progress.has(p.factor);
    const base = solved ? 0.5 : 5;
    return base + getDifficulty(p.table, p.factor);
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  // Weighted random pick
  let r = Math.random() * totalWeight;
  for (let i = 0; i < pairs.length; i++) {
    r -= weights[i];
    if (r <= 0) return pairs[i];
  }
  return pairs[pairs.length - 1];
}

// ============================================================
// DOM References
// ============================================================

const $video = document.getElementById('webcam');
const $canvas = document.getElementById('gameCanvas');
const ctx = $canvas.getContext('2d');
const $ui = document.getElementById('ui');
const $score = document.getElementById('score');
const $problem = document.getElementById('problemDisplay');
const $modeBtn = document.getElementById('modeBtn');
const $streak = document.getElementById('streakDisplay');
const $startScreen = document.getElementById('startScreen');
const $startBtn = document.getElementById('startBtn');
const $feedback = document.getElementById('feedback');
const $loading = document.getElementById('loading');
const $tableButtons = document.getElementById('tableButtons');

// ============================================================
// Table Selector
// ============================================================

function initTableSelector() {
  for (let i = 1; i <= 12; i++) {
    const btn = document.createElement('button');
    btn.className = 'table-btn' + (state.selectedTables.includes(i) ? ' active' : '');
    btn.textContent = i;
    btn.addEventListener('click', () => {
      if (state.selectedTables.includes(i)) {
        if (state.selectedTables.length > 1) {
          state.selectedTables = state.selectedTables.filter(t => t !== i);
          btn.classList.remove('active');
        }
      } else {
        state.selectedTables.push(i);
        btn.classList.add('active');
      }
    });
    $tableButtons.appendChild(btn);
  }
}

// ============================================================
// Camera & Hand Tracking
// ============================================================

let mpHands, camera;

async function initCamera() {
  mpHands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  mpHands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6,
  });

  mpHands.onResults(onHandResults);

  camera = new Camera($video, {
    onFrame: async () => {
      await mpHands.send({ image: $video });
    },
    width: 1280,
    height: 720,
  });

  await camera.start();
}

// Track previous hand states for grip detection (index by hand order)
const prevHandOpen = [true, true];

function isHandOpen(landmarks) {
  // Compare fingertip-to-palm distance vs finger-base-to-palm distance
  // If fingertips are close to palm, hand is closed
  const palmIndices = [0, 5, 9, 13, 17];
  let px = 0, py = 0;
  for (const idx of palmIndices) {
    px += landmarks[idx].x;
    py += landmarks[idx].y;
  }
  px /= palmIndices.length;
  py /= palmIndices.length;

  const tipIndices = [8, 12, 16, 20]; // index, middle, ring, pinky tips
  let avgTipDist = 0;
  for (const idx of tipIndices) {
    const dx = landmarks[idx].x - px;
    const dy = landmarks[idx].y - py;
    avgTipDist += Math.sqrt(dx * dx + dy * dy);
  }
  avgTipDist /= tipIndices.length;

  // Threshold: below this = closed fist
  return avgTipDist > 0.09;
}

function onHandResults(results) {
  state.hands = [];

  if (results.multiHandLandmarks) {
    for (let h = 0; h < results.multiHandLandmarks.length; h++) {
      const landmarks = results.multiHandLandmarks[h];

      // Palm center
      const palmIndices = [0, 5, 9, 13, 17];
      let cx = 0, cy = 0;
      for (const idx of palmIndices) {
        cx += landmarks[idx].x;
        cy += landmarks[idx].y;
      }
      cx /= palmIndices.length;
      cy /= palmIndices.length;

      const open = isHandOpen(landmarks);
      const wasOpen = prevHandOpen[h];
      const justGripped = wasOpen && !open; // transition: open -> closed
      prevHandOpen[h] = open;

      // Flip x for mirrored video
      state.hands.push({
        x: (1 - cx) * $canvas.width,
        y: cy * $canvas.height,
        landmarks: landmarks,
        open: open,
        justGripped: justGripped,
      });
    }
  }

  // Reset hands that disappeared
  for (let h = (results.multiHandLandmarks || []).length; h < 2; h++) {
    prevHandOpen[h] = true;
  }
}

// ============================================================
// Problem Generation
// ============================================================

function generateProblem() {
  const pick = pickWeightedProblem();
  if (!pick) {
    // All tables complete!
    state.answers = [];
    $problem.innerHTML = 'Alla tabeller klara!';
    launchFireworks(0);
    return;
  }
  const table = pick.table;
  const factor = pick.factor;
  const product = table * factor;
  state.missedThisRound = false;

  if (state.mode === 'multiply') {
    state.problem = { answer: product, a: table, b: factor };
    $problem.innerHTML = `${table} &times; ${factor} = ?`;
  } else {
    state.problem = { answer: factor, a: product, b: table };
    $problem.innerHTML =
      `<span class="fraction"><span class="num">${product}</span><span class="den">${table}</span></span> = ?`;
  }

  generateAnswers();
  state.answersSpawned = 0;
  state.lastSpawnTime = 0;
}

function generateAnswers() {
  const correct = state.problem.answer;
  const wrongSet = new Set();

  // Generate plausible wrong answers
  while (wrongSet.size < CONFIG.numAnswers - 1) {
    let wrong;
    const strategy = Math.random();

    if (strategy < 0.3) {
      // Close to correct
      wrong = correct + Math.floor(Math.random() * 5) + 1;
    } else if (strategy < 0.6) {
      wrong = correct - Math.floor(Math.random() * 5) - 1;
    } else if (strategy < 0.8) {
      // Same table, different factor
      const t = state.problem.a;
      const f = Math.floor(Math.random() * 10) + 1;
      wrong = state.mode === 'multiply' ? t * f : f;
    } else {
      // Random
      wrong = Math.floor(Math.random() * 100) + 1;
    }

    if (wrong > 0 && wrong !== correct && !wrongSet.has(wrong)) {
      wrongSet.add(wrong);
    }
  }

  const allValues = [correct, ...wrongSet];
  // Shuffle
  for (let i = allValues.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allValues[i], allValues[j]] = [allValues[j], allValues[i]];
  }

  const speed = CONFIG.baseFallSpeed + state.score * CONFIG.speedIncreasePerPoint;
  const clampedSpeed = Math.min(speed, CONFIG.maxFallSpeed);

  // Distribute answers across the screen width
  const margin = CONFIG.bubbleRadius + 30;
  const usableWidth = $canvas.width - margin * 2;
  const positions = [];

  for (let i = 0; i < allValues.length; i++) {
    let x;
    let tries = 0;
    do {
      x = margin + Math.random() * usableWidth;
      tries++;
    } while (tries < 50 && positions.some(px => Math.abs(px - x) < CONFIG.bubbleRadius * 3.5));
    positions.push(x);
  }

  state.answers = allValues.map((val, i) => ({
    x: positions[i],
    y: -CONFIG.bubbleRadius * 2,   // start above screen, will be staggered by spawn logic
    targetY: -CONFIG.bubbleRadius * 2,
    value: val,
    correct: val === correct,
    speed: clampedSpeed + (Math.random() - 0.5) * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    radius: CONFIG.bubbleRadius,
    caught: false,
    spawned: false,
    opacity: 1,
    scale: 1,
  }));
}

// ============================================================
// Collision Detection
// ============================================================

function checkCollisions() {
  if (state.waitingForNext) return;

  for (const hand of state.hands) {
    // Only catch when hand closes (grip)
    if (!hand.justGripped) continue;

    for (const ans of state.answers) {
      if (ans.caught || !ans.spawned) continue;

      const dx = hand.x - ans.x;
      const dy = hand.y - ans.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CONFIG.handRadius + ans.radius) {
        ans.caught = true;

        if (ans.correct) {
          onCorrectCatch(ans);
        } else {
          onWrongCatch(ans);
        }
        return;
      }
    }
  }
}

function onCorrectCatch(ans) {
  state.score++;
  state.streak++;
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;

  // Decrease difficulty on correct (more if first try, less if we missed waves)
  const reduction = state.missedThisRound ? -1 : -2;
  adjustDifficulty(state.problem.a, state.problem.b, reduction);

  // Track table progress
  const table = state.mode === 'multiply' ? state.problem.a : state.problem.b;
  const factor = state.mode === 'multiply' ? state.problem.b : state.problem.answer;
  if (!state.tableProgress[table]) state.tableProgress[table] = new Set();
  state.tableProgress[table].add(factor);

  // Check if table is complete (factors 1-10)
  if (state.tableProgress[table].size >= 10 && !state.completedTables.has(table)) {
    state.completedTables.add(table);
    if (!state.tableErrors[table]) {
      state.perfectTables.add(table);
    }
    launchFireworks(table);
  }

  $score.textContent = state.score;
  showFeedback('RATT!', 'correct');
  spawnParticles(ans.x, ans.y, ans.color, 30);
  checkAchievements();

  // Update streak display
  if (state.streak >= 3) {
    $streak.classList.remove('hidden');
    $streak.textContent = `${state.streak} i rad!`;
  }

  const delay = state.celebration ? 4000 : CONFIG.newRoundDelay;
  state.waitingForNext = true;
  setTimeout(() => {
    state.waitingForNext = false;
    generateProblem();
  }, delay);
}

function onWrongCatch(ans) {
  state.streak = 0;
  $streak.classList.add('hidden');

  // Mark table as having errors (for perfect tracking)
  const table = state.mode === 'multiply' ? state.problem.a : state.problem.b;
  state.tableErrors[table] = true;

  // Increase difficulty on wrong answer
  adjustDifficulty(state.problem.a, state.problem.b, 3);

  showFeedback('FEL!', 'wrong');
  spawnParticles(ans.x, ans.y, '#E74C3C', 15);

  // Shake the wrong bubble
  ans.scale = 0.7;
  ans.opacity = 0.4;
}

function showFeedback(text, type) {
  $feedback.textContent = text;
  $feedback.className = `show ${type}`;
  setTimeout(() => {
    $feedback.className = 'hidden';
  }, CONFIG.feedbackDuration);
}

// ============================================================
// Particles
// ============================================================

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 5;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      radius: 3 + Math.random() * 5,
      color,
      life: 40 + Math.random() * 20,
      maxLife: 60,
    });
  }
}

function updateParticles() {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.15; // gravity
    p.life--;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

// ============================================================
// Fireworks
// ============================================================

const FIREWORK_COLORS = [
  ['#FF6B6B', '#FFD93D', '#FF8E53'],
  ['#4ECDC4', '#45B7D1', '#96CEB4'],
  ['#BB8FCE', '#DDA0DD', '#F8B500'],
  ['#85C1E9', '#FFEAA7', '#FF6B6B'],
  ['#FFD700', '#FF4500', '#FF69B4'],
];

function launchFireworks(table) {
  state.celebration = { table, timer: 240 }; // ~4 seconds at 60fps

  // Launch multiple rockets with staggered timing
  for (let i = 0; i < 8; i++) {
    const delay = i * 15;
    const x = $canvas.width * (0.15 + Math.random() * 0.7);
    const targetY = $canvas.height * (0.15 + Math.random() * 0.35);
    const palette = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

    state.fireworks.push({
      x,
      y: $canvas.height + 10,
      targetY,
      speed: 6 + Math.random() * 4,
      palette,
      delay,
      exploded: false,
      trail: [],
    });
  }
}

function updateFireworks() {
  // Update celebration timer
  if (state.celebration) {
    state.celebration.timer--;
    if (state.celebration.timer <= 0) {
      state.celebration = null;
    }
  }

  for (let i = state.fireworks.length - 1; i >= 0; i--) {
    const fw = state.fireworks[i];

    if (fw.delay > 0) {
      fw.delay--;
      continue;
    }

    if (!fw.exploded) {
      // Rocket rising
      fw.trail.push({ x: fw.x, y: fw.y, life: 15 });
      fw.y -= fw.speed;

      // Slight wobble
      fw.x += (Math.random() - 0.5) * 1.5;

      if (fw.y <= fw.targetY) {
        // Explode!
        fw.exploded = true;
        const numParticles = 40 + Math.floor(Math.random() * 20);
        for (let j = 0; j < numParticles; j++) {
          const angle = (Math.PI * 2 * j) / numParticles + (Math.random() - 0.5) * 0.3;
          const speed = 2 + Math.random() * 6;
          const color = fw.palette[Math.floor(Math.random() * fw.palette.length)];
          state.particles.push({
            x: fw.x, y: fw.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 2 + Math.random() * 4,
            color,
            life: 50 + Math.random() * 40,
            maxLife: 90,
          });
        }
      }
    }

    // Fade trail
    for (let t = fw.trail.length - 1; t >= 0; t--) {
      fw.trail[t].life--;
      if (fw.trail[t].life <= 0) fw.trail.splice(t, 1);
    }

    // Remove when done
    if (fw.exploded && fw.trail.length === 0) {
      state.fireworks.splice(i, 1);
    }
  }
}

function renderFireworks() {
  // Draw rocket trails
  for (const fw of state.fireworks) {
    if (fw.delay > 0) continue;
    for (const t of fw.trail) {
      const alpha = t.life / 15;
      ctx.beginPath();
      ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 220, 150, ${alpha})`;
      ctx.fill();
    }
    // Draw rocket head
    if (!fw.exploded) {
      ctx.beginPath();
      ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
  }

  // Draw celebration text
  if (state.celebration) {
    const t = state.celebration.timer;
    const fadeIn = Math.min(1, (240 - t) / 20);
    const fadeOut = Math.min(1, t / 30);
    const alpha = Math.min(fadeIn, fadeOut);
    const scale = 0.8 + fadeIn * 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate($canvas.width / 2, $canvas.height / 2);
    ctx.scale(scale, scale);

    // Glow
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 30;

    ctx.font = `bold 72px 'Fredoka One', cursive`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${state.celebration.table}:ans tabell klar!`, 0, -10);

    ctx.shadowBlur = 0;
    ctx.font = `bold 28px 'Nunito', sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`${state.completedTables.size} av ${state.selectedTables.length} tabeller klara`, 0, 45);

    ctx.restore();
  }
}

// ============================================================
// Table Progress Indicator
// ============================================================

function renderTableProgress() {
  if (state.celebration) return; // don't draw during fireworks

  const tables = state.selectedTables.slice().sort((a, b) => a - b);
  const coinR = 11;
  const coinGap = 4;
  const rowHeight = (coinR * 2) + 6;
  const startX = 14;
  const startY = $canvas.height - 14 - tables.length * rowHeight;

  ctx.save();
  for (let t = 0; t < tables.length; t++) {
    const table = tables[t];
    const cy = startY + t * rowHeight + coinR;
    const completed = state.completedTables.has(table);
    const progress = state.tableProgress[table] || new Set();

    // Table number
    ctx.font = `bold 15px 'Fredoka One', cursive`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = completed ? '#FFD700' : 'rgba(255,255,255,0.6)';
    ctx.fillText(`${table}:`, startX + 20, cy);

    // Coins for factors 1-10
    for (let f = 1; f <= 10; f++) {
      const cx = startX + 28 + (f - 1) * (coinR * 2 + coinGap);
      const earned = completed || progress.has(f);

      if (earned) {
        drawCoin(cx, cy, coinR, f);
      } else {
        // Empty slot
        ctx.beginPath();
        ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dim number
        ctx.font = `bold 10px 'Nunito', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillText(f, cx, cy + 1);
      }
    }

    // Trophy if completed
    if (completed) {
      const tx = startX + 28 + 10 * (coinR * 2 + coinGap) + 4;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('\uD83C\uDFC6', tx, cy);
    }
  }
  ctx.restore();
}

function drawCoin(x, y, r, number) {
  ctx.save();

  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  const outerGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  outerGrad.addColorStop(0, '#FFE066');
  outerGrad.addColorStop(0.7, '#FFD700');
  outerGrad.addColorStop(1, '#B8860B');
  ctx.fillStyle = outerGrad;
  ctx.fill();

  // Inner circle
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
  const innerGrad = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, 0, x, y, r * 0.78);
  innerGrad.addColorStop(0, '#FFF8B0');
  innerGrad.addColorStop(0.5, '#FFD700');
  innerGrad.addColorStop(1, '#DAA520');
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Shine highlight
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  // Number
  ctx.font = `bold ${Math.round(r * 0.9)}px 'Fredoka One', cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#8B6914';
  ctx.fillText(number, x, y + 1);

  ctx.restore();
}

// ============================================================
// Rendering
// ============================================================

function render() {
  ctx.clearRect(0, 0, $canvas.width, $canvas.height);

  // Draw hand indicators
  for (const hand of state.hands) {
    drawHandIndicator(hand);
  }

  // Draw falling answers
  for (const ans of state.answers) {
    if (!ans.spawned || ans.caught) continue;
    drawBubble(ans);
  }

  // Draw particles
  for (const p of state.particles) {
    const alpha = p.life / p.maxLife;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fillStyle = hexToRGBA(p.color, alpha);
    ctx.fill();
  }

  // Draw fireworks & celebration
  renderFireworks();

  // Draw table progress bar
  renderTableProgress();

  // Draw unlocked badges
  renderUnlockedBadges();

  // Draw achievement popup
  renderAchievementPopup();
}

function drawHandIndicator(hand) {
  const color = hand.open ? '78, 205, 196' : '255, 200, 50';
  const radius = hand.open ? CONFIG.handRadius : CONFIG.handRadius * 0.7;

  const gradient = ctx.createRadialGradient(
    hand.x, hand.y, 0,
    hand.x, hand.y, radius
  );
  gradient.addColorStop(0, `rgba(255, 255, 255, ${hand.open ? 0.15 : 0.4})`);
  gradient.addColorStop(0.7, `rgba(${color}, ${hand.open ? 0.15 : 0.3})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);

  ctx.beginPath();
  ctx.arc(hand.x, hand.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Ring - thicker and brighter when gripping
  ctx.beginPath();
  ctx.arc(hand.x, hand.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${color}, ${hand.open ? 0.3 : 0.8})`;
  ctx.lineWidth = hand.open ? 2 : 3;
  ctx.stroke();

  // Draw fingertips as small dots
  const tipIndices = [4, 8, 12, 16, 20];
  for (const idx of tipIndices) {
    const lm = hand.landmarks[idx];
    const fx = (1 - lm.x) * $canvas.width;
    const fy = lm.y * $canvas.height;
    ctx.beginPath();
    ctx.arc(fx, fy, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(78, 205, 196, 0.6)';
    ctx.fill();
  }
}

function drawBubble(ans) {
  const { x, y, radius, color, value, opacity, scale } = ans;
  const r = radius * scale;

  ctx.save();
  ctx.globalAlpha = opacity;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 15;
  ctx.shadowOffsetY = 4;

  // Bubble background
  const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  gradient.addColorStop(0, lightenColor(color, 30));
  gradient.addColorStop(1, color);

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Highlight
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();

  // Text
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.round(r * 0.8)}px 'Fredoka One', cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  ctx.fillText(value, x, y + 2);

  ctx.restore();
}

// ============================================================
// Game Loop
// ============================================================

function update(timestamp) {
  if (!state.gameActive) return;

  // Spawn answers with stagger
  if (state.problem && state.answersSpawned < state.answers.length) {
    if (!state.lastSpawnTime || timestamp - state.lastSpawnTime > CONFIG.spawnDelay) {
      state.answers[state.answersSpawned].spawned = true;
      state.answersSpawned++;
      state.lastSpawnTime = timestamp;
    }
  }

  // Update answer positions
  for (const ans of state.answers) {
    if (!ans.spawned || ans.caught) continue;
    ans.y += ans.speed;

    // If falls off screen, just remove it
    if (ans.y > $canvas.height + ans.radius * 2) {
      // If the correct answer fell off, mark as missed and increase difficulty
      if (ans.correct && !state.missedThisRound) {
        state.missedThisRound = true;
        adjustDifficulty(state.problem.a, state.problem.b, 2);
      }
      ans.caught = true;
    }
  }

  // If all answers are gone and we haven't caught the right one, spawn a new wave
  if (!state.waitingForNext && state.answers.length > 0 &&
      state.answers.every(a => a.caught || !a.spawned) &&
      state.answersSpawned >= state.answers.length) {
    generateAnswers();
    state.answersSpawned = 0;
    state.lastSpawnTime = 0;
  }

  // Check collisions
  checkCollisions();

  // Update particles, fireworks & achievements
  updateParticles();
  updateFireworks();
  updateAchievementPopup();

  // Render
  render();

  requestAnimationFrame(update);
}

// ============================================================
// Canvas Sizing
// ============================================================

function resizeCanvas() {
  $canvas.width = window.innerWidth;
  $canvas.height = window.innerHeight;
}

// ============================================================
// Mode Toggle
// ============================================================

function updateModeButton() {
  $modeBtn.textContent = state.mode === 'multiply' ? '\u00D7' : '\u00F7';
}

$modeBtn.addEventListener('click', () => {
  state.mode = state.mode === 'multiply' ? 'divide' : 'multiply';
  updateModeButton();
  if (state.gameActive && !state.waitingForNext) {
    generateProblem();
  }
});

// ============================================================
// Start Game
// ============================================================

$startBtn.addEventListener('click', async () => {
  $startScreen.classList.add('hidden');
  $loading.classList.remove('hidden');

  try {
    await initCamera();
    $loading.classList.add('hidden');
    $ui.classList.remove('hidden');
    state.gameActive = true;
    resizeCanvas();
    updateModeButton();
    generateProblem();
    requestAnimationFrame(update);
  } catch (err) {
    console.error('Camera error:', err);
    $loading.querySelector('p').textContent = 'Kunde inte starta kameran. Tillat kameraatkomst och ladda om sidan.';
    $loading.querySelector('.loader').style.display = 'none';
  }
});

// ============================================================
// Init
// ============================================================

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
initTableSelector();
preloadAchievementImages();

// ============================================================
// Utility Functions
// ============================================================

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lightenColor(hex, percent) {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + percent);
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + percent);
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + percent);
  return `rgb(${r},${g},${b})`;
}
