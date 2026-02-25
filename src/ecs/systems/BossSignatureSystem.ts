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

  // Dark overlay with a circular cutout for the player's light radius.
  // Uses .cut() to punch a real hole in the darkness rect.
  const cam = game.worldLayer;
  const screenPx = playerX + cam.x;
  const screenPy = playerY + cam.y;

  // Soft gradient: full darkness outside, donut rings for falloff, clear center
  const outerEdge = effectiveLight * 1.3;
  const innerClear = effectiveLight * 0.6;
  const steps = 6;

  // Full darkness beyond the outermost falloff ring
  overlay
    .rect(-200, -200, 1680, 1120)
    .circle(screenPx, screenPy, outerEdge)
    .cut()
    .fill({ color: 0x000011, alpha: 0.85 });

  // Gradient donut rings from outerEdge down to innerClear
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const nextT = (i + 1) / steps;
    const ringOuter = outerEdge - t * (outerEdge - innerClear);
    const ringInner = outerEdge - nextT * (outerEdge - innerClear);
    const alpha = 0.85 * (1 - nextT);

    overlay
      .circle(screenPx, screenPy, ringOuter)
      .circle(screenPx, screenPy, ringInner)
      .cut()
      .fill({ color: 0x000011, alpha });
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
// Dimensional Tether -- Void Weaver
// ─────────────────────────────────────────────────────────────────────────────

interface TetherAnchor {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  sprite: Graphics | null;
  regenTimer: number;       // seconds until regen (0 = no regen pending)
  dead: boolean;
}

interface VoidWeaverState {
  anchors: TetherAnchor[];
  anchorTimer: number;       // cooldown for placing new anchors
  phase: number;
  maxAnchors: number;
  regenEnabled: boolean;     // anchors regenerate after phase 3
  beamDps: number;
  visualContainer: Graphics | null;
}

const ANCHOR_HP_BASE = 60;
const ANCHOR_REGEN_TIME = 10;
const BEAM_WIDTH = 20;
const BEAM_DPS_MULT = 0.5;
const ANCHOR_RADIUS = 12;

const voidWeaverStates = new WeakMap<object, VoidWeaverState>();

function getVoidWeaverState(boss: object): VoidWeaverState {
  let s = voidWeaverStates.get(boss);
  if (!s) {
    s = {
      anchors: [],
      anchorTimer: 4.0,
      phase: 1,
      maxAnchors: 2,
      regenEnabled: false,
      beamDps: 0,
      visualContainer: null,
    };
    voidWeaverStates.set(boss, s);
  }
  return s;
}

