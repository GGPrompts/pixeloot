/**
 * BossSignatureSystem -- per-frame custom mechanics for boss encounters.
 *
 * Each boss's "signature mechanic" (Grid Lock, Gravitational Pull, Hive Network)
 * runs every logic tick via this system.  The BossAISystem handles ability
 * cooldowns and projectile-based attacks; this system handles the persistent,
 * per-frame effects that define each boss fight.
 */

import { Graphics } from 'pixi.js';
import { world } from '../world';
import { game } from '../../Game';

const bosses = world.with('boss', 'enemy', 'position', 'velocity', 'health', 'sprite');
const players = world.with('player', 'position', 'velocity', 'speed');
const enemies = world.with('enemy', 'position', 'health');

// ─────────────────────────────────────────────────────────────────────────────
// Shared state maps (keyed by boss entity reference)
// ─────────────────────────────────────────────────────────────────────────────

interface GridLockState {
  activeLines: GridLine[];
  timer: number;           // cooldown until next grid lock activation
  phase: number;
  visualContainer: Graphics | null;
}

interface GridLine {
  axis: 'h' | 'v';        // horizontal or vertical
  offset: number;          // world coordinate of the line centre
  remaining: number;       // seconds left active
  warned: boolean;         // telegraph drawn
  warnTime: number;        // seconds of warning before damage
  damagePerSec: number;
}

interface GravityState {
  pullStrength: number;    // 0-1 scale
  phase: number;
  surgeTimer: number;      // remaining surge duration (0 = not surging)
  surgeRemaining: number;  // cooldown to next surge
  visualContainer: Graphics | null;
}

interface HiveState {
  auraRadius: number;
  speedBuff: number;       // multiplier for adds in range
  damageBuff: number;      // multiplier for adds in range
  healPercent: number;     // % of dead add HP healed to boss
  phase: number;
  auraVisual: Graphics | null;
  buffedEntities: WeakSet<object>;
}

interface HeatCycleState {
  heatGauge: number;         // 0-1 heat accumulation
  heatRate: number;          // gauge fill per second (scales with phase)
  flameRings: FlameRing[];   // active expanding fire rings
  ventTimer: number;         // cooldown to next auto-vent
  venting: boolean;          // boss is channelling vent
  ventDuration: number;      // remaining vent channel time
  phase: number;
  visualContainer: Graphics | null;
}

interface FlameRing {
  cx: number;
  cy: number;
  radius: number;            // current expanding radius
  maxRadius: number;
  speed: number;             // px/s expansion
  damagePerSec: number;
  remaining: number;
}

interface DarknessState {
  lightRadius: number;       // player visibility radius in px
  baseLightRadius: number;   // starting light radius
  darknessZones: DarknessZone[];
  lightPickups: LightPickup[];
  pickupTimer: number;       // cooldown to next light pickup spawn
  shrinkTimer: number;       // passive shrink accumulator
  phase: number;
  visualContainer: Graphics | null;
  overlayContainer: Graphics | null;
}

interface DarknessZone {
  x: number;
  y: number;
  radius: number;
  remaining: number;
}

interface LightPickup {
  x: number;
  y: number;
  sprite: Graphics | null;
  collected: boolean;
}

type PrismElement = 'fire' | 'ice' | 'lightning';

interface PrismState {
  currentElement: PrismElement;
  elementTimer: number;       // seconds until next shift
  shiftInterval: number;      // seconds per element
  shiftCount: number;         // total shifts so far (for enrage damage ramp)
  phase: number;
  overloaded: boolean;        // phase 4 all-element state
  visualContainer: Graphics | null;
  auraContainer: Graphics | null;
}

const gridStates = new WeakMap<object, GridLockState>();
const gravityStates = new WeakMap<object, GravityState>();
const hiveStates = new WeakMap<object, HiveState>();
const heatStates = new WeakMap<object, HeatCycleState>();
const darknessStates = new WeakMap<object, DarknessState>();
const prismStates = new WeakMap<object, PrismState>();

// ─────────────────────────────────────────────────────────────────────────────
// Grid Lock -- Sentinel Prime
// ─────────────────────────────────────────────────────────────────────────────

const GRID_LINE_WIDTH = 32;            // width of the electrified strip (1 tile)
const GRID_LINE_WARN_COLOR = 0x00ffff; // cyan warning
const GRID_LINE_ACTIVE_COLOR = 0x00ffff;
const GRID_LINE_DURATION = 2.0;        // seconds lines stay active
const GRID_LINE_WARN_DURATION = 1.0;   // telegraph before damage
const GRID_LINE_DPS = 0.6;            // fraction of boss damage per second

function getGridState(boss: object): GridLockState {
  let s = gridStates.get(boss);
  if (!s) {
    s = {
      activeLines: [],
      timer: 3.0,        // first activation after 3s
      phase: 1,
      visualContainer: null,
    };
    gridStates.set(boss, s);
  }
  return s;
}

