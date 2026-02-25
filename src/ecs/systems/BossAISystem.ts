import { Graphics } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';
import {
  spawnRusher, spawnSwarm, spawnTank, spawnSniper, spawnFlanker,
  spawnSplitter, spawnShielder,
} from '../../entities/Enemy';
import { spawnBossTelegraph, type TelegraphShape } from '../../entities/BossTelegraph';
import { shake } from './CameraSystem';
import { hasModifier } from '../../core/MapDevice';
import { musicPlayer } from '../../audio/MusicPlayer';
import { getBossDesign, GENERIC_BOSS, type BossDesign, type BossAbility, type AddWave } from '../../entities/BossRegistry';

const bosses = world.with('boss', 'enemy', 'position', 'velocity', 'speed', 'health', 'sprite');
const players = world.with('player', 'position');

// ── Boss projectile settings ────────────────────────────────────────
const BOSS_PROJ_SPEED = 250;
const BOSS_PROJ_RADIUS = 5;
const BOSS_PROJ_LIFETIME = 3;
const BOSS_PROJ_COLOR = 0xff4400;

// ── Charge dash ─────────────────────────────────────────────────────
const CHARGE_SPEED = 200;
const CHARGE_DURATION = 0.5;

// ── Enrage defaults ─────────────────────────────────────────────────
const DEFAULT_ENRAGE_SECONDS = 120;
const ENRAGE_SPEED_MULT = 1.5;
const ENRAGE_DAMAGE_MULT = 1.3;
const ENRAGE_CDR_MULT = 0.6; // abilities cooldown at 60% of normal

// ---------------------------------------------------------------------------
// Per-ability cooldown tracking
// ---------------------------------------------------------------------------

interface AbilityCooldown {
  remaining: number; // seconds until ready
}

// ---------------------------------------------------------------------------
// Per-boss runtime state (stored outside ECS to avoid polluting Entity)
// ---------------------------------------------------------------------------

interface BossState {
  // Phase management
  currentPhase: number;
  phaseAddSpawnedOnEntry: Set<number>; // phases where one-shot adds already spawned

  // Ability cooldowns keyed by ability id
  abilityCooldowns: Map<string, AbilityCooldown>;

  // Add wave timers keyed by "phase-waveIndex"
  addWaveTimers: Map<string, number>;

  // Charge/dash handling (for charge-type abilities)
  charging: boolean;
  chargeDuration: number;
  chargeDir: { x: number; y: number };

  // Telegraph lock
  telegraphing: boolean;

  // Enrage
  fightTimer: number; // total seconds since fight start
  enraged: boolean;
  enrageApplied: boolean; // stat escalation applied once
  enrageMusicTriggered: boolean;

  // Visual pulse
  pulseTime: number;
}

const bossStates = new WeakMap<object, BossState>();

function getState(boss: (typeof bosses.entities)[number]): BossState {
  let s = bossStates.get(boss);
  if (!s) {
    s = {
      currentPhase: 1,
      phaseAddSpawnedOnEntry: new Set(),
      abilityCooldowns: new Map(),
      addWaveTimers: new Map(),
      charging: false,
      chargeDuration: 0,
      chargeDir: { x: 0, y: 0 },
      telegraphing: false,
      fightTimer: 0,
      enraged: false,
      enrageApplied: false,
      enrageMusicTriggered: false,
      pulseTime: 0,
    };
    bossStates.set(boss, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Resolve the BossDesign for a given entity
// ---------------------------------------------------------------------------

function resolveDesign(boss: (typeof bosses.entities)[number]): BossDesign {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType) {
    const design = getBossDesign(bossType);
    if (design) return design;
  }
  return GENERIC_BOSS;
}

// ---------------------------------------------------------------------------
// Helper: get current phase config from design
// ---------------------------------------------------------------------------

function getCurrentPhaseConfig(design: BossDesign, phaseNum: number) {
  // Find the phase config matching the phase number, fallback to last phase
  for (let i = design.phases.length - 1; i >= 0; i--) {
    if (design.phases[i].phase <= phaseNum) {
      return design.phases[i];
    }
  }
  return design.phases[0];
}

// ---------------------------------------------------------------------------
// Projectile helpers
// ---------------------------------------------------------------------------

function fireBossProjectile(
  fromX: number, fromY: number,
  targetX: number, targetY: number,
  baseDamage: number,
): void {
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
    damage: baseDamage,
    enemyProjectile: true as const,
    sprite,
    lifetime: BOSS_PROJ_LIFETIME,
  });
}

