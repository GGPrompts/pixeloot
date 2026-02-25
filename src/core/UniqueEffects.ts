import { inventory } from './Inventory';

/**
 * Central helper for checking whether the player has a unique item effect equipped.
 * Used by various game systems to trigger unique item runtime behaviors.
 */

/**
 * Returns true if any equipped item has the given effectId.
 */
export function hasEffect(effectId: string): boolean {
  const slots = inventory.equipped;
  const items = [
    slots.weapon,
    slots.helmet,
    slots.chest,
    slots.boots,
    slots.ring1,
    slots.ring2,
    slots.amulet,
    slots.offhand,
  ];

  for (const item of items) {
    if (item?.effectId === effectId) return true;
  }
  return false;
}

// ── Chrono Shield cheat-death cooldown tracking ──────────────────────
let chronoCooldownRemaining = 0;

/** Tick the chrono cheat-death internal cooldown (call from healthSystem). */
export function tickChronoCooldown(dt: number): void {
  if (chronoCooldownRemaining > 0) {
    chronoCooldownRemaining -= dt;
    if (chronoCooldownRemaining < 0) chronoCooldownRemaining = 0;
  }
}

/** Try to trigger cheat-death. Returns true if it activated (heals 30% HP). */
export function tryCheatDeath(): boolean {
  if (!hasEffect('chrono_cheat_death')) return false;
  if (chronoCooldownRemaining > 0) return false;
  chronoCooldownRemaining = 60; // 60 second cooldown
  return true;
}

/** Reset chrono cooldown (e.g. on new dungeon run). */
export function resetChronoCooldown(): void {
  chronoCooldownRemaining = 0;
}

// ── Essence Conduit kill frenzy tracking ─────────────────────────────
let frenzyRemaining = 0;

/** Tick the frenzy buff duration. */
export function tickFrenzy(dt: number): void {
  if (frenzyRemaining > 0) {
    frenzyRemaining -= dt;
    if (frenzyRemaining < 0) frenzyRemaining = 0;
  }
}

/** Activate the frenzy buff (3s of +20% move/attack speed). */
export function activateFrenzy(): void {
  frenzyRemaining = 3;
}

/** Returns true if the frenzy buff is currently active. */
export function isFrenzyActive(): boolean {
  return frenzyRemaining > 0;
}

// ── Kinetic Band projectile counter ──────────────────────────────────
let projectileCounter = 0;

/**
 * Increment and return the global player projectile counter.
 * Used by Kinetic Band to trigger every 4th shot.
 */
export function incrementProjectileCount(): number {
  return ++projectileCounter;
}

/** Reset projectile counter (e.g. on new dungeon run). */
export function resetProjectileCount(): void {
  projectileCounter = 0;
}

// ── Whisperstring: Steady Aim (stationary 1s → +40% dmg + wall-pierce) ──

let steadyAimTimer = 0;
let steadyAimReady = false;
let _lastPlayerX = 0;
let _lastPlayerY = 0;

/**
 * Tick the Whisperstring steady aim tracker. Call each fixed update with
 * the player's current position. When the player stands still for 1s,
 * the next projectile gets the buff.
 */
export function tickSteadyAim(
  dt: number,
  px: number,
  py: number,
  velX: number,
  velY: number,
): void {
  if (!hasEffect('whisperstring_steady')) {
    steadyAimReady = false;
    steadyAimTimer = 0;
    return;
  }
  const moving = velX !== 0 || velY !== 0;
  if (moving) {
    steadyAimTimer = 0;
    steadyAimReady = false;
  } else {
    steadyAimTimer += dt;
    if (steadyAimTimer >= 1) {
      steadyAimReady = true;
    }
  }
  _lastPlayerX = px;
  _lastPlayerY = py;
}

/** Returns true if Steady Aim buff is charged (consume with consumeSteadyAim). */
export function isSteadyAimReady(): boolean {
  return steadyAimReady;
}

/** Consume the Steady Aim charge. Returns true if it was ready. */
export function consumeSteadyAim(): boolean {
  if (!steadyAimReady) return false;
  steadyAimReady = false;
  steadyAimTimer = 0;
  return true;
}

// ── Flickerstep Shroud: +30% attack speed for 2s after movement skill ──

