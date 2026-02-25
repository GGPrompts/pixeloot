import { Graphics } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';
import { spawnRusher, spawnSwarm } from '../../entities/Enemy';
import { spawnBossTelegraph } from '../../entities/BossTelegraph';
import { shake } from './CameraSystem';
import { hasModifier } from '../../core/MapDevice';

const bosses = world.with('boss', 'enemy', 'position', 'velocity', 'speed', 'health', 'sprite');
const players = world.with('player', 'position');

// ── Phase thresholds (% of max HP) ──────────────────────────────────
const PHASE2_THRESHOLD = 0.6;
const PHASE3_THRESHOLD = 0.3;

// ── Phase 1 timers ──────────────────────────────────────────────────
const P1_BURST_INTERVAL = 3;
const P1_CHARGE_INTERVAL = 6;

// ── Phase 2 timers ──────────────────────────────────────────────────
const P2_BURST_INTERVAL = 2;
const P2_CHARGE_INTERVAL = 4;
const P2_SPAWN_INTERVAL = 10;

// ── Phase 3 timers ──────────────────────────────────────────────────
const P3_BURST_INTERVAL = 1;
const P3_CHARGE_INTERVAL = 2;

// ── Charge dash ─────────────────────────────────────────────────────
const CHARGE_SPEED = 200;
const CHARGE_DURATION = 0.5;

// ── Boss projectile settings ────────────────────────────────────────
const BOSS_PROJ_SPEED = 250;
const BOSS_PROJ_DAMAGE = 15;
const BOSS_PROJ_RADIUS = 5;
const BOSS_PROJ_LIFETIME = 3;
const BOSS_PROJ_COLOR = 0xff4400;

// ── Telegraph settings ──────────────────────────────────────────────
const CHARGE_TELEGRAPH_DURATION = 0.6; // seconds warning before charge
const CHARGE_TELEGRAPH_RADIUS = 36;

// Per-boss state stored outside ECS to avoid polluting Entity
interface BossState {
  burstTimer: number;
  chargeTimer: number;
  spawnTimer: number;
  charging: boolean;
  chargeDuration: number;
  chargeDir: { x: number; y: number };
  phase2Entered: boolean;
  pulseTime: number;
  telegraphing: boolean; // true while showing charge telegraph
}

const bossStates = new WeakMap<object, BossState>();

function getState(boss: (typeof bosses.entities)[number]): BossState {
  let s = bossStates.get(boss);
  if (!s) {
    s = {
      burstTimer: P1_BURST_INTERVAL,
      chargeTimer: P1_CHARGE_INTERVAL,
      spawnTimer: P2_SPAWN_INTERVAL,
      charging: false,
      chargeDuration: 0,
      chargeDir: { x: 0, y: 0 },
      phase2Entered: false,
      pulseTime: 0,
      telegraphing: false,
    };
    bossStates.set(boss, s);
  }
  return s;
}

/**
 * Fire a boss projectile toward target. Larger and red/orange colored.
 */
function fireBossProjectile(fromX: number, fromY: number, targetX: number, targetY: number): void {
  const dx = targetX - fromX;
  const dy = targetY - fromY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = len > 0 ? dx / len : 1;
  const ny = len > 0 ? dy / len : 0;

  const sprite = new Graphics();
  sprite.circle(0, 0, BOSS_PROJ_RADIUS).fill({ color: BOSS_PROJ_COLOR, alpha: 0.9 });
  sprite.position.set(fromX, fromY);
  sprite.visible = true;
  game.entityLayer.addChild(sprite);

  world.add({
    position: { x: fromX, y: fromY },
    velocity: { x: nx * BOSS_PROJ_SPEED, y: ny * BOSS_PROJ_SPEED },
    damage: BOSS_PROJ_DAMAGE,
    enemyProjectile: true as const,
    sprite,
    lifetime: BOSS_PROJ_LIFETIME,
  });
}

/**
 * Fire a burst of projectiles in a spread toward the player.
 */
function fireBurst(bossX: number, bossY: number, targetX: number, targetY: number, count: number): void {
  const baseAngle = Math.atan2(targetY - bossY, targetX - bossX);
  const spreadAngle = Math.PI / 8; // ~22.5 degrees total spread

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spreadAngle;
    const angle = baseAngle + offset;
    const dist = 200; // target distance for direction calculation
    const tx = bossX + Math.cos(angle) * dist;
    const ty = bossY + Math.sin(angle) * dist;
    fireBossProjectile(bossX, bossY, tx, ty);
  }
}

/**
 * Spawn adds around the boss position.
 */
function spawnAddsAroundBoss(bossX: number, bossY: number, level: number, type: 'swarm' | 'rusher', count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const dist = 60 + Math.random() * 40;
    const x = bossX + Math.cos(angle) * dist;
    const y = bossY + Math.sin(angle) * dist;
    if (type === 'swarm') {
      spawnSwarm(x, y, level);
    } else {
      spawnRusher(x, y, level);
    }
  }
}

/**
 * Boss AI system. Call from fixedUpdate each tick.
 */