function updateVoidWeaver(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'void_weaver') return;

  const state = getVoidWeaverState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;
  state.phase = phase;

  // Configure per phase
  const anchorsPerPhase = [2, 3, 4, 4];
  state.maxAnchors = anchorsPerPhase[Math.min(phase - 1, 3)];
  state.regenEnabled = phase >= 3;
  state.beamDps = baseDamage * BEAM_DPS_MULT;

  const bx = boss.position.x;
  const by = boss.position.y;

  // Anchor placement timer
  const placeCooldowns = [12, 10, 15, 999];
  state.anchorTimer -= dt;
  if (state.anchorTimer <= 0) {
    state.anchorTimer = placeCooldowns[Math.min(phase - 1, 3)];
    placeAnchors(state, bx, by, baseDamage, phase);
  }

  // Update anchors: regen, damage checks
  for (const anchor of state.anchors) {
    if (anchor.dead) {
      if (state.regenEnabled) {
        anchor.regenTimer -= dt;
        if (anchor.regenTimer <= 0) {
          anchor.dead = false;
          anchor.hp = anchor.maxHp;
          // Re-create sprite
          if (!anchor.sprite) {
            const ag = new Graphics();
            ag.rect(-ANCHOR_RADIUS, -ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 4)
              .fill({ color: 0x8800cc, alpha: 0.7 });
            ag.rect(-ANCHOR_RADIUS, -ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 4)
              .stroke({ width: 2, color: 0xcc44ff });
            ag.position.set(anchor.x, anchor.y);
            game.effectLayer.addChild(ag);
            anchor.sprite = ag;
          }
        }
      }
      continue;
    }

    // Check if player projectiles hit anchors (simplified: check entities with projectile tag)
    const projQuery = world.with('projectile', 'position', 'damage');
    for (const proj of projQuery) {
      const dx = proj.position.x - anchor.x;
      const dy = proj.position.y - anchor.y;
      if (Math.sqrt(dx * dx + dy * dy) < ANCHOR_RADIUS * 2) {
        anchor.hp -= proj.damage ?? 10;
        // Remove the projectile
        if (proj.lifetime !== undefined) {
          (proj as { lifetime: number }).lifetime = 0;
        }
        if (anchor.hp <= 0) {
          anchor.dead = true;
          anchor.regenTimer = ANCHOR_REGEN_TIME;
          if (anchor.sprite) {
            anchor.sprite.removeFromParent();
            anchor.sprite.destroy();
            anchor.sprite = null;
          }
        }
        break;
      }
    }
  }

  // Beam damage: check if player crosses any beam between adjacent anchors
  const liveAnchors = state.anchors.filter(a => !a.dead);
  if (liveAnchors.length >= 2) {
    for (let i = 0; i < liveAnchors.length; i++) {
      const a = liveAnchors[i];
      const b = liveAnchors[(i + 1) % liveAnchors.length];
      if (pointToSegmentDist(playerX, playerY, a.x, a.y, b.x, b.y) < BEAM_WIDTH) {
        const player = players.entities[0];
        if (player?.health) {
          player.health.current -= state.beamDps * dt;
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

  // Draw beams between live anchors
  if (liveAnchors.length >= 2) {
    for (let i = 0; i < liveAnchors.length; i++) {
      const a = liveAnchors[i];
      const b = liveAnchors[(i + 1) % liveAnchors.length];
      const beamAlpha = 0.2 + 0.1 * Math.sin(Date.now() / 200 + i);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y)
        .stroke({ width: BEAM_WIDTH, color: 0xcc44ff, alpha: beamAlpha });
      // Bright center line
      g.moveTo(a.x, a.y).lineTo(b.x, b.y)
        .stroke({ width: 3, color: 0xff88ff, alpha: beamAlpha + 0.15 });
    }
  }

  // Anchor glow pulsing
  for (const anchor of state.anchors) {
    if (anchor.dead) continue;
    const aAlpha = 0.15 + 0.1 * Math.sin(Date.now() / 300);
    g.circle(anchor.x, anchor.y, ANCHOR_RADIUS + 6).fill({ color: 0x8800cc, alpha: aAlpha });
  }
}

function placeAnchors(
  state: VoidWeaverState,
  bossX: number, bossY: number,
  baseDamage: number, phase: number,
): void {
  // Remove dead anchors with expired regen or all if placing fresh set
  for (const anchor of state.anchors) {
    if (anchor.sprite) {
      anchor.sprite.removeFromParent();
      anchor.sprite.destroy();
      anchor.sprite = null;
    }
  }
  state.anchors.length = 0;

  const count = state.maxAnchors;
  const dist = 120 + phase * 20;
  const hp = ANCHOR_HP_BASE + phase * 20;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const ax = bossX + Math.cos(angle) * dist;
    const ay = bossY + Math.sin(angle) * dist;

    const ag = new Graphics();
    ag.rect(-ANCHOR_RADIUS, -ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 4)
      .fill({ color: 0x8800cc, alpha: 0.7 });
    ag.rect(-ANCHOR_RADIUS, -ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 2, ANCHOR_RADIUS * 4)
      .stroke({ width: 2, color: 0xcc44ff });
    ag.position.set(ax, ay);
    game.effectLayer.addChild(ag);

    state.anchors.push({
      x: ax, y: ay,
      hp, maxHp: hp,
      sprite: ag,
      regenTimer: 0,
      dead: false,
    });
  }
}

/** Distance from point (px, py) to line segment (ax, ay)-(bx, by) */
function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nx = ax + t * dx;
  const ny = ay + t * dy;
  return Math.sqrt((px - nx) ** 2 + (py - ny) ** 2);
}

// ─────────────────────────────────────────────────────────────────────────────
// Permafrost -- Cryo Matrix
// ─────────────────────────────────────────────────────────────────────────────

interface IcePatch {
  x: number;
  y: number;
  radius: number;
}

interface CrystalArm {
  angle: number;          // radial position around boss
  hp: number;
  maxHp: number;
  dead: boolean;
  safeZoneTimer: number;  // safe zone duration after destruction
  sprite: Graphics | null;
}

interface CryoMatrixState {
  icePatches: IcePatch[];
  iceTimer: number;           // cooldown for new ice patches
  crystalArms: CrystalArm[];
  armRegenTimer: number;      // time until arms regenerate
  slideTimer: number;         // player slide momentum remaining
  slideDir: { x: number; y: number };
  phase: number;
  visualContainer: Graphics | null;
}

const ICE_PATCH_RADIUS = 48;
const ICE_SLIDE_DURATION = 0.5;
const ICE_SLIDE_SPEED = 180;
const ICE_DPS = 0;             // ice patches don't do direct damage, they cause sliding
const ARM_HP_BASE = 40;
const ARM_ORBIT_DIST = 70;
const ARM_SAFE_ZONE_RADIUS = 60;
const ARM_SAFE_ZONE_DURATION = 6;
const ARM_REGEN_TIME = 8;