function fireBurst(
  bossX: number, bossY: number,
  targetX: number, targetY: number,
  count: number, baseDamage: number,
): void {
  const baseAngle = Math.atan2(targetY - bossY, targetX - bossX);
  const spreadAngle = Math.PI / 8;

  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * spreadAngle;
    const angle = baseAngle + offset;
    const dist = 200;
    const tx = bossX + Math.cos(angle) * dist;
    const ty = bossY + Math.sin(angle) * dist;
    fireBossProjectile(bossX, bossY, tx, ty, baseDamage);
  }
}

// ---------------------------------------------------------------------------
// Add wave spawner
// ---------------------------------------------------------------------------

type EnemySpawnType = 'rusher' | 'swarm' | 'tank' | 'sniper' | 'flanker' | 'splitter' | 'shielder';

const ENEMY_SPAWNERS: Record<EnemySpawnType, (x: number, y: number, level: number) => void> = {
  rusher: spawnRusher,
  swarm: spawnSwarm,
  tank: spawnTank,
  sniper: spawnSniper,
  flanker: spawnFlanker,
  splitter: spawnSplitter,
  shielder: spawnShielder,
};

function spawnAdds(
  bossX: number, bossY: number,
  level: number, wave: AddWave,
): void {
  let totalCount = 0;
  const entries: { type: EnemySpawnType; count: number }[] = [];
  for (const e of wave.enemies) {
    entries.push({ type: e.type as EnemySpawnType, count: e.count });
    totalCount += e.count;
  }
  if (totalCount === 0) return;

  let idx = 0;
  for (const entry of entries) {
    const spawner = ENEMY_SPAWNERS[entry.type];
    if (!spawner) continue;
    for (let i = 0; i < entry.count; i++) {
      const angle = (Math.PI * 2 / totalCount) * idx + Math.random() * 0.5;
      const dist = 60 + Math.random() * 40;
      const x = bossX + Math.cos(angle) * dist;
      const y = bossY + Math.sin(angle) * dist;
      spawner(x, y, level);
      idx++;
    }
  }
}

// ---------------------------------------------------------------------------
// Ability execution
// ---------------------------------------------------------------------------

function executeAbility(
  ability: BossAbility,
  boss: (typeof bosses.entities)[number],
  state: BossState,
  playerX: number, playerY: number,
  baseDamage: number,
): void {
  const bx = boss.position.x;
  const by = boss.position.y;
  const dmg = baseDamage * ability.damageMultiplier;
  const angle = Math.atan2(playerY - by, playerX - bx);
  const telegraphRadius = 36 + dmg * 0.3; // scale telegraph size loosely with damage

  // Determine if this ability uses a telegraph
  const telegraph = ability.telegraph as TelegraphShape;
  const hasDelay = ability.telegraphDuration > 0 && telegraph !== 'none';

  if (isChargeAbility(ability)) {
    // Charge-type: show telegraph then dash
    const dx = playerX - bx;
    const dy = playerY - by;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) {
      state.telegraphing = true;
      const dirX = dx / len;
      const dirY = dy / len;

      spawnBossTelegraph(
        playerX, playerY, telegraphRadius,
        ability.telegraphDuration || 0.6, telegraph, angle,
      ).then(() => {
        state.telegraphing = false;
        state.charging = true;
        state.chargeDuration = CHARGE_DURATION;
        state.chargeDir = { x: dirX, y: dirY };
      });
    }
  } else if (hasDelay) {
    // Telegraphed ranged attack: show telegraph, then fire on resolve
    state.telegraphing = true;
    spawnBossTelegraph(
      playerX, playerY, telegraphRadius,
      ability.telegraphDuration, telegraph, angle,
    ).then(() => {
      state.telegraphing = false;
      fireAbilityProjectiles(ability, bx, by, playerX, playerY, dmg);
    });
  } else {
    // Instant ability: fire immediately
    fireAbilityProjectiles(ability, bx, by, playerX, playerY, dmg);
  }
}