let flickerstepRemaining = 0;

/** Activate the Flickerstep buff (2s of +30% attack speed). */
export function activateFlickerstep(): void {
  if (hasEffect('flickerstep_post_dash')) {
    flickerstepRemaining = 2;
  }
}

/** Tick the Flickerstep buff timer. */
export function tickFlickerstep(dt: number): void {
  if (flickerstepRemaining > 0) {
    flickerstepRemaining -= dt;
    if (flickerstepRemaining < 0) flickerstepRemaining = 0;
  }
}

/** Returns true if the Flickerstep attack speed buff is active. */
export function isFlickerstepActive(): boolean {
  return flickerstepRemaining > 0;
}

// ── Mindstorm Crown: 5 kills in 4s → free Frost Nova ─────────────────

const killTimestamps: number[] = [];
let mindstormNovaCallback: ((px: number, py: number) => void) | null = null;

/**
 * Register the callback that fires a free Frost Nova at the given position.
 * Called once during Mage skill setup so UniqueEffects does not import Mage.ts.
 */
export function setMindstormNovaCallback(cb: (px: number, py: number) => void): void {
  mindstormNovaCallback = cb;
}

/**
 * Record a kill for the Mindstorm Crown killstreak tracker.
 * If 5 kills within 4s and effect is equipped, fires a free Frost Nova.
 */
export function recordMindstormKill(px: number, py: number): void {
  if (!hasEffect('mindstorm_killstreak_nova')) return;

  const now = performance.now() / 1000; // seconds
  killTimestamps.push(now);

  // Prune entries older than 4s
  while (killTimestamps.length > 0 && now - killTimestamps[0] > 4) {
    killTimestamps.shift();
  }

  if (killTimestamps.length >= 5) {
    // Trigger free Frost Nova at player position
    killTimestamps.length = 0; // reset streak
    if (mindstormNovaCallback) {
      mindstormNovaCallback(px, py);
    }
  }
}

/** Reset Mindstorm kill timestamps (e.g. on new dungeon run). */
export function resetMindstormKills(): void {
  killTimestamps.length = 0;
}

// ── Rootwalkers: stationary 0.5s → +20% damage, +25 armor ────────────

let rootwalkerTimer = 0;
let rootwalkerActive = false;

/**
 * Tick the Rootwalker standing tracker. Returns true when the buff
 * activates or is already active.
 */
export function tickRootwalker(dt: number, velX: number, velY: number): void {
  if (!hasEffect('rootwalkers_plant')) {
    rootwalkerActive = false;
    rootwalkerTimer = 0;
    return;
  }
  const moving = velX !== 0 || velY !== 0;
  if (moving) {
    rootwalkerTimer = 0;
    rootwalkerActive = false;
  } else {
    rootwalkerTimer += dt;
    if (rootwalkerTimer >= 0.5) {
      rootwalkerActive = true;
    }
  }
}

/** Returns true if the Rootwalker buff is active (+20% dmg, +25 armor). */
export function isRootwalkerActive(): boolean {
  return rootwalkerActive;
}

// ── Trailblazer Greaves: burning trail while moving ─────────────────

import { Graphics } from 'pixi.js';

interface BurningPatch {
  x: number;
  y: number;
  remaining: number; // seconds left
  tickTimer: number;
  gfx: Graphics;
}

const burningPatches: BurningPatch[] = [];
let trailSpawnTimer = 0;
const TRAIL_SPAWN_INTERVAL = 0.3;
const TRAIL_PATCH_DURATION = 3;
const TRAIL_PATCH_RADIUS = 24;
const TRAIL_DAMAGE = 5;
const TRAIL_TICK_INTERVAL = 0.5;
const TRAIL_MAX_PATCHES = 10;

/** Reference to game.effectLayer set on first use (avoids circular import). */
let _effectLayer: import('pixi.js').Container | null = null;

/** Set the effect layer reference (call once from Game.ts). */
export function setEffectLayer(layer: import('pixi.js').Container): void {
  _effectLayer = layer;
}

/**
 * Tick the Trailblazer burning trail. Call from fixed update.
 * Spawns burning patches behind the player while moving.
 */