const cryoStates = new WeakMap<object, CryoMatrixState>();

function getCryoState(boss: object): CryoMatrixState {
  let s = cryoStates.get(boss);
  if (!s) {
    // Initialize 6 crystal arms
    const arms: CrystalArm[] = [];
    for (let i = 0; i < 6; i++) {
      arms.push({
        angle: (Math.PI * 2 / 6) * i,
        hp: ARM_HP_BASE,
        maxHp: ARM_HP_BASE,
        dead: false,
        safeZoneTimer: 0,
        sprite: null,
      });
    }
    s = {
      icePatches: [],
      iceTimer: 3.0,
      crystalArms: arms,
      armRegenTimer: 0,
      slideTimer: 0,
      slideDir: { x: 0, y: 0 },
      phase: 1,
      visualContainer: null,
    };
    cryoStates.set(boss, s);
  }
  return s;
}

function updateCryoMatrix(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'cryo_matrix') return;

  const state = getCryoState(boss);
  const phase = boss.bossPhase ?? 1;
  state.phase = phase;

  const bx = boss.position.x;
  const by = boss.position.y;
  const player = players.entities[0];

  // Ice patch placement timer
  const iceCooldowns = [6, 4, 3, 2];
  state.iceTimer -= dt;
  if (state.iceTimer <= 0) {
    state.iceTimer = iceCooldowns[Math.min(phase - 1, 3)];
    // Place ice at player position
    state.icePatches.push({ x: playerX, y: playerY, radius: ICE_PATCH_RADIUS + phase * 8 });
    // Cap ice patches
    if (state.icePatches.length > 12) state.icePatches.shift();
  }

  // Check if player is on ice
  let onIce = false;
  for (const patch of state.icePatches) {
    const dx = playerX - patch.x;
    const dy = playerY - patch.y;
    if (Math.sqrt(dx * dx + dy * dy) < patch.radius) {
      // Check if this ice is in a safe zone (near destroyed arm)
      let inSafeZone = false;
      for (const arm of state.crystalArms) {
        if (arm.dead && arm.safeZoneTimer > 0) {
          const armX = bx + Math.cos(arm.angle) * ARM_ORBIT_DIST;
          const armY = by + Math.sin(arm.angle) * ARM_ORBIT_DIST;
          if (Math.sqrt((patch.x - armX) ** 2 + (patch.y - armY) ** 2) < ARM_SAFE_ZONE_RADIUS) {
            inSafeZone = true;
            break;
          }
        }
      }
      if (!inSafeZone) {
        onIce = true;
        break;
      }
    }
  }

  // Ice sliding mechanic
  if (onIce && state.slideTimer <= 0 && player?.velocity) {
    const vx = player.velocity.x;
    const vy = player.velocity.y;
    const vLen = Math.sqrt(vx * vx + vy * vy);
    if (vLen > 10) {
      state.slideTimer = ICE_SLIDE_DURATION;
      state.slideDir = { x: vx / vLen, y: vy / vLen };
    }
  }

  if (state.slideTimer > 0 && player?.velocity) {
    state.slideTimer -= dt;
    player.velocity.x = state.slideDir.x * ICE_SLIDE_SPEED;
    player.velocity.y = state.slideDir.y * ICE_SLIDE_SPEED;
  }

  // Update crystal arms
  let anyDead = false;
  for (const arm of state.crystalArms) {
    // Orbit slowly
    arm.angle += dt * 0.3;

    if (arm.dead) {
      anyDead = true;
      arm.safeZoneTimer -= dt;
      if (arm.sprite) {
        arm.sprite.removeFromParent();
        arm.sprite.destroy();
        arm.sprite = null;
      }
      continue;
    }

    const armX = bx + Math.cos(arm.angle) * ARM_ORBIT_DIST;
    const armY = by + Math.sin(arm.angle) * ARM_ORBIT_DIST;

    // Check projectile hits on arms
    const projQuery = world.with('projectile', 'position', 'damage');
    for (const proj of projQuery) {
      const dx = proj.position.x - armX;
      const dy = proj.position.y - armY;
      if (Math.sqrt(dx * dx + dy * dy) < 16) {
        arm.hp -= proj.damage ?? 10;
        if (proj.lifetime !== undefined) {
          (proj as { lifetime: number }).lifetime = 0;
        }
        if (arm.hp <= 0) {
          arm.dead = true;
          arm.safeZoneTimer = ARM_SAFE_ZONE_DURATION;
          if (arm.sprite) {
            arm.sprite.removeFromParent();
            arm.sprite.destroy();
            arm.sprite = null;
          }
        }
        break;
      }
    }

    // Draw arm sprite
    if (!arm.sprite) {
      arm.sprite = new Graphics();
      game.effectLayer.addChild(arm.sprite);
    }
    arm.sprite.clear();
    arm.sprite.rect(-8, -16, 16, 32).fill({ color: 0x88ccff, alpha: 0.7 });
    arm.sprite.rect(-8, -16, 16, 32).stroke({ width: 2, color: 0xffffff });
    arm.sprite.position.set(armX, armY);
  }

  // Arm regeneration
  if (anyDead) {
    state.armRegenTimer += dt;
    if (state.armRegenTimer >= ARM_REGEN_TIME) {
      state.armRegenTimer = 0;
      for (const arm of state.crystalArms) {
        if (arm.dead && arm.safeZoneTimer <= 0) {
          arm.dead = false;
          arm.hp = arm.maxHp;
        }
      }
    }
  } else {
    state.armRegenTimer = 0;
  }

  // Draw visuals
  if (!state.visualContainer) {
    state.visualContainer = new Graphics();
    game.effectLayer.addChild(state.visualContainer);
  }
  const g = state.visualContainer;
  g.clear();

  // Draw ice patches
  for (const patch of state.icePatches) {
    const iAlpha = 0.12 + 0.04 * Math.sin(Date.now() / 500);
    g.circle(patch.x, patch.y, patch.radius).fill({ color: 0x88ccff, alpha: iAlpha });
    g.circle(patch.x, patch.y, patch.radius).stroke({ width: 1, color: 0xffffff, alpha: iAlpha + 0.05 });
  }

  // Draw safe zones around destroyed arms
  for (const arm of state.crystalArms) {
    if (arm.dead && arm.safeZoneTimer > 0) {
      const armX = bx + Math.cos(arm.angle) * ARM_ORBIT_DIST;
      const armY = by + Math.sin(arm.angle) * ARM_ORBIT_DIST;
      const sAlpha = 0.1 + 0.05 * Math.sin(Date.now() / 400);
      g.circle(armX, armY, ARM_SAFE_ZONE_RADIUS).fill({ color: 0xff8844, alpha: sAlpha });
      g.circle(armX, armY, ARM_SAFE_ZONE_RADIUS).stroke({ width: 2, color: 0xffaa66, alpha: sAlpha + 0.1 });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain Conductor -- Arc Tyrant
// ─────────────────────────────────────────────────────────────────────────────

interface LightningRod {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  sprite: Graphics | null;
}

interface ArcBeam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  remaining: number;
}

interface ArcTyrantState {
  rods: LightningRod[];
  rodTimer: number;          // cooldown for placing rods
  maxRods: number;
  beams: ArcBeam[];
  chainTimer: number;        // cooldown for chain lightning
  stormCageActive: boolean;
  stormCageTimer: number;
  stormCageGapAngle: number;
  stormCageGapSpeed: number;
  phase: number;
  visualContainer: Graphics | null;
}

const ROD_HP_BASE = 50;
const ROD_RADIUS = 10;
const ROD_PROXIMITY_DPS_MULT = 0.3;
const ROD_PROXIMITY_RANGE = 50;
const ARC_BEAM_DURATION = 3;
const ARC_BEAM_WIDTH = 16;
const ARC_BEAM_DPS_MULT = 0.4;
const STORM_CAGE_DURATION = 6;
const STORM_CAGE_GAP_ANGLE = Math.PI / 3; // 60 degree gap

const arcTyrantStates = new WeakMap<object, ArcTyrantState>();

function getArcTyrantState(boss: object): ArcTyrantState {
  let s = arcTyrantStates.get(boss);
  if (!s) {
    s = {
      rods: [],
      rodTimer: 3.0,
      maxRods: 4,
      beams: [],
      chainTimer: 4.0,
      stormCageActive: false,
      stormCageTimer: 0,
      stormCageGapAngle: 0,
      stormCageGapSpeed: 1.2,
      phase: 1,
      visualContainer: null,
    };
    arcTyrantStates.set(boss, s);
  }
  return s;
}

function updateArcTyrant(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'arc_tyrant') return;

  const state = getArcTyrantState(boss);
  const phase = boss.bossPhase ?? 1;
  const baseDamage = boss.damage ?? 15;
  state.phase = phase;

  const bx = boss.position.x;
  const by = boss.position.y;
  const player = players.entities[0];

  // Configure per phase
  const maxRodsPerPhase = [4, 6, 8];
  state.maxRods = maxRodsPerPhase[Math.min(phase - 1, 2)];

  // Rod placement timer
  const rodCooldowns = [8, 7, 5];
  state.rodTimer -= dt;
  if (state.rodTimer <= 0 && state.rods.filter(r => !r.dead).length < state.maxRods) {
    state.rodTimer = rodCooldowns[Math.min(phase - 1, 2)];
    const rodsToPlace = phase >= 2 ? 2 : 1;
    for (let i = 0; i < rodsToPlace; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 120;
      const rx = bx + Math.cos(angle) * dist;
      const ry = by + Math.sin(angle) * dist;

      const rg = new Graphics();
      rg.rect(-6, -20, 12, 40).fill({ color: 0xffdd44, alpha: 0.8 });
      rg.rect(-6, -20, 12, 40).stroke({ width: 2, color: 0xffffff });
      rg.circle(0, -20, 8).fill({ color: 0xffffff, alpha: 0.6 });
      rg.position.set(rx, ry);
      game.effectLayer.addChild(rg);

      state.rods.push({
        x: rx, y: ry,
        hp: ROD_HP_BASE + phase * 15,
        maxHp: ROD_HP_BASE + phase * 15,
        dead: false,
        sprite: rg,
      });
    }
  }

  // Chain lightning timer
  const chainCooldowns = [4, 3, 1.5];
  state.chainTimer -= dt;
  if (state.chainTimer <= 0) {
    state.chainTimer = chainCooldowns[Math.min(phase - 1, 2)];
    fireChainLightning(state, bx, by, baseDamage, phase);
  }

  // Storm Cage (phase 3)
  if (phase >= 3 && !state.stormCageActive) {
    // Storm cage activates periodically in phase 3
    state.stormCageTimer -= dt;
    if (state.stormCageTimer <= 0) {
      state.stormCageActive = true;
      state.stormCageTimer = STORM_CAGE_DURATION;
      state.stormCageGapAngle = Math.atan2(playerY - by, playerX - bx);
    }
  }

  if (state.stormCageActive) {
    state.stormCageTimer -= dt;
    state.stormCageGapAngle += state.stormCageGapSpeed * dt;

    // Damage player if outside the gap
    const angleToBoss = Math.atan2(playerY - by, playerX - bx);
    let angleDiff = angleToBoss - state.stormCageGapAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const playerDist = Math.sqrt((playerX - bx) ** 2 + (playerY - by) ** 2);
    const cageRadius = 160;
    const cageBand = 30;

    if (Math.abs(playerDist - cageRadius) < cageBand && Math.abs(angleDiff) > STORM_CAGE_GAP_ANGLE / 2) {
      if (player?.health) {
        player.health.current -= baseDamage * ARC_BEAM_DPS_MULT * dt;
      }
    }

    if (state.stormCageTimer <= 0) {
      state.stormCageActive = false;
      state.stormCageTimer = 12; // next cage cooldown
    }
  }

  // Update rods: projectile hit detection and proximity damage
  for (let i = state.rods.length - 1; i >= 0; i--) {
    const rod = state.rods[i];
    if (rod.dead) continue;

    // Proximity damage to player
    const dx = playerX - rod.x;
    const dy = playerY - rod.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < ROD_PROXIMITY_RANGE && player?.health) {
      player.health.current -= baseDamage * ROD_PROXIMITY_DPS_MULT * dt;
    }

    // Check projectile hits
    const projQuery = world.with('projectile', 'position', 'damage');
    for (const proj of projQuery) {
      const pdx = proj.position.x - rod.x;
      const pdy = proj.position.y - rod.y;
      if (Math.sqrt(pdx * pdx + pdy * pdy) < ROD_RADIUS * 2) {
        rod.hp -= proj.damage ?? 10;
        if (proj.lifetime !== undefined) {
          (proj as { lifetime: number }).lifetime = 0;
        }
        if (rod.hp <= 0) {
          rod.dead = true;
          if (rod.sprite) {
            rod.sprite.removeFromParent();
            rod.sprite.destroy();
            rod.sprite = null;
          }
        }
        break;
      }
    }
  }

  // Remove dead rods from array
  state.rods = state.rods.filter(r => !r.dead || r.sprite !== null);

  // Update arc beams
  for (let i = state.beams.length - 1; i >= 0; i--) {
    state.beams[i].remaining -= dt;
    if (state.beams[i].remaining <= 0) {
      state.beams.splice(i, 1);
      continue;
    }

    // Damage player crossing beams
    const beam = state.beams[i];
    if (pointToSegmentDist(playerX, playerY, beam.fromX, beam.fromY, beam.toX, beam.toY) < ARC_BEAM_WIDTH) {
      if (player?.health) {
        player.health.current -= baseDamage * ARC_BEAM_DPS_MULT * dt;
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

  // Arc beams
  for (const beam of state.beams) {
    const bAlpha = 0.25 + 0.15 * Math.sin(beam.remaining * 8);
    g.moveTo(beam.fromX, beam.fromY).lineTo(beam.toX, beam.toY)
      .stroke({ width: ARC_BEAM_WIDTH, color: 0xffdd44, alpha: bAlpha });
    g.moveTo(beam.fromX, beam.fromY).lineTo(beam.toX, beam.toY)
      .stroke({ width: 3, color: 0xffffff, alpha: bAlpha + 0.15 });
  }

  // Rod glow
  for (const rod of state.rods) {
    if (rod.dead) continue;
    const rAlpha = 0.1 + 0.08 * Math.sin(Date.now() / 300);
    g.circle(rod.x, rod.y, ROD_PROXIMITY_RANGE).stroke({ width: 1, color: 0xffdd44, alpha: rAlpha });
  }

  // Storm cage visual
  if (state.stormCageActive) {
    const cageRadius = 160;
    const segCount = 24;
    for (let i = 0; i < segCount; i++) {
      const segAngle = (Math.PI * 2 / segCount) * i;
      let angleDiff = segAngle - state.stormCageGapAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) > STORM_CAGE_GAP_ANGLE / 2) {
        const sx = bx + Math.cos(segAngle) * cageRadius;
        const sy = by + Math.sin(segAngle) * cageRadius;
        const ex = bx + Math.cos(segAngle + Math.PI * 2 / segCount) * cageRadius;
        const ey = by + Math.sin(segAngle + Math.PI * 2 / segCount) * cageRadius;
        const cAlpha = 0.3 + 0.15 * Math.sin(Date.now() / 100 + i);
        g.moveTo(sx, sy).lineTo(ex, ey)
          .stroke({ width: 8, color: 0xffdd44, alpha: cAlpha });
      }
    }
  }
}