/** Check if an ability is a charge/dash type by its ID. */
function isChargeAbility(ability: BossAbility): boolean {
  const id = ability.id.toLowerCase();
  return id.includes('charge') || id.includes('dash') || id.includes('blink_strike')
    || id.includes('static_dash') || id.includes('mirror_dash');
}

/** Fire projectiles for a non-charge ability. */
function fireAbilityProjectiles(
  ability: BossAbility,
  bx: number, by: number,
  px: number, py: number,
  damage: number,
): void {
  const id = ability.id.toLowerCase();

  // Determine projectile count heuristically from ability description/id
  let count = 3;
  if (id.includes('burst') || id.includes('volley') || id.includes('shard')) count = 4;
  if (id.includes('barrage') || id.includes('spray') || id.includes('storm')) count = 6;
  if (id.includes('nova') || id.includes('spiral')) count = 8;
  if (id.includes('bolt') && !id.includes('barrage')) count = 2;
  if (id.includes('breath') || id.includes('beam')) count = 5;

  // Abilities with damageMultiplier 0 are utility (anchor placement, etc.) -- skip projectiles
  if (damage <= 0) return;

  fireBurst(bx, by, px, py, count, damage);
}

// ---------------------------------------------------------------------------
// Main Boss AI System
// ---------------------------------------------------------------------------