export function tickTrailblazer(
  dt: number,
  px: number,
  py: number,
  velX: number,
  velY: number,
  enemies: Iterable<{ position: { x: number; y: number }; health: { current: number; max: number } }>,
  applyBurn: (enemy: { position: { x: number; y: number }; health: { current: number; max: number } }) => void,
  spawnDmgNum: (x: number, y: number, dmg: number, color: number) => void,
): void {
  // Tick existing patches regardless of effect being equipped
  for (let i = burningPatches.length - 1; i >= 0; i--) {
    const patch = burningPatches[i];
    patch.remaining -= dt;
    patch.tickTimer += dt;

    // Pulse visual
    const pulse = 0.15 + 0.1 * Math.sin(patch.remaining * 6);
    patch.gfx.alpha = pulse * (patch.remaining / TRAIL_PATCH_DURATION);

    // Damage enemies in range every 0.5s
    if (patch.tickTimer >= TRAIL_TICK_INTERVAL) {
      patch.tickTimer -= TRAIL_TICK_INTERVAL;
      for (const enemy of enemies) {
        const edx = enemy.position.x - patch.x;
        const edy = enemy.position.y - patch.y;
        if (edx * edx + edy * edy < TRAIL_PATCH_RADIUS * TRAIL_PATCH_RADIUS) {
          enemy.health.current -= TRAIL_DAMAGE;
          spawnDmgNum(enemy.position.x, enemy.position.y - 10, TRAIL_DAMAGE, 0xff6600);
          applyBurn(enemy);
        }
      }
    }

    if (patch.remaining <= 0) {
      patch.gfx.removeFromParent();
      patch.gfx.destroy();
      burningPatches.splice(i, 1);
    }
  }

  if (!hasEffect('trailblazer_fire_trail')) {
    trailSpawnTimer = 0;
    return;
  }

  const moving = velX !== 0 || velY !== 0;
  if (!moving) {
    trailSpawnTimer = 0;
    return;
  }

  trailSpawnTimer += dt;
  if (trailSpawnTimer >= TRAIL_SPAWN_INTERVAL) {
    trailSpawnTimer -= TRAIL_SPAWN_INTERVAL;

    // Remove oldest if at max
    while (burningPatches.length >= TRAIL_MAX_PATCHES) {
      const oldest = burningPatches.shift()!;
      oldest.gfx.removeFromParent();
      oldest.gfx.destroy();
    }

    // Spawn new patch
    const gfx = new Graphics();
    gfx.circle(0, 0, TRAIL_PATCH_RADIUS).fill({ color: 0xff4400, alpha: 0.2 });
    gfx.circle(0, 0, TRAIL_PATCH_RADIUS * 0.6).fill({ color: 0xff6600, alpha: 0.15 });
    gfx.position.set(px, py);
    if (_effectLayer) {
      _effectLayer.addChild(gfx);
    }

    burningPatches.push({
      x: px,
      y: py,
      remaining: TRAIL_PATCH_DURATION,
      tickTimer: 0,
      gfx,
    });
  }
}

/** Clear all burning patches (e.g. on town enter or new dungeon). */
export function clearTrailPatches(): void {
  for (const patch of burningPatches) {
    patch.gfx.removeFromParent();
    patch.gfx.destroy();
  }
  burningPatches.length = 0;
  trailSpawnTimer = 0;
}

// ── Manaforge Ring: refund 30% cooldown when hitting 3+ enemies ──────

/**
 * Check and apply the Manaforge Ring cooldown refund.
 * Call after an AoE skill hits enemies, passing the hit count and the
 * skill slot key used. Refunds 30% of that skill's max cooldown.
 */
export function checkManaforgeRefund(
  hitCount: number,
  skillSlotKey: string,
  skillSystem: {
    getSlot: (slot: 'lmb' | 'rmb' | 'space' | 'e') => { def: { cooldown: number }; cooldownRemaining: number } | null;
  },
): void {
  if (!hasEffect('manaforge_aoe_refund')) return;
  if (hitCount < 3) return;

  const slot = skillSystem.getSlot(skillSlotKey as 'lmb' | 'rmb' | 'space' | 'e');
  if (!slot) return;

  const refund = slot.def.cooldown * 0.3;
  slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - refund);
}