function fireChainLightning(
  state: ArcTyrantState,
  bossX: number, bossY: number,
  _baseDamage: number, phase: number,
): void {
  const liveRods = state.rods.filter(r => !r.dead);
  if (liveRods.length === 0) return;

  const maxBounces = phase === 1 ? 3 : phase === 2 ? 5 : liveRods.length;
  const beamDuration = phase === 1 ? ARC_BEAM_DURATION : ARC_BEAM_DURATION + 1;

  // Start from boss, chain to nearest rods
  let lastX = bossX;
  let lastY = bossY;
  const visited = new Set<LightningRod>();

  for (let bounce = 0; bounce < Math.min(maxBounces, liveRods.length); bounce++) {
    // Find nearest unvisited rod
    let nearest: LightningRod | null = null;
    let nearDist = Infinity;
    for (const rod of liveRods) {
      if (visited.has(rod)) continue;
      const dx = rod.x - lastX;
      const dy = rod.y - lastY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearDist) {
        nearDist = d;
        nearest = rod;
      }
    }
    if (!nearest) break;

    visited.add(nearest);
    state.beams.push({
      fromX: lastX, fromY: lastY,
      toX: nearest.x, toY: nearest.y,
      remaining: beamDuration,
    });
    lastX = nearest.x;
    lastY = nearest.y;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fractal Split -- Recursion
// ─────────────────────────────────────────────────────────────────────────────

interface RecursionCopy {
  entity: (typeof bosses.entities)[number] | null;
  damageDealt: number;      // damage dealt to this copy since last split
  dead: boolean;
  deathTimer: number;       // seconds since this copy died (for 8s window)
}

interface RecursionState {
  copies: RecursionCopy[];
  splitCount: number;        // number of active copies (1, 2, or 3)
  phase: number;
  lastPhase: number;         // to detect transitions
  merged: boolean;           // phase 4: merged state
  failedSplits: number;      // times a copy absorbed dead twin (enrage stacks)
  visualContainer: Graphics | null;
}

const SPLIT_KILL_WINDOW = 8;      // seconds to kill all copies
const SPLIT_OFFSET_DIST = 80;
const COPY_SCALE_FACTOR = 0.85;   // each split makes copies smaller
const COPY_ALPHA_FACTOR = 0.8;    // each split makes copies more translucent

const recursionStates = new WeakMap<object, RecursionState>();

function getRecursionState(boss: object): RecursionState {
  let s = recursionStates.get(boss);
  if (!s) {
    s = {
      copies: [],
      splitCount: 1,
      phase: 1,
      lastPhase: 1,
      merged: false,
      failedSplits: 0,
      visualContainer: null,
    };
    recursionStates.set(boss, s);
  }
  return s;
}

function updateRecursion(
  boss: (typeof bosses.entities)[number],
  dt: number,
  playerX: number, playerY: number,
): void {
  const bossType = (boss as { bossType?: string }).bossType;
  if (bossType !== 'recursion') return;

  const state = getRecursionState(boss);
  const phase = boss.bossPhase ?? 1;
  state.phase = phase;

  const bx = boss.position.x;
  const by = boss.position.y;

  // Detect phase transitions to trigger splits
  if (phase !== state.lastPhase) {
    if (phase === 2 && state.splitCount < 2) {
      splitBoss(boss, state, 2);
    } else if (phase === 3 && state.splitCount < 3) {
      splitBoss(boss, state, 3);
    } else if (phase === 4 && !state.merged) {
      mergeCopies(boss, state);
    }
    state.lastPhase = phase;
  }

  // Update copies (phases 2-3)
  if (state.copies.length > 0 && !state.merged) {
    let anyDead = false;
    let allDead = true;

    for (const copy of state.copies) {
      if (!copy.entity || copy.entity.dead) {
        if (!copy.dead) {
          copy.dead = true;
          copy.deathTimer = SPLIT_KILL_WINDOW;
        }
        anyDead = true;
        if (copy.dead) {
          copy.deathTimer -= dt;
        }
      } else {
        allDead = false;
      }
    }

    // Check the main boss too
    const mainDead = boss.health.current <= 0;

    if (anyDead && !allDead && !mainDead) {
      // Check if the kill window expired for any dead copy
      for (const copy of state.copies) {
        if (copy.dead && copy.deathTimer <= 0) {
          // Failed split: surviving copies absorb and heal
          state.failedSplits++;
          // Heal boss back to phase threshold
          const thresholds = [1.0, 0.65, 0.35, 0.1];
          const healTarget = boss.health.max * (thresholds[Math.min(phase - 1, 3)] ?? 0.35);
          boss.health.current = Math.max(boss.health.current, healTarget);

          // Apply enrage stacks
          if (boss.damage !== undefined) {
            boss.damage = Math.round(boss.damage * 1.15);
          }
          if (boss.speed !== undefined) boss.speed *= 1.1;

          // Remove dead copies and reset
          cleanupRecursionCopies(state);
          state.splitCount = 1;
          break;
        }
      }
    }
  }

  // Visual connections between copies
  if (!state.visualContainer) {
    state.visualContainer = new Graphics();
    game.effectLayer.addChild(state.visualContainer);
  }
  const g = state.visualContainer;
  g.clear();

  // Draw connection lines between boss and copies
  for (const copy of state.copies) {
    if (!copy.entity || copy.entity.dead) continue;
    const cx = copy.entity.position.x;
    const cy = copy.entity.position.y;
    const lAlpha = 0.15 + 0.1 * Math.sin(Date.now() / 400);
    g.moveTo(bx, by).lineTo(cx, cy)
      .stroke({ width: 2, color: 0x00ff88, alpha: lAlpha });
  }

  // Merge indicator in phase 4
  if (state.merged) {
    const mAlpha = 0.08 + 0.05 * Math.sin(Date.now() / 300);
    g.circle(bx, by, 50).fill({ color: 0x00ff88, alpha: mAlpha });
    g.circle(bx, by, 50).stroke({ width: 3, color: 0x44ffcc, alpha: mAlpha + 0.1 });
  }
}

function splitBoss(
  boss: (typeof bosses.entities)[number],
  state: RecursionState,
  targetCount: number,
): void {
  // Clean up old copies first
  cleanupRecursionCopies(state);

  const bx = boss.position.x;
  const by = boss.position.y;
  const copyCount = targetCount - 1; // boss itself is one of the copies

  state.splitCount = targetCount;

  for (let i = 0; i < copyCount; i++) {
    const angle = (Math.PI * 2 / targetCount) * (i + 1);
    const cx = bx + Math.cos(angle) * SPLIT_OFFSET_DIST;
    const cy = by + Math.sin(angle) * SPLIT_OFFSET_DIST;

    // Create a visual copy with scaled-down sprite
    const copyG = new Graphics();
    const copyRadius = 44 * Math.pow(COPY_SCALE_FACTOR, state.splitCount - 1);
    const copyAlpha = Math.pow(COPY_ALPHA_FACTOR, state.splitCount - 1);

    // Draw a simplified recursion shape for the copy
    for (let j = 0; j < 3; j++) {
      const a = (Math.PI * 2 / 3) * j - Math.PI / 2;
      const px = Math.cos(a) * copyRadius;
      const py = Math.sin(a) * copyRadius;
      if (j === 0) copyG.moveTo(px, py);
      else copyG.lineTo(px, py);
    }
    copyG.closePath();
    copyG.fill({ color: 0x00ff88, alpha: copyAlpha * 0.7 });
    copyG.stroke({ width: 2, color: 0x44ffcc, alpha: copyAlpha });

    copyG.position.set(cx, cy);
    game.entityLayer.addChild(copyG);

    // Create the copy entity as a regular enemy (shares boss HP pool concept)
    const copyHp = Math.round(boss.health.current * 0.5);
    const copyEntity = world.add({
      position: { x: cx, y: cy },
      velocity: { x: 0, y: 0 },
      speed: (boss.speed ?? 60) * 0.9,
      baseSpeed: (boss.baseSpeed ?? 60) * 0.9,
      enemy: true as const,
      boss: true as const,
      bossPhase: boss.bossPhase,
      bossType: 'recursion_copy',
      enemyType: 'boss',
      health: { current: copyHp, max: copyHp },
      damage: Math.round((boss.damage ?? 15) * 0.8),
      sprite: copyG,
      level: boss.level ?? 1,
      aiTimer: 0,
      aiState: 'chase',
    });

    state.copies.push({
      entity: copyEntity as (typeof bosses.entities)[number],
      damageDealt: 0,
      dead: false,
      deathTimer: 0,
    });
  }

  // Reduce main boss HP by the amount given to copies
  boss.health.current = Math.round(boss.health.current * 0.5);
}

function mergeCopies(
  boss: (typeof bosses.entities)[number],
  state: RecursionState,
): void {
  // Gather remaining HP from copies
  for (const copy of state.copies) {
    if (copy.entity && !copy.entity.dead) {
      // Add remaining copy HP back to boss
      boss.health.current += copy.entity.health.current;
      // Kill the copy entity
      copy.entity.health.current = 0;
      (copy.entity as { dead?: true }).dead = true as const;
      if (copy.entity.sprite) {
        copy.entity.sprite.removeFromParent();
        copy.entity.sprite.destroy();
      }
    }
  }
  state.copies.length = 0;
  state.merged = true;
  state.splitCount = 1;
}

function cleanupRecursionCopies(state: RecursionState): void {
  for (const copy of state.copies) {
    if (copy.entity) {
      if (!copy.entity.dead) {
        copy.entity.health.current = 0;
        (copy.entity as { dead?: true }).dead = true as const;
      }
      if (copy.entity.sprite) {
        copy.entity.sprite.removeFromParent();
        copy.entity.sprite.destroy();
      }
    }
  }
  state.copies.length = 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup helper -- call when a boss dies to remove persistent visuals
// ─────────────────────────────────────────────────────────────────────────────

export function cleanupBossVisuals(boss: object): void {
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

  const voidW = voidWeaverStates.get(boss);
  if (voidW) {
    if (voidW.visualContainer) {
      voidW.visualContainer.removeFromParent();
      voidW.visualContainer.destroy();
      voidW.visualContainer = null;
    }
    for (const anchor of voidW.anchors) {
      if (anchor.sprite) {
        anchor.sprite.removeFromParent();
        anchor.sprite.destroy();
        anchor.sprite = null;
      }
    }
    voidW.anchors.length = 0;
  }

  const cryo = cryoStates.get(boss);
  if (cryo) {
    if (cryo.visualContainer) {
      cryo.visualContainer.removeFromParent();
      cryo.visualContainer.destroy();
      cryo.visualContainer = null;
    }
    for (const arm of cryo.crystalArms) {
      if (arm.sprite) {
        arm.sprite.removeFromParent();
        arm.sprite.destroy();
        arm.sprite = null;
      }
    }
  }

  const arcT = arcTyrantStates.get(boss);
  if (arcT) {
    if (arcT.visualContainer) {
      arcT.visualContainer.removeFromParent();
      arcT.visualContainer.destroy();
      arcT.visualContainer = null;
    }
    for (const rod of arcT.rods) {
      if (rod.sprite) {
        rod.sprite.removeFromParent();
        rod.sprite.destroy();
        rod.sprite = null;
      }
    }
    arcT.rods.length = 0;
    arcT.beams.length = 0;
  }

  const rec = recursionStates.get(boss);
  if (rec) {
    if (rec.visualContainer) {
      rec.visualContainer.removeFromParent();
      rec.visualContainer.destroy();
      rec.visualContainer = null;
    }
    cleanupRecursionCopies(rec);
  }

  // Delete state map entries so no stale references remain
  gridStates.delete(boss);
  gravityStates.delete(boss);
  hiveStates.delete(boss);
  heatStates.delete(boss);
  darknessStates.delete(boss);
  prismStates.delete(boss);
  voidWeaverStates.delete(boss);
  cryoStates.delete(boss);
  arcTyrantStates.delete(boss);
  recursionStates.delete(boss);
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
      case 'void_weaver':
        updateVoidWeaver(boss, dt, px, py);
        break;
      case 'cryo_matrix':
        updateCryoMatrix(boss, dt, px, py);
        break;
      case 'arc_tyrant':
        updateArcTyrant(boss, dt, px, py);
        break;
      case 'recursion':
        updateRecursion(boss, dt, px, py);
        break;
    }
  }
}