function activateGridLock(
  state: GridLockState,
  bossX: number, bossY: number,
  baseDamage: number, phase: number,
): void {
  state.phase = phase;

  // Number of lines scales with phase
  const lineCount = phase === 1 ? 3 : phase === 2 ? 5 : 7;
  const dmgPerSec = baseDamage * GRID_LINE_DPS;

  // Arena region around the boss
  const extent = 300;
  const minX = bossX - extent;
  const maxX = bossX + extent;
  const minY = bossY - extent;
  const maxY = bossY + extent;

  // Pick random offsets, alternating h/v, ensuring at least one gap
  const lines: GridLine[] = [];
  for (let i = 0; i < lineCount; i++) {
    const axis: 'h' | 'v' = i % 2 === 0 ? 'h' : 'v';
    const range = axis === 'h' ? [minY, maxY] : [minX, maxX];
    const offset = range[0] + Math.random() * (range[1] - range[0]);
    lines.push({
      axis,
      offset,
      remaining: GRID_LINE_DURATION + GRID_LINE_WARN_DURATION,
      warned: false,
      warnTime: GRID_LINE_WARN_DURATION,
      damagePerSec: dmgPerSec,
    });
  }

  // Phase 3: second wave after 1s delay (append with extra warn time)
  if (phase >= 3) {
    const extraCount = 4;
    for (let i = 0; i < extraCount; i++) {
      const axis: 'h' | 'v' = i % 2 === 0 ? 'v' : 'h';
      const range = axis === 'h' ? [minY, maxY] : [minX, maxX];
      const offset = range[0] + Math.random() * (range[1] - range[0]);
      lines.push({
        axis,
        offset,
        remaining: GRID_LINE_DURATION + GRID_LINE_WARN_DURATION + 1.0,
        warned: false,
        warnTime: GRID_LINE_WARN_DURATION + 1.0,
        damagePerSec: dmgPerSec,
      });
    }
  }

  state.activeLines.push(...lines);
}