// ── Thornweave Mantle: 15% damage reflect nova on hit (0.5s throttle) ──

let thornweaveThrottle = 0;

/**
 * Tick the Thornweave reflect throttle timer.
 */
export function tickThornweave(dt: number): void {
  if (thornweaveThrottle > 0) {
    thornweaveThrottle -= dt;
    if (thornweaveThrottle < 0) thornweaveThrottle = 0;
  }
}

/**
 * Trigger Thornweave reflect nova when player takes damage.
 * Returns true if the nova was triggered (caller should deal damage to nearby enemies).
 * @param rawDamage pre-mitigation damage taken
 * @param playerX player position X
 * @param playerY player position Y
 * @param enemies iterable of enemies with position+health
 * @param spawnDmgNum damage number spawner
 */
export function tryThornweaveReflect(
  rawDamage: number,
  playerX: number,
  playerY: number,
  enemies: Iterable<{ position: { x: number; y: number }; health: { current: number; max: number } }>,
  spawnDmgNum: (x: number, y: number, dmg: number, color: number) => void,
): boolean {
  if (!hasEffect('thornweave_reflect_nova')) return false;
  if (thornweaveThrottle > 0) return false;

  thornweaveThrottle = 0.5;
  const novaDmg = Math.max(1, Math.round(rawDamage * 0.15));
  const NOVA_RADIUS = 96;

  // Deal damage to enemies in range
  for (const enemy of enemies) {
    const dx = enemy.position.x - playerX;
    const dy = enemy.position.y - playerY;
    if (dx * dx + dy * dy < NOVA_RADIUS * NOVA_RADIUS) {
      enemy.health.current -= novaDmg;
      spawnDmgNum(enemy.position.x, enemy.position.y - 10, novaDmg, 0xff4444);
    }
  }

  // Visual: red-orange expanding ring
  if (_effectLayer) {
    const ring = new Graphics();
    ring.position.set(playerX, playerY);
    _effectLayer.addChild(ring);

    const start = performance.now();
    const expand = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed / 250, 1);
      const r = 10 + t * (NOVA_RADIUS - 10);
      ring.clear();
      ring.circle(0, 0, r).stroke({ width: 2, color: 0xff4444, alpha: 0.7 * (1 - t) });
      ring.circle(0, 0, r).fill({ color: 0xff6644, alpha: 0.1 * (1 - t) });
      if (t >= 1) {
        ring.removeFromParent();
        ring.destroy();
      } else {
        requestAnimationFrame(expand);
      }
    };
    requestAnimationFrame(expand);
  }

  return true;
}

// ── Phasewalk Boots: invisibility after movement skill ──────────────

let invisibilityRemaining = 0;

/** Activate 1s invisibility after movement skill. */
export function activatePhasewalkInvisibility(): void {
  if (hasEffect('phasewalk_enhanced_mobility')) {
    invisibilityRemaining = 1;
  }
}

/** Tick the invisibility timer. */
export function tickPhasewalkInvisibility(dt: number): void {
  if (invisibilityRemaining > 0) {
    invisibilityRemaining -= dt;
    if (invisibilityRemaining < 0) invisibilityRemaining = 0;
  }
}

/** Returns true if player is currently invisible. */
export function isPhasewalkInvisible(): boolean {
  return invisibilityRemaining > 0;
}

/** Break invisibility (on attack). */
export function breakPhasewalkInvisibility(): void {
  invisibilityRemaining = 0;
}

// ── Gambler's Charm: random buff every 10s ──────────────────────────

let gamblerCycleTimer = 0;
let gamblerBuffTimer = 0;
let gamblerActiveBuffType: 'damage' | 'speed' | 'armor' | 'refresh' | null = null;
let gamblerRefreshCallback: (() => void) | null = null;

/**
 * Register the callback that refreshes all skill cooldowns.
 * Called once during game setup.
 */
export function setGamblerRefreshCallback(cb: () => void): void {
  gamblerRefreshCallback = cb;
}

/**
 * Tick the Gambler's Charm cycle. Call from fixed update.
 */