export function bossAISystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  for (const boss of bosses) {
    if (boss.dead) continue;

    const state = getState(boss);
    const design = resolveDesign(boss);
    const hpRatio = boss.health.current / boss.health.max;
    const bossLevel = boss.level ?? 1;
    const baseDamage = boss.damage ?? 15;

    // ── Fight timer and enrage ───────────────────────────────────────
    state.fightTimer += dt;

    const enrageTimerSeconds = design.enrage.timerSeconds ?? DEFAULT_ENRAGE_SECONDS;
    if (!state.enraged && state.fightTimer >= enrageTimerSeconds) {
      state.enraged = true;
    }

    // Apply enrage stat escalation once
    if (state.enraged && !state.enrageApplied) {
      state.enrageApplied = true;
      boss.speed *= ENRAGE_SPEED_MULT;
      if (boss.baseSpeed !== undefined) boss.baseSpeed *= ENRAGE_SPEED_MULT;
      if (boss.damage !== undefined) boss.damage = Math.round(boss.damage * ENRAGE_DAMAGE_MULT);

      if (!state.enrageMusicTriggered) {
        state.enrageMusicTriggered = true;
        musicPlayer.crossfade('enrage', 600);
      }
    }

    // ── Phase transitions ────────────────────────────────────────────
    // Empowered Boss modifier: add extra phases (insert thresholds between existing ones)
    const empowered = hasModifier('boss_phases');
    let phaseThresholds = design.phases
      .filter(p => p.phase > 1)
      .map(p => ({ phase: p.phase, threshold: p.hpThreshold }));

    if (empowered && phaseThresholds.length > 0) {
      // Insert extra thresholds between existing phases for empowered modifier
      const extra: { phase: number; threshold: number }[] = [];
      for (let i = 0; i < phaseThresholds.length - 1; i++) {
        const mid = (phaseThresholds[i].threshold + phaseThresholds[i + 1].threshold) / 2;
        extra.push({ phase: phaseThresholds[i].phase + 0.5, threshold: mid });
      }
      phaseThresholds = [...phaseThresholds, ...extra].sort((a, b) => b.threshold - a.threshold);
    }

    let currentPhase = state.currentPhase;

    // Walk thresholds to find correct current phase
    for (const pt of phaseThresholds) {
      const targetPhase = Math.ceil(pt.phase); // round half-phases up to their parent
      if (hpRatio <= pt.threshold && currentPhase < targetPhase) {
        currentPhase = targetPhase;
        state.currentPhase = targetPhase;
        boss.bossPhase = targetPhase;

        // Speed boost per phase
        const phaseConfig = getCurrentPhaseConfig(design, targetPhase);
        const speedBoost = design.baseSpeed + (targetPhase - 1) * 15;
        boss.speed = speedBoost;
        if (boss.baseSpeed !== undefined) boss.baseSpeed = speedBoost;

        // Spawn one-shot adds on phase entry
        if (!state.phaseAddSpawnedOnEntry.has(targetPhase)) {
          state.phaseAddSpawnedOnEntry.add(targetPhase);
          for (const wave of phaseConfig.adds) {
            if (wave.interval === 0) {
              spawnAdds(boss.position.x, boss.position.y, bossLevel, wave);
            }
          }
        }

        // Screen shake scales with phase
        shake(0.3 + targetPhase * 0.1, 4 + targetPhase * 2);
        break; // Only transition once per tick
      }
    }

    // ── Enrage visual: red tint + pulse in final phase ───────────────
    const maxPhase = design.phaseCount;
    if (state.enraged || currentPhase >= maxPhase) {
      state.pulseTime += dt;
      const pulse = 0.7 + 0.3 * Math.sin(state.pulseTime * 8);
      boss.sprite.alpha = pulse;
      boss.sprite.tint = 0xff3333;

      if (!state.enrageMusicTriggered) {
        state.enrageMusicTriggered = true;
        musicPlayer.crossfade('enrage', 600);
      }
    }

    // ── Charge dash handling ─────────────────────────────────────────
    if (state.charging) {
      state.chargeDuration -= dt;
      boss.velocity.x = state.chargeDir.x * CHARGE_SPEED;
      boss.velocity.y = state.chargeDir.y * CHARGE_SPEED;

      if (state.chargeDuration <= 0) {
        state.charging = false;
      }
      continue; // Skip normal movement while charging
    }

    // Skip normal AI while telegraph is playing
    if (state.telegraphing) continue;

    // ── Get current phase config ─────────────────────────────────────
    const phaseConfig = getCurrentPhaseConfig(design, currentPhase);

    // ── Ability cooldowns ────────────────────────────────────────────
    for (const ability of phaseConfig.abilities) {
      let cd = state.abilityCooldowns.get(ability.id);
      if (!cd) {
        cd = { remaining: ability.cooldown * 0.5 }; // start at half cooldown so first use is quick
        state.abilityCooldowns.set(ability.id, cd);
      }

      const cdrMult = state.enraged ? ENRAGE_CDR_MULT : 1;
      cd.remaining -= dt;

      if (cd.remaining <= 0) {
        cd.remaining = ability.cooldown * cdrMult;
        executeAbility(ability, boss, state, player.position.x, player.position.y, baseDamage);

        // Only execute one ability per tick to avoid telegraph overlap
        break;
      }
    }

    // ── Periodic add wave spawns ─────────────────────────────────────
    for (let wIdx = 0; wIdx < phaseConfig.adds.length; wIdx++) {
      const wave = phaseConfig.adds[wIdx];
      if (wave.interval <= 0) continue; // one-shot already handled on phase entry

      const key = `${currentPhase}-${wIdx}`;
      const timer = (state.addWaveTimers.get(key) ?? wave.interval) - dt;
      if (timer <= 0) {
        spawnAdds(boss.position.x, boss.position.y, bossLevel, wave);
        state.addWaveTimers.set(key, wave.interval);
      } else {
        state.addWaveTimers.set(key, timer);
      }
    }

    // ── Normal chase movement ────────────────────────────────────────
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