export function bossAISystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  for (const boss of bosses) {
    if (boss.dead) continue;

    const state = getState(boss);
    const hpRatio = boss.health.current / boss.health.max;
    const bossLevel = boss.level ?? 1;

    // ── Phase transitions ─────────────────────────────────────────
    // Empowered Boss modifier: 5 phases (0.8, 0.6, 0.4, 0.2) instead of 3 (0.6, 0.3)
    const empowered = hasModifier('boss_phases');
    const phaseThresholds = empowered
      ? [0.8, 0.6, 0.4, 0.2]  // 5 phases total (1 + 4 transitions)
      : [PHASE2_THRESHOLD, PHASE3_THRESHOLD]; // 3 phases total (1 + 2 transitions)
    const maxPhase = phaseThresholds.length + 1;

    let currentPhase = boss.bossPhase ?? 1;

    // Walk thresholds from highest phase to lowest to find correct current phase
    for (let i = phaseThresholds.length - 1; i >= 0; i--) {
      const targetPhase = i + 2; // threshold[0] -> phase 2, threshold[1] -> phase 3, etc.
      if (hpRatio <= phaseThresholds[i] && currentPhase < targetPhase) {
        currentPhase = targetPhase;
        boss.bossPhase = targetPhase;

        // Escalating speed boost each phase
        const speedBoost = empowered ? 60 + (targetPhase - 2) * 15 : (targetPhase >= 3 ? 100 : 60);
        boss.speed = speedBoost;
        if (boss.baseSpeed !== undefined) boss.baseSpeed = speedBoost;

        // Spawn adds on phase 2 entry (or equivalent early phases in empowered)
        if (!state.phase2Entered && targetPhase >= 2) {
          state.phase2Entered = true;
          spawnAddsAroundBoss(boss.position.x, boss.position.y, bossLevel, 'swarm', 4);
        }

        // Screen shake scales with phase
        shake(0.3 + targetPhase * 0.1, 4 + targetPhase * 2);
        break; // Only transition once per tick
      }
    }

    // ── Enrage visual: red tint + pulse in final phase ─────────────
    if (currentPhase >= maxPhase) {
      state.pulseTime += dt;
      const pulse = 0.7 + 0.3 * Math.sin(state.pulseTime * 8);
      boss.sprite.alpha = pulse;
      boss.sprite.tint = 0xff3333;
    }

    // ── Get intervals for current phase ───────────────────────────
    // Smoothly scale attack speed with phase: higher phase = faster attacks
    let burstInterval: number;
    let chargeInterval: number;
    let burstCount: number;

    if (currentPhase >= maxPhase) {
      // Final phase (enrage): fastest attacks
      burstInterval = P3_BURST_INTERVAL;
      chargeInterval = P3_CHARGE_INTERVAL;
      burstCount = 5;
    } else if (currentPhase >= 2) {
      // Intermediate phases: lerp between P1 and P3 timers
      const progress = (currentPhase - 1) / (maxPhase - 1); // 0..1
      burstInterval = P1_BURST_INTERVAL + (P2_BURST_INTERVAL - P1_BURST_INTERVAL) * progress;
      chargeInterval = P1_CHARGE_INTERVAL + (P2_CHARGE_INTERVAL - P1_CHARGE_INTERVAL) * progress;
      burstCount = 3 + Math.floor(progress * 2); // 3..5
    } else {
      burstInterval = P1_BURST_INTERVAL;
      chargeInterval = P1_CHARGE_INTERVAL;
      burstCount = 3;
    }

    // ── Charge dash handling ──────────────────────────────────────
    if (state.charging) {
      state.chargeDuration -= dt;
      boss.velocity.x = state.chargeDir.x * CHARGE_SPEED;
      boss.velocity.y = state.chargeDir.y * CHARGE_SPEED;

      if (state.chargeDuration <= 0) {
        state.charging = false;
      }
      // Skip normal movement while charging
      continue;
    }

    // Skip normal AI while telegraph is playing
    if (state.telegraphing) continue;

    // ── Timers ────────────────────────────────────────────────────
    state.burstTimer -= dt;
    state.chargeTimer -= dt;

    // Burst fire
    if (state.burstTimer <= 0) {
      state.burstTimer = burstInterval;
      fireBurst(boss.position.x, boss.position.y, player.position.x, player.position.y, burstCount);
    }

    // Charge dash - now with telegraph warning
    if (state.chargeTimer <= 0) {
      state.chargeTimer = chargeInterval;
      const dx = player.position.x - boss.position.x;
      const dy = player.position.y - boss.position.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        // Show telegraph at player's current position, then charge
        state.telegraphing = true;
        const targetX = player.position.x;
        const targetY = player.position.y;
        const dirX = dx / len;
        const dirY = dy / len;

        spawnBossTelegraph(targetX, targetY, CHARGE_TELEGRAPH_RADIUS, CHARGE_TELEGRAPH_DURATION)
          .then(() => {
            state.telegraphing = false;
            state.charging = true;
            state.chargeDuration = CHARGE_DURATION;
            state.chargeDir = { x: dirX, y: dirY };
          });
      }
    }

    // Phase 2+: periodic rusher spawns
    if (currentPhase >= 2) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = P2_SPAWN_INTERVAL;
        spawnAddsAroundBoss(boss.position.x, boss.position.y, bossLevel, 'rusher', 2);
      }
    }

    // ── Normal chase movement ─────────────────────────────────────
    const dx = player.position.x - boss.position.x;
    const dy = player.position.y - boss.position.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
      boss.velocity.x = (dx / len) * boss.speed;
      boss.velocity.y = (dy / len) * boss.speed;
    }

    // Rotate sprite to face movement
    if (boss.sprite) {
      boss.sprite.rotation = Math.atan2(boss.velocity.y, boss.velocity.x);
    }
  }
}