export function tickGamblerCharm(dt: number): void {
  if (!hasEffect('gambler_random_buff')) {
    gamblerCycleTimer = 0;
    gamblerBuffTimer = 0;
    gamblerActiveBuffType = null;
    return;
  }

  // Tick active buff duration
  if (gamblerBuffTimer > 0) {
    gamblerBuffTimer -= dt;
    if (gamblerBuffTimer <= 0) {
      gamblerBuffTimer = 0;
      gamblerActiveBuffType = null;
    }
  }

  // Tick cycle timer
  gamblerCycleTimer += dt;
  if (gamblerCycleTimer >= 10) {
    gamblerCycleTimer -= 10;

    // Pick a random buff
    const roll = Math.floor(Math.random() * 4);
    switch (roll) {
      case 0:
        gamblerActiveBuffType = 'damage';
        gamblerBuffTimer = 5;
        break;
      case 1:
        gamblerActiveBuffType = 'speed';
        gamblerBuffTimer = 5;
        break;
      case 2:
        gamblerActiveBuffType = 'armor';
        gamblerBuffTimer = 5;
        break;
      case 3:
        gamblerActiveBuffType = 'refresh';
        gamblerBuffTimer = 0; // Instant effect, no duration
        if (gamblerRefreshCallback) gamblerRefreshCallback();
        break;
    }

    // Visual aura on player (color depends on buff type)
    if (_effectLayer && gamblerActiveBuffType) {
      const colorMap = { damage: 0xff4444, speed: 0x44ff44, armor: 0x888888, refresh: 0x4488ff };
      const color = colorMap[gamblerActiveBuffType] ?? 0xffffff;
      const aura = new Graphics();
      // Get player position from world
      const pEnts = (globalThis as Record<string, unknown>).__gamblerPlayerPos as { x: number; y: number } | undefined;
      if (pEnts) {
        aura.position.set(pEnts.x, pEnts.y);
        aura.circle(0, 0, 24).fill({ color, alpha: 0.3 });
        _effectLayer.addChild(aura);
        setTimeout(() => {
          aura.removeFromParent();
          aura.destroy();
        }, 500);
      }
    }
  }
}

/** Returns the currently active gambler buff type, or null. */
export function getGamblerBuff(): 'damage' | 'speed' | 'armor' | null {
  if (gamblerBuffTimer <= 0) return null;
  if (gamblerActiveBuffType === 'refresh') return null; // instant, not ongoing
  return gamblerActiveBuffType;
}

// ── Tome of Recursion: echo Frost Nova ──────────────────────────────

let recursionNovaCallback: ((px: number, py: number, isEcho: boolean) => void) | null = null;
let _isEchoNova = false;

/**
 * Register the callback that fires a Frost Nova echo.
 * Called once during Mage skill setup.
 */
export function setRecursionNovaCallback(cb: (px: number, py: number, isEcho: boolean) => void): void {
  recursionNovaCallback = cb;
}

/**
 * Schedule a Frost Nova echo 1s after the initial nova.
 * Call from Frost Nova execute. Does nothing if this IS the echo.
 */
export function scheduleRecursionEcho(px: number, py: number): void {
  if (!hasEffect('recursion_double_nova')) return;
  if (_isEchoNova) return; // Prevent infinite recursion

  setTimeout(() => {
    if (recursionNovaCallback) {
      _isEchoNova = true;
      recursionNovaCallback(px, py, true);
      _isEchoNova = false;
    }
  }, 1000);
}

/** Returns true if the currently executing Frost Nova is an echo (for halved radius/damage). */
export function isEchoNova(): boolean {
  return _isEchoNova;
}

// ── Sentinel Ward: orbiting shield that blocks projectiles ──────────

let sentinelShieldCooldown = 0;
let sentinelShieldGfx: Graphics | null = null;
let sentinelShieldAngle = 0;

/**
 * Tick the Sentinel Ward shield. Call from fixed update.
 * Returns true if the shield is currently active and available to block.
 */