function updateGridLock(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'sentinel_prime') return;

  const state = getGridState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;

  // Cooldown management for periodic activation
  const cooldowns = [8, 6, 5];
  const cd = cooldowns[Math.min(phase - 1, 2)];
  state.timer -= dt;
  if (state.timer <= 0) {
    state.timer = cd;
    activateGridLock(state, boss.position.x, boss.position.y, baseDamage, phase);
  }

  // Update active lines
  for (let i = state.activeLines.length - 1; i >= 0; i--) {
    const line = state.activeLines[i];
    line.remaining -= dt;
    line.warnTime -= dt;

    if (line.remaining <= 0) {
      state.activeLines.splice(i, 1);
      continue;
    }

    // Damage check (only after warning period)
    if (line.warnTime <= 0) {
      const lineHalf = GRID_LINE_WIDTH / 2;
      let inLine = false;
      if (line.axis === 'h') {
        inLine = Math.abs(playerY - line.offset) < lineHalf;
      } else {
        inLine = Math.abs(playerX - line.offset) < lineHalf;
      }

      if (inLine) {
        // Deal damage per second (scaled by dt)
        const playerEnt = players.entities[0];
        if (playerEnt?.health) {
          playerEnt.health.current -= line.damagePerSec * dt;
        }
      }
    }
  }

  // Draw visuals
  if (!state.visualContainer) {
    state.visualContainer = new Graphics();
    game.effectLayer.addChild(state.visualContainer);
  }
  const g = state.visualContainer;
  g.clear();

  const extent = 600; // draw length
  for (const line of state.activeLines) {
    const isWarning = line.warnTime > 0;
    const alpha = isWarning
      ? 0.15 + 0.1 * Math.sin(line.warnTime * 12)
      : 0.25 + 0.15 * Math.sin(line.remaining * 10);
    const color = isWarning ? GRID_LINE_WARN_COLOR : GRID_LINE_ACTIVE_COLOR;

    if (line.axis === 'h') {
      g.rect(
        boss.position.x - extent,
        line.offset - GRID_LINE_WIDTH / 2,
        extent * 2,
        GRID_LINE_WIDTH,
      ).fill({ color, alpha });
    } else {
      g.rect(
        line.offset - GRID_LINE_WIDTH / 2,
        boss.position.y - extent,
        GRID_LINE_WIDTH,
        extent * 2,
      ).fill({ color, alpha });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Gravitational Pull -- Nullpoint
// ─────────────────────────────────────────────────────────────────────────────

const PULL_BASE_STRENGTH = 45;   // px/s pull at strength=1.0
const CONTACT_DPS_MULT = 0.8;   // fraction of boss damage as DPS on contact
const CONTACT_RADIUS = 48;      // boss contact zone

function getGravityState(boss: object): GravityState {
  let s = gravityStates.get(boss);
  if (!s) {
    s = {
      pullStrength: 0.15,
      phase: 1,
      surgeTimer: 0,
      surgeRemaining: 10,
      visualContainer: null,
    };
    gravityStates.set(boss, s);
  }
  return s;
}

function updateGravityPull(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'nullpoint') return;

  const state = getGravityState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;

  // Update pull strength per phase
  const strengths = [0.15, 0.25, 0.5];
  state.pullStrength = strengths[Math.min(phase - 1, 2)];
  state.phase = phase;

  // Nullpoint is stationary
  boss.velocity.x = 0;
  boss.velocity.y = 0;

  // Gravity surge mechanic (phase 2+)
  let currentPull = state.pullStrength;
  if (phase >= 2) {
    state.surgeRemaining -= dt;
    if (state.surgeRemaining <= 0 && state.surgeTimer <= 0) {
      state.surgeTimer = 2.0; // 2s of triple gravity
      state.surgeRemaining = 10;
    }
    if (state.surgeTimer > 0) {
      state.surgeTimer -= dt;
      currentPull *= 3;
    }
  }

  // Apply pull force to player
  const player = players.entities[0];
  if (player?.velocity) {
    const dx = boss.position.x - playerX;
    const dy = boss.position.y - playerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;
      const pullForce = PULL_BASE_STRENGTH * currentPull;

      player.velocity.x += nx * pullForce * dt;
      player.velocity.y += ny * pullForce * dt;

      // Movement direction modifier (toward boss = faster, away = slower)
      // Applied as a small velocity adjustment each frame
      const playerSpeed = player.speed ?? 100;
      const moveX = player.velocity.x;
      const moveY = player.velocity.y;
      const moveDot = (moveX * nx + moveY * ny); // positive = toward boss
      if (moveDot > 0) {
        // Moving toward boss: slight speed boost
        player.velocity.x += nx * playerSpeed * 0.05 * dt;
        player.velocity.y += ny * playerSpeed * 0.05 * dt;
      } else {
        // Moving away: slight resistance
        player.velocity.x += nx * playerSpeed * 0.03 * dt;
        player.velocity.y += ny * playerSpeed * 0.03 * dt;
      }
    }

    // Contact damage
    if (dist < CONTACT_RADIUS) {
      if (player.health) {
        player.health.current -= baseDamage * CONTACT_DPS_MULT * dt;
      }
    }
  }

  // Draw gravity visual (orbital rings around boss)
  if (!state.visualContainer) {
    state.visualContainer = new Graphics();
    game.effectLayer.addChild(state.visualContainer);
  }
  const g = state.visualContainer;
  g.clear();

  const bx = boss.position.x;
  const by = boss.position.y;

  // Concentric pull indicator rings
  const ringCount = 3;
  const maxRadius = 250;
  for (let i = 0; i < ringCount; i++) {
    const r = maxRadius * ((i + 1) / ringCount);
    const pulseOffset = (Date.now() / 1000 + i * 0.5) % 1;
    const alpha = 0.06 + 0.04 * Math.sin(pulseOffset * Math.PI * 2) * currentPull;
    g.circle(bx, by, r).stroke({ width: 1, color: 0x8844cc, alpha });
  }

  // Central danger zone
  const cAlpha = 0.1 + 0.08 * Math.sin(Date.now() / 200);
  g.circle(bx, by, CONTACT_RADIUS).fill({ color: 0x220033, alpha: cAlpha });

  // Surge indicator
  if (state.surgeTimer > 0) {
    const surgeAlpha = 0.2 + 0.15 * Math.sin(Date.now() / 80);
    g.circle(bx, by, maxRadius).stroke({ width: 3, color: 0xcc44ff, alpha: surgeAlpha });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hive Network / Proximity Aura -- Overmind
// ─────────────────────────────────────────────────────────────────────────────

const AURA_BASE_RADIUS = 100;
const AURA_SPEED_BUFF = 1.3;   // +30%
const AURA_DMG_BUFF = 1.2;     // +20%
const HEAL_RADIUS = 120;        // adds dying within this range heal boss
const BASE_HEAL_PERCENT = 0.05; // 5% of dead add's max HP

function getHiveState(boss: object): HiveState {
  let s = hiveStates.get(boss);
  if (!s) {
    s = {
      auraRadius: AURA_BASE_RADIUS,
      speedBuff: AURA_SPEED_BUFF,
      damageBuff: AURA_DMG_BUFF,
      healPercent: BASE_HEAL_PERCENT,
      phase: 1,
      auraVisual: null,
      buffedEntities: new WeakSet(),
    };
    hiveStates.set(boss, s);
  }
  return s;
}

function updateHiveNetwork(
  boss: (typeof bosses.entities)[number],
  dt: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'overmind') return;

  const state = getHiveState(boss);
  const phase = boss.bossPhase ?? 1;
  state.phase = phase;

  // Scale heal percent with phase
  state.healPercent = phase >= 3 ? 0.08 : BASE_HEAL_PERCENT;

  // Overmind moves slowly -- enforce low speed
  boss.speed = 30 + (phase - 1) * 5;

  const bx = boss.position.x;
  const by = boss.position.y;

  // Buff nearby adds
  for (const ent of enemies) {
    if (ent === boss) continue;
    if (ent.dead) continue;
    if ((ent as { boss?: true }).boss) continue; // don't buff other bosses

    const dx = ent.position.x - bx;
    const dy = ent.position.y - by;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < state.auraRadius) {
      // Apply buff (only once per entity)
      if (!state.buffedEntities.has(ent)) {
        state.buffedEntities.add(ent);
        if ((ent as { speed?: number }).speed !== undefined) {
          (ent as { speed: number }).speed *= state.speedBuff;
        }
        if (ent.damage !== undefined) {
          (ent as { damage: number }).damage = Math.round(ent.damage * state.damageBuff);
        }
      }
    }
  }

  // Heal from nearby add deaths: check for dead enemies near boss
  for (const ent of enemies) {
    if (ent === boss) continue;
    if (!ent.dead) continue;
    if ((ent as { boss?: true }).boss) continue;
    if ((ent as { hiveHealed?: boolean }).hiveHealed) continue;

    const dx = ent.position.x - bx;
    const dy = ent.position.y - by;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < HEAL_RADIUS && ent.health) {
      // Mark as healed so we don't double-count
      (ent as { hiveHealed?: boolean }).hiveHealed = true;
      const healAmount = ent.health.max * state.healPercent;
      boss.health.current = Math.min(boss.health.max, boss.health.current + healAmount);
    }
  }

  // Draw aura visual
  if (!state.auraVisual) {
    state.auraVisual = new Graphics();
    game.effectLayer.addChild(state.auraVisual);
  }
  const g = state.auraVisual;
  g.clear();

  // Pulsing aura circle
  const pulseT = Date.now() / 600;
  const aAlpha = 0.06 + 0.04 * Math.sin(pulseT);
  g.circle(bx, by, state.auraRadius).fill({ color: 0x44dd88, alpha: aAlpha });
  g.circle(bx, by, state.auraRadius).stroke({ width: 2, color: 0x88ff44, alpha: aAlpha + 0.1 });

  // Inner heal zone indicator
  const hAlpha = 0.04 + 0.03 * Math.sin(pulseT * 1.5);
  g.circle(bx, by, HEAL_RADIUS).stroke({ width: 1, color: 0xff4444, alpha: hAlpha + 0.08 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Heat Cycle -- Meltdown
// ─────────────────────────────────────────────────────────────────────────────

const HEAT_FILL_RATE_BASE = 1 / 30;    // base: 30s to full heat
const HEAT_IGNITE_THRESHOLD = 0.6;     // floor ignites at 60% heat
const FLAME_RING_SPEED = 80;           // px/s expansion
const FLAME_RING_MAX = 280;            // max radius of expanding fire
const FLAME_RING_DPS_MULT = 0.4;       // fraction of boss damage per second
const FLAME_RING_DURATION = 4;
const VENT_KNOCKBACK_FORCE = 250;
const VENT_CHANNEL_TIME = 2.0;

function getHeatState(boss: object): HeatCycleState {
  let s = heatStates.get(boss);
  if (!s) {
    s = {
      heatGauge: 0,
      heatRate: HEAT_FILL_RATE_BASE,
      flameRings: [],
      ventTimer: 18,
      venting: false,
      ventDuration: 0,
      phase: 1,
      visualContainer: null,
    };
    heatStates.set(boss, s);
  }
  return s;
}

function updateHeatCycle(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'meltdown') return;

  const state = getHeatState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;
  state.phase = phase;

  // Heat rate scales with phase
  const phaseRateMultipliers = [1.0, 1.5, 2.0, 2.5];
  state.heatRate = HEAT_FILL_RATE_BASE * (phaseRateMultipliers[Math.min(phase - 1, 3)] ?? 1);

  // Phase 4: Meltdown becomes stationary for total meltdown channel
  if (phase >= 4) {
    boss.velocity.x = 0;
    boss.velocity.y = 0;
  }

  // Accumulate heat
  state.heatGauge += state.heatRate * dt;

  // When heat reaches ignition threshold, spawn expanding flame rings from boss
  if (state.heatGauge >= HEAT_IGNITE_THRESHOLD) {
    // Spawn a ring from the boss
    state.flameRings.push({
      cx: boss.position.x,
      cy: boss.position.y,
      radius: 20,
      maxRadius: FLAME_RING_MAX + phase * 30,
      speed: FLAME_RING_SPEED + phase * 10,
      damagePerSec: baseDamage * FLAME_RING_DPS_MULT,
      remaining: FLAME_RING_DURATION,
    });
    // Reset heat gauge partially so rings spawn periodically
    state.heatGauge -= 0.3;
    if (state.heatGauge < 0) state.heatGauge = 0;
  }

  // Heat vent auto-timer (boss vents to reset heat)
  if (!state.venting) {
    state.ventTimer -= dt;
    if (state.ventTimer <= 0) {
      state.venting = true;
      state.ventDuration = VENT_CHANNEL_TIME;
      // Stop boss movement during vent channel
      boss.velocity.x = 0;
      boss.velocity.y = 0;
    }
  }

  // Vent channel
  if (state.venting) {
    state.ventDuration -= dt;
    boss.velocity.x = 0;
    boss.velocity.y = 0;

    if (state.ventDuration <= 0) {
      state.venting = false;
      // Reset floor heat
      state.heatGauge = 0;
      // Clear existing flame rings
      state.flameRings.length = 0;
      // Knockback the player away from boss
      const player = players.entities[0];
      if (player?.velocity) {
        const dx = playerX - boss.position.x;
        const dy = playerY - boss.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 1) {
          const force = VENT_KNOCKBACK_FORCE + phase * 40;
          player.velocity.x += (dx / dist) * force;
          player.velocity.y += (dy / dist) * force;
        }
        // Close-range vent damage
        if (dist < 100 && player.health) {
          player.health.current -= baseDamage * 1.8;
        }
      }
      // Reset vent timer (shorter in later phases)
      const ventCooldowns = [18, 15, 12, 10];
      state.ventTimer = ventCooldowns[Math.min(phase - 1, 3)];
    }
  }

  // Update flame rings
  for (let i = state.flameRings.length - 1; i >= 0; i--) {
    const ring = state.flameRings[i];
    ring.remaining -= dt;
    ring.radius += ring.speed * dt;

    if (ring.remaining <= 0 || ring.radius > ring.maxRadius) {
      state.flameRings.splice(i, 1);
      continue;
    }

    // Damage player if within the ring band (ring is a thin expanding band)
    const ringWidth = 24;
    const dx = playerX - ring.cx;
    const dy = playerY - ring.cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(dist - ring.radius) < ringWidth) {
      const player = players.entities[0];
      if (player?.health) {
        player.health.current -= ring.damagePerSec * dt;
      }
    }
  }

  // Draw visuals
  if (!state.visualContainer) {
    state.visualContainer = new Graphics();
    game.effectLayer.addChild(state.visualContainer);
  }
  const g = state.visualContainer;
  g.clear();

  const bx = boss.position.x;
  const by = boss.position.y;

  // Heat gauge indicator (circle around boss that fills with orange)
  const gaugeAlpha = 0.1 + state.heatGauge * 0.3;
  g.circle(bx, by, 60).fill({ color: 0xff4400, alpha: gaugeAlpha });

  // Flame rings
  for (const ring of state.flameRings) {
    const ringAlpha = 0.25 + 0.15 * Math.sin(ring.remaining * 6);
    g.circle(ring.cx, ring.cy, ring.radius)
      .stroke({ width: 20, color: 0xff4400, alpha: ringAlpha });
    // Inner bright edge
    g.circle(ring.cx, ring.cy, ring.radius - 8)
      .stroke({ width: 3, color: 0xffcc00, alpha: ringAlpha + 0.1 });
  }

  // Vent channel indicator
  if (state.venting) {
    const ventProgress = 1 - (state.ventDuration / VENT_CHANNEL_TIME);
    const ventAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 100);
    g.circle(bx, by, 50 + ventProgress * 200)
      .stroke({ width: 4, color: 0xffffff, alpha: ventAlpha });
    g.circle(bx, by, 30)
      .fill({ color: 0xffffff, alpha: ventAlpha * 0.5 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Encroaching Darkness -- Dread Hollow
// ─────────────────────────────────────────────────────────────────────────────

const BASE_LIGHT_RADIUS = 300;
const DARKNESS_ZONE_DURATION = 8;
const DARKNESS_ZONE_RADIUS = 80;
const LIGHT_PICKUP_RADIUS = 16;
const LIGHT_PICKUP_RESTORE = 40;        // px of light radius restored
const LIGHT_PICKUP_COLLECT_DIST = 30;
const DARKNESS_DPS = 0.03;              // fraction of max HP per second outside light
const BOSS_LIGHT_BONUS_DAMAGE = 0.25;   // 25% more damage when boss in player's light

function getDarknessState(boss: object): DarknessState {
  let s = darknessStates.get(boss);
  if (!s) {
    s = {
      lightRadius: BASE_LIGHT_RADIUS,
      baseLightRadius: BASE_LIGHT_RADIUS,
      darknessZones: [],
      lightPickups: [],
      pickupTimer: 12,
      shrinkTimer: 0,
      phase: 1,
      visualContainer: null,
      overlayContainer: null,
    };
    darknessStates.set(boss, s);
  }
  return s;
}

function updateDarkness(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'dread_hollow') return;

  const state = getDarknessState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;
  state.phase = phase;

  // Light radius shrinks per phase
  const phaseRadiusMult = [1.0, 0.75, 0.6, 0.4, 0.1];
  const targetRadius = BASE_LIGHT_RADIUS * (phaseRadiusMult[Math.min(phase - 1, 4)] ?? 0.4);
  // Smoothly approach the target
  state.lightRadius += (targetRadius - state.lightRadius) * dt * 2;

  // Passive shrink over time (enrage)
  state.shrinkTimer += dt;
  const passiveShrink = Math.floor(state.shrinkTimer / 15) * (BASE_LIGHT_RADIUS * 0.05);
  const effectiveLight = Math.max(20, state.lightRadius - passiveShrink);

  // Light pickup spawning
  state.pickupTimer -= dt;
  const pickupRate = phase >= 5 ? 6 : 12;
  if (state.pickupTimer <= 0) {
    state.pickupTimer = pickupRate;
    // Spawn a light pickup at a random offset from boss
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 150;
    const px = boss.position.x + Math.cos(angle) * dist;
    const py = boss.position.y + Math.sin(angle) * dist;
    const pickupSprite = new Graphics();
    pickupSprite.circle(0, 0, LIGHT_PICKUP_RADIUS).fill({ color: 0xffffaa, alpha: 0.8 });
    pickupSprite.circle(0, 0, LIGHT_PICKUP_RADIUS * 0.6).fill({ color: 0xffffff, alpha: 0.9 });
    pickupSprite.position.set(px, py);
    game.effectLayer.addChild(pickupSprite);
    state.lightPickups.push({ x: px, y: py, sprite: pickupSprite, collected: false });
  }

  // Check light pickup collection
  for (const pickup of state.lightPickups) {
    if (pickup.collected) continue;
    const dx = playerX - pickup.x;
    const dy = playerY - pickup.y;
    if (Math.sqrt(dx * dx + dy * dy) < LIGHT_PICKUP_COLLECT_DIST) {
      pickup.collected = true;
      state.lightRadius = Math.min(BASE_LIGHT_RADIUS, state.lightRadius + LIGHT_PICKUP_RESTORE);
      if (pickup.sprite) {
        pickup.sprite.removeFromParent();
        pickup.sprite.destroy();
        pickup.sprite = null;
      }
    }
  }

  // Clean up collected pickups
  state.lightPickups = state.lightPickups.filter(p => !p.collected);

  // Update darkness zones
  for (let i = state.darknessZones.length - 1; i >= 0; i--) {
    state.darknessZones[i].remaining -= dt;
    if (state.darknessZones[i].remaining <= 0) {
      state.darknessZones.splice(i, 1);
    }
  }

  // Boss takes extra damage when inside player's light circle
  const bossDistToPlayer = Math.sqrt(
    (boss.position.x - playerX) ** 2 + (boss.position.y - playerY) ** 2,
  );
  const bossInLight = bossDistToPlayer < effectiveLight;

  // Apply darkness damage to player if they step into deep darkness (outside light)
  // This is ambient damage representing the oppressive environment
  const player = players.entities[0];
  if (player?.health && effectiveLight < 50) {
    // Only at very low light levels
    const darknessDamage = player.health.max * DARKNESS_DPS * dt * (1 - effectiveLight / 50);
    player.health.current -= darknessDamage;
  }

  // Dread Hollow semi-invisible outside light (reduce alpha)
  if (boss.sprite) {
    boss.sprite.alpha = bossInLight ? 1.0 : 0.15;
  }

  // Draw darkness overlay and visuals
  if (!state.overlayContainer) {
    state.overlayContainer = new Graphics();
    game.hudLayer.addChild(state.overlayContainer);
  }
  const overlay = state.overlayContainer;
  overlay.clear();

  // Dark overlay with a circular cutout for the light radius
  // We draw a large dark rectangle and a brighter circle at the player position
  // Since we're in hudLayer (screen space), convert player world pos to screen
  const cam = game.worldLayer;
  const screenPx = playerX + cam.x;
  const screenPy = playerY + cam.y;

  // Full-screen darkness overlay
  overlay.rect(-200, -200, 1680, 1120).fill({ color: 0x000011, alpha: 0.85 });

  // Cut out a circle for visibility using a bright fill with 'erase' blend
  // Since PixiJS Graphics doesn't support erase, we overlay a gradient-like ring
  // Approach: draw concentric dark rings from outside in, leaving center clear
  // Actually, redraw: fill full dark, then draw "clear" circle with a lighter fill
  overlay.clear();

  // Draw darkness as a series of concentric rings getting darker away from player
  const maxDist = 900;
  const steps = 8;
  for (let i = steps; i >= 0; i--) {
    const r = effectiveLight + (maxDist - effectiveLight) * (i / steps);
    const alpha = 0.85 * (i / steps);
    if (r > 0) {
      overlay.circle(screenPx, screenPy, r).fill({ color: 0x000011, alpha });
    }
  }

  // Darkness zones as dark circles
  for (const zone of state.darknessZones) {
    const zScreenX = zone.x + cam.x;
    const zScreenY = zone.y + cam.y;
    overlay.circle(zScreenX, zScreenY, zone.radius)
      .fill({ color: 0x000011, alpha: 0.9 });
  }

  // Light pickup glow animation
  const pulseT = Date.now() / 400;
  for (const pickup of state.lightPickups) {
    if (pickup.sprite) {
      pickup.sprite.alpha = 0.6 + 0.4 * Math.sin(pulseT);
      pickup.sprite.scale.set(0.9 + 0.1 * Math.sin(pulseT * 1.3));
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chromatic Shift -- Prism Lord
// ─────────────────────────────────────────────────────────────────────────────

const PRISM_ELEMENT_ORDER: PrismElement[] = ['fire', 'ice', 'lightning'];
const FIRE_AURA_RADIUS = 80;
const FIRE_AURA_DPS_MULT = 0.3;
const ICE_AURA_RADIUS = 120;
const ICE_SLOW_STRENGTH = 0.5;          // velocity multiplier applied to player in range
const ICE_ARMOR_REDUCTION = 0.3;        // 30% less damage taken
const LIGHTNING_SPEED_MULT = 1.8;
const LIGHTNING_VULN_MULT = 1.2;         // 20% more damage taken

const PRISM_COLORS: Record<PrismElement, number> = {
  fire: 0xff4422,
  ice: 0x44ccff,
  lightning: 0xffff44,
};

function getPrismState(boss: object): PrismState {
  let s = prismStates.get(boss);
  if (!s) {
    s = {
      currentElement: 'fire',
      elementTimer: 10,
      shiftInterval: 10,
      shiftCount: 0,
      phase: 1,
      overloaded: false,
      visualContainer: null,
      auraContainer: null,
    };
    prismStates.set(boss, s);
  }
  return s;
}

function updatePrismShift(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'prism_lord') return;

  const state = getPrismState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;
  const baseSpeed = boss.baseSpeed ?? 40;
  state.phase = phase;

  // Phase 4: chromatic overload -- all elements active
  if (phase >= 4 && !state.overloaded) {
    state.overloaded = true;
  }

  // Shift interval decreases with phase
  const intervals = [10, 8, 6, 6];
  state.shiftInterval = intervals[Math.min(phase - 1, 3)];

  // Element cycling timer
  if (!state.overloaded) {
    state.elementTimer -= dt;
    if (state.elementTimer <= 0) {
      // Shift to next element
      const idx = PRISM_ELEMENT_ORDER.indexOf(state.currentElement);
      state.currentElement = PRISM_ELEMENT_ORDER[(idx + 1) % 3];
      state.elementTimer = state.shiftInterval;
      state.shiftCount++;

      // Transition burst damage in a ring
      if (phase >= 2) {
        const player = players.entities[0];
        if (player?.health) {
          const dx = playerX - boss.position.x;
          const dy = playerY - boss.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const burstDmg = baseDamage * (phase >= 3 ? 1.2 : 1.0);
            player.health.current -= burstDmg;
          }
        }
      }
    }
  }

  const bx = boss.position.x;
  const by = boss.position.y;
  const dx = playerX - bx;
  const dy = playerY - by;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const player = players.entities[0];

  // Apply element-specific effects
  const elem = state.currentElement;
  const isOverloaded = state.overloaded;

  // Fire aura: damage nearby players
  if (elem === 'fire' || isOverloaded) {
    if (dist < FIRE_AURA_RADIUS && player?.health) {
      player.health.current -= baseDamage * FIRE_AURA_DPS_MULT * dt;
    }
  }

  // Ice aura: slow nearby player, boss takes less damage (simulated via visual)
  if (elem === 'ice' || isOverloaded) {
    if (dist < ICE_AURA_RADIUS && player?.velocity) {
      player.velocity.x *= (1 - ICE_SLOW_STRENGTH * dt * 3);
      player.velocity.y *= (1 - ICE_SLOW_STRENGTH * dt * 3);
    }
  }

  // Lightning state: boss moves faster, takes more damage (vulnerability)
  if (elem === 'lightning' || isOverloaded) {
    boss.speed = baseSpeed * LIGHTNING_SPEED_MULT;
  } else if (elem === 'ice') {
    boss.speed = baseSpeed * 0.7; // slower in ice
  } else {
    boss.speed = baseSpeed;
  }

  // Boss tint matches current element
  if (boss.sprite) {
    if (isOverloaded) {
      // Cycle tint rapidly in overload
      const t = Date.now() / 200;
      const overloadIdx = Math.floor(t) % 3;
      boss.sprite.tint = PRISM_COLORS[PRISM_ELEMENT_ORDER[overloadIdx]];
    } else {
      boss.sprite.tint = PRISM_COLORS[elem];
    }
  }

  // Draw aura visuals
  if (!state.auraContainer) {
    state.auraContainer = new Graphics();
    game.effectLayer.addChild(state.auraContainer);
  }
  const g = state.auraContainer;
  g.clear();

  const pulseT = Date.now() / 500;

  if (elem === 'fire' || isOverloaded) {
    const fAlpha = 0.08 + 0.04 * Math.sin(pulseT);
    g.circle(bx, by, FIRE_AURA_RADIUS).fill({ color: 0xff4422, alpha: fAlpha });
    g.circle(bx, by, FIRE_AURA_RADIUS).stroke({ width: 2, color: 0xff6644, alpha: fAlpha + 0.1 });
  }

  if (elem === 'ice' || isOverloaded) {
    const iAlpha = 0.06 + 0.03 * Math.sin(pulseT * 0.8);
    g.circle(bx, by, ICE_AURA_RADIUS).fill({ color: 0x44ccff, alpha: iAlpha });
    g.circle(bx, by, ICE_AURA_RADIUS).stroke({ width: 2, color: 0x88eeff, alpha: iAlpha + 0.08 });
  }

  if (elem === 'lightning' || isOverloaded) {
    // Lightning crackling lines from boss to random points
    const lAlpha = 0.2 + 0.15 * Math.sin(pulseT * 3);
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI * 2 / 4) * i + pulseT * 0.5;
      const lDist = 40 + 30 * Math.sin(pulseT * 2 + i);
      const lx = bx + Math.cos(angle) * lDist;
      const ly = by + Math.sin(angle) * lDist;
      g.moveTo(bx, by).lineTo(lx, ly).stroke({ width: 2, color: 0xffff44, alpha: lAlpha });
    }
  }

  // Element indicator ring
  const elemColor = isOverloaded ? 0xffffff : PRISM_COLORS[elem];
  const rAlpha = 0.15 + 0.1 * Math.sin(pulseT * 1.2);
  g.circle(bx, by, 55).stroke({ width: 3, color: elemColor, alpha: rAlpha });

  // Shift timer indicator (arc showing time to next shift)
  if (!isOverloaded) {
    const progress = 1 - (state.elementTimer / state.shiftInterval);
    if (progress > 0) {
      const arcAngle = progress * Math.PI * 2;
      g.arc(bx, by, 58, -Math.PI / 2, -Math.PI / 2 + arcAngle)
        .stroke({ width: 2, color: elemColor, alpha: 0.4 });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup helper -- call when a boss dies to remove persistent visuals
// ─────────────────────────────────────────────────────────────────────────────

function cleanupBossVisuals(boss: object): void {
  const grid = gridStates.get(boss);
  if (grid?.visualContainer) {
    grid.visualContainer.removeFromParent();
    grid.visualContainer.destroy();
    grid.visualContainer = null;
    grid.activeLines.length = 0;
  }

  const grav = gravityStates.get(boss);
  if (grav?.visualContainer) {
    grav.visualContainer.removeFromParent();
    grav.visualContainer.destroy();
    grav.visualContainer = null;
  }

  const hive = hiveStates.get(boss);
  if (hive?.auraVisual) {
    hive.auraVisual.removeFromParent();
    hive.auraVisual.destroy();
    hive.auraVisual = null;
  }

  const heat = heatStates.get(boss);
  if (heat?.visualContainer) {
    heat.visualContainer.removeFromParent();
    heat.visualContainer.destroy();
    heat.visualContainer = null;
    heat.flameRings.length = 0;
  }

  const dark = darknessStates.get(boss);
  if (dark) {
    if (dark.visualContainer) {
      dark.visualContainer.removeFromParent();
      dark.visualContainer.destroy();
      dark.visualContainer = null;
    }
    if (dark.overlayContainer) {
      dark.overlayContainer.removeFromParent();
      dark.overlayContainer.destroy();
      dark.overlayContainer = null;
    }
    // Clean up light pickup sprites
    for (const pickup of dark.lightPickups) {
      if (pickup.sprite) {
        pickup.sprite.removeFromParent();
        pickup.sprite.destroy();
        pickup.sprite = null;
      }
    }
    dark.lightPickups.length = 0;
    dark.darknessZones.length = 0;
  }

  const prism = prismStates.get(boss);
  if (prism) {
    if (prism.visualContainer) {
      prism.visualContainer.removeFromParent();
      prism.visualContainer.destroy();
      prism.visualContainer = null;
    }
    if (prism.auraContainer) {
      prism.auraContainer.removeFromParent();
      prism.auraContainer.destroy();
      prism.auraContainer = null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main system entry point -- called from Game.ts every logic tick
// ─────────────────────────────────────────────────────────────────────────────

export function bossSignatureSystem(dt: number): void {
  if (players.entities.length === 0) return;
  const player = players.entities[0];

  for (const boss of bosses) {
    if (boss.dead) {
      cleanupBossVisuals(boss);
      continue;
    }

    const bossType = (boss as { bossType?: string }).bossType;
    if (!bossType) continue;

    const px = player.position.x;
    const py = player.position.y;

    switch (bossType) {
      case 'sentinel_prime':
        updateGridLock(boss, dt, px, py);
        break;
      case 'nullpoint':
        updateGravityPull(boss, dt, px, py);
        break;
      case 'overmind':
        updateHiveNetwork(boss, dt);
        break;
      case 'meltdown':
        updateHeatCycle(boss, dt, px, py);
        break;
      case 'dread_hollow':
        updateDarkness(boss, dt, px, py);
        break;
      case 'prism_lord':
        updatePrismShift(boss, dt, px, py);
        break;
    }
  }
}