export function tickSentinelWard(
  dt: number,
  playerX: number,
  playerY: number,
  healthRatio: number,
): void {
  // Tick cooldown regardless
  if (sentinelShieldCooldown > 0) {
    sentinelShieldCooldown -= dt;
    if (sentinelShieldCooldown < 0) sentinelShieldCooldown = 0;
  }

  const active = hasEffect('sentinel_ward_shield') && healthRatio < 0.5;

  if (active) {
    sentinelShieldAngle += dt * 2; // 2 rad/s rotation

    // Create or update shield visual
    if (!sentinelShieldGfx && _effectLayer) {
      sentinelShieldGfx = new Graphics();
      _effectLayer.addChild(sentinelShieldGfx);
    }

    if (sentinelShieldGfx) {
      const orbitRadius = 28;
      const sx = playerX + Math.cos(sentinelShieldAngle) * orbitRadius;
      const sy = playerY + Math.sin(sentinelShieldAngle) * orbitRadius;

      sentinelShieldGfx.clear();
      sentinelShieldGfx.position.set(sx, sy);

      if (sentinelShieldCooldown > 0) {
        // Cooldown: dim shield
        sentinelShieldGfx.poly([0, -6, 6, 0, 0, 6, -6, 0]).fill({ color: 0x444466, alpha: 0.3 });
      } else {
        // Ready: bright shield
        sentinelShieldGfx.poly([0, -8, 8, 0, 0, 8, -8, 0]).fill({ color: 0x44ccff, alpha: 0.7 });
        sentinelShieldGfx.poly([0, -8, 8, 0, 0, 8, -8, 0]).stroke({ width: 1, color: 0x88eeff, alpha: 0.9 });
      }
    }
  } else {
    // Remove shield visual when not active
    if (sentinelShieldGfx) {
      sentinelShieldGfx.removeFromParent();
      sentinelShieldGfx.destroy();
      sentinelShieldGfx = null;
    }
  }
}

/**
 * Try to block an enemy projectile with the Sentinel Ward shield.
 * Returns true if the projectile was blocked.
 */
export function trySentinelBlock(playerX: number, playerY: number, healthRatio: number): boolean {
  if (!hasEffect('sentinel_ward_shield')) return false;
  if (healthRatio >= 0.5) return false;
  if (sentinelShieldCooldown > 0) return false;

  sentinelShieldCooldown = 3; // 3s cooldown

  // Flash effect on the shield
  if (sentinelShieldGfx && _effectLayer) {
    const flash = new Graphics();
    flash.position.set(sentinelShieldGfx.position.x, sentinelShieldGfx.position.y);
    flash.circle(0, 0, 16).fill({ color: 0x88eeff, alpha: 0.6 });
    _effectLayer.addChild(flash);
    setTimeout(() => {
      flash.removeFromParent();
      flash.destroy();
    }, 200);
  }

  return true;
}

// ── Gravity Well Staff: pull enemies during Meteor telegraph ────────

/**
 * Pull enemies toward the Meteor impact point during telegraph.
 * Call each frame during Meteor's telegraph phase.
 */
export function applyGravityWellPull(
  dt: number,
  targetX: number,
  targetY: number,
  enemies: Iterable<{ position: { x: number; y: number } }>,
): void {
  if (!hasEffect('gravity_well_meteor')) return;

  const PULL_RADIUS = 150;
  const PULL_SPEED = 80; // px/s

  for (const enemy of enemies) {
    const dx = targetX - enemy.position.x;
    const dy = targetY - enemy.position.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < PULL_RADIUS * PULL_RADIUS && distSq > 4) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      enemy.position.x += nx * PULL_SPEED * dt;
      enemy.position.y += ny * PULL_SPEED * dt;
    }
  }
}

// ── Reset all triggered effect state (call on dungeon enter/exit) ────

export function resetAllTriggeredEffects(): void {
  steadyAimTimer = 0;
  steadyAimReady = false;
  flickerstepRemaining = 0;
  killTimestamps.length = 0;
  rootwalkerTimer = 0;
  rootwalkerActive = false;
  clearTrailPatches();
  thornweaveThrottle = 0;
  invisibilityRemaining = 0;
  gamblerCycleTimer = 0;
  gamblerBuffTimer = 0;
  gamblerActiveBuffType = null;
  sentinelShieldCooldown = 0;
  if (sentinelShieldGfx) {
    sentinelShieldGfx.removeFromParent();
    sentinelShieldGfx.destroy();
    sentinelShieldGfx = null;
  }
  sentinelShieldAngle = 0;
}
