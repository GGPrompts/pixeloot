/**
 * ConditionalAffixSystem — runtime evaluation of conditional affixes.
 *
 * Tracks player state (moving, stationary, damage taken, kills, skill usage)
 * and evaluates equipped conditional affixes each frame to produce active
 * stat bonuses. ComputedStats queries getConditionalBonuses() to fold
 * these bonuses into the final stat totals.
 */

import { inventory } from './Inventory';
import type { Affix, AffixDefinition, ConditionType } from '../loot/ItemTypes';
import { CONDITIONAL_AFFIXES } from '../loot/AffixPool';
import { world } from '../ecs/world';

// ── Stat bonus keys that conditional affixes can grant ─────────────────

export interface ConditionalBonuses {
  flatDamage: number;
  percentDamage: number;
  percentAttackSpeed: number;
  percentProjectileSpeed: number;
  flatArmor: number;
  hpRegen: number;
  percentMoveSpeed: number;
  percentCDR: number;
  flatHP: number;
}

function emptyBonuses(): ConditionalBonuses {
  return {
    flatDamage: 0,
    percentDamage: 0,
    percentAttackSpeed: 0,
    percentProjectileSpeed: 0,
    flatArmor: 0,
    hpRegen: 0,
    percentMoveSpeed: 0,
    percentCDR: 0,
    flatHP: 0,
  };
}

// ── Tracked player state ──────────────────────────────────────────────

/** Whether the player is currently moving (velocity > 0). */
let isMoving = false;

/** How long the player has been stationary, in milliseconds. */
let stationaryTimeMs = 0;

/** Timestamp of last damage taken (performance.now() style, but we use game-time seconds). */
let lastDamageTime = -Infinity;

/** Game-time accumulator in seconds (for comparing against lastDamageTime etc.). */
let gameTime = 0;

/** Recent kill timestamps (game-time seconds). */
const killTimestamps: number[] = [];

/** Timestamp of last skill usage (game-time seconds). */
let lastSkillTime = -Infinity;

/** Timestamp of last movement skill usage (game-time seconds). */
let lastMovementSkillTime = -Infinity;

/** Number of enemies hit simultaneously in the most recent attack (for multi-hit). */
let lastMultiHitCount = 0;

/** Timer for multi-hit buff tracking (game-time when the multi-hit event happened). */
let lastMultiHitTime = -Infinity;

// ── Active buff map ───────────────────────────────────────────────────

interface ActiveBuff {
  /** The stat key this buff modifies. */
  stat: string;
  /** The bonus value. */
  value: number;
  /** Remaining duration in seconds. */
  remaining: number;
}

/** Map from affix stat key to active buff state. */
const activeBuffs = new Map<string, ActiveBuff>();

// ── Definition lookup cache ───────────────────────────────────────────

/** Lookup table from affix stat key to its AffixDefinition (built once). */
const defByStat = new Map<string, AffixDefinition>();
for (const def of CONDITIONAL_AFFIXES) {
  defByStat.set(def.stat, def);
}

// ── Public event hooks (called from other systems) ────────────────────

/** Called by MovementSystem each frame with the player's current velocity magnitude. */
export function trackMovement(velocityMagnitude: number): void {
  const wasMoving = isMoving;
  isMoving = velocityMagnitude > 0.1;

  if (isMoving) {
    stationaryTimeMs = 0;
  } else if (!wasMoving) {
    // Already stationary, accumulate in update()
  }
}

/** Called when the player takes damage. */
export function trackDamageTaken(): void {
  lastDamageTime = gameTime;
}

/** Called when an enemy is killed. */
export function trackKill(): void {
  killTimestamps.push(gameTime);
}

/** Called when any skill is used. */
export function trackSkillUsed(): void {
  lastSkillTime = gameTime;
}

/** Called when a movement skill (Space slot) is used. */
export function trackMovementSkillUsed(): void {
  lastMovementSkillTime = gameTime;
}

/** Called when a projectile/attack hits multiple enemies in one frame. */
export function trackMultiHit(hitCount: number): void {
  if (hitCount > lastMultiHitCount || gameTime - lastMultiHitTime > 0.1) {
    lastMultiHitCount = hitCount;
    lastMultiHitTime = gameTime;
  }
}

// ── Core update (called each fixed step from Game.ts) ─────────────────

const TILE_SIZE = 32;

/**
 * Evaluate all equipped conditional affixes and maintain active buff timers.
 * Call once per fixed update step (60 Hz). dt is in seconds.
 */
export function conditionalAffixSystem(dt: number): void {
  gameTime += dt;

  // Update stationary timer
  if (!isMoving) {
    stationaryTimeMs += dt * 1000;
  }

  // Prune old kill timestamps (keep last 10 seconds)
  while (killTimestamps.length > 0 && killTimestamps[0] < gameTime - 10) {
    killTimestamps.shift();
  }

  // Tick down active buff durations
  for (const [key, buff] of activeBuffs) {
    buff.remaining -= dt;
    if (buff.remaining <= 0) {
      activeBuffs.delete(key);
    }
  }

  // Get player entity for HP checks and position
  const playerEntities = world.with('player', 'position', 'health').entities;
  if (playerEntities.length === 0) return;
  const player = playerEntities[0];

  // Get player stats for stat-breakpoint checks
  const playerStats = player.stats;

  // Collect all conditional affixes from equipped gear
  const equippedItems = [
    inventory.equipped.weapon,
    inventory.equipped.helmet,
    inventory.equipped.chest,
    inventory.equipped.boots,
    inventory.equipped.ring1,
    inventory.equipped.ring2,
    inventory.equipped.amulet,
    inventory.equipped.offhand,
  ];

  for (const item of equippedItems) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.category !== 'conditional') continue;

      const def = defByStat.get(affix.stat);
      if (!def || !def.conditionType) continue;

      const condMet = evaluateCondition(
        def.conditionType,
        def.conditionParams ?? {},
        player,
        playerStats,
      );

      if (condMet) {
        if (def.buffDuration && def.buffDuration > 0) {
          // Timed buff: activate/refresh
          const existing = activeBuffs.get(affix.stat);
          if (existing) {
            existing.remaining = def.buffDuration;
            existing.value = affix.value;
          } else {
            activeBuffs.set(affix.stat, {
              stat: affix.stat,
              value: affix.value,
              remaining: def.buffDuration,
            });
          }
        }
        // Passive (buffDuration 0) conditions are evaluated live in getConditionalBonuses
      }
    }
  }
}

// ── Condition evaluators ──────────────────────────────────────────────

function evaluateCondition(
  conditionType: ConditionType,
  params: Record<string, number | string>,
  player: { health: { current: number; max: number }; position: { x: number; y: number } },
  playerStats?: { dexterity: number; intelligence: number; vitality: number; focus: number },
): boolean {
  switch (conditionType) {
    case 'while-moving':
      return isMoving;

    case 'while-stationary': {
      const minMs = (params.minStationaryMs as number) ?? 500;
      return stationaryTimeMs >= minMs;
    }

    case 'on-kill':
      // "on-kill" triggers are instant effects; treat as always true for buff activation
      // The actual kill event was tracked; check if a kill happened recently (within this frame)
      return killTimestamps.length > 0 && gameTime - killTimestamps[killTimestamps.length - 1] < 0.02;

    case 'on-hit':
      // on-hit conditions are evaluated per-hit in the collision system, not here
      return false;

    case 'low-hp': {
      const threshold = (params.threshold as number) ?? 0.3;
      return player.health.max > 0 && player.health.current / player.health.max <= threshold;
    }

    case 'full-hp':
      return player.health.current >= player.health.max;

    case 'after-skill':
      // Check if a skill was used recently (within the buff window)
      return gameTime - lastSkillTime < 0.1;

    case 'after-movement-skill':
      return gameTime - lastMovementSkillTime < 0.1;

    case 'distance-close': {
      const tileRadius = (params.tileRadius as number) ?? 3;
      const radiusPx = tileRadius * TILE_SIZE;
      return hasEnemyWithinRadius(player.position, radiusPx);
    }

    case 'distance-far': {
      const tileRadius = (params.tileRadius as number) ?? 5;
      const radiusPx = tileRadius * TILE_SIZE;
      return !hasEnemyWithinRadius(player.position, radiusPx);
    }

    case 'stat-breakpoint': {
      if (!playerStats) return false;
      const statName = params.stat as string;
      const threshold = params.threshold as number;
      const statVal = (playerStats as Record<string, number>)[statName] ?? 0;
      return statVal >= threshold;
    }

    case 'kill-streak': {
      const killsRequired = (params.killsRequired as number) ?? 3;
      const windowSeconds = (params.windowSeconds as number) ?? 4;
      const cutoff = gameTime - windowSeconds;
      const recentKills = killTimestamps.filter(t => t >= cutoff).length;
      return recentKills >= killsRequired;
    }

    case 'status-on-target':
      // Evaluated per-hit in collision system, not here
      return false;

    case 'multi-hit': {
      const hitThreshold = (params.hitThreshold as number) ?? 3;
      // Check if we had a recent multi-hit event
      return lastMultiHitCount >= hitThreshold && gameTime - lastMultiHitTime < 0.1;
    }

    case 'recently-hit':
      // Triggers when player was recently damaged
      return gameTime - lastDamageTime < 0.1;

    case 'no-damage-taken': {
      const seconds = (params.seconds as number) ?? 5;
      return gameTime - lastDamageTime >= seconds;
    }

    default:
      return false;
  }
}

// ── Helper: check if any enemy is within a given radius ───────────────

const enemyQuery = world.with('enemy', 'position');

function hasEnemyWithinRadius(pos: { x: number; y: number }, radiusPx: number): boolean {
  const r2 = radiusPx * radiusPx;
  for (const enemy of enemyQuery) {
    const dx = enemy.position.x - pos.x;
    const dy = enemy.position.y - pos.y;
    if (dx * dx + dy * dy <= r2) return true;
  }
  return false;
}

// ── Public: get current conditional bonuses ───────────────────────────

/**
 * Returns the aggregate conditional bonuses from all currently active
 * conditional affixes. Called by ComputedStats during recalculation.
 */
export function getConditionalBonuses(): ConditionalBonuses {
  const bonuses = emptyBonuses();

  const playerEntities = world.with('player', 'position', 'health').entities;
  if (playerEntities.length === 0) return bonuses;
  const player = playerEntities[0];
  const playerStats = player.stats;

  // Collect all conditional affixes from equipped gear
  const equippedItems = [
    inventory.equipped.weapon,
    inventory.equipped.helmet,
    inventory.equipped.chest,
    inventory.equipped.boots,
    inventory.equipped.ring1,
    inventory.equipped.ring2,
    inventory.equipped.amulet,
    inventory.equipped.offhand,
  ];

  for (const item of equippedItems) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.category !== 'conditional') continue;

      const def = defByStat.get(affix.stat);
      if (!def || !def.conditionType) continue;

      let active = false;

      if (def.buffDuration && def.buffDuration > 0) {
        // Timed buff: check if active
        const buff = activeBuffs.get(affix.stat);
        if (buff && buff.remaining > 0) {
          active = true;
        }
      } else {
        // Passive: evaluate condition live
        active = evaluateCondition(
          def.conditionType,
          def.conditionParams ?? {},
          player,
          playerStats,
        );
      }

      if (active) {
        applyAffixBonus(bonuses, affix, def);
      }
    }
  }

  return bonuses;
}

/** Map an affix's stat key to the appropriate ConditionalBonuses field. */
function applyAffixBonus(bonuses: ConditionalBonuses, affix: Affix, def: AffixDefinition): void {
  const stat = affix.stat;
  const value = affix.value;

  // Map stat keys to bonus fields based on the design's effectType equivalent
  switch (stat) {
    // Percent damage bonuses
    case 'condMovingDamage':
    case 'condLowHPDamage':
    case 'condStationaryDamage':
    case 'condKillStreakDamage':
    case 'condAfterMoveDamage':
    case 'condMultiHitDamage':
    case 'condHitBurningDamage':
      bonuses.percentDamage += value;
      break;

    // Flat damage bonuses
    case 'condFullHPFlatDamage':
      bonuses.flatDamage += value;
      break;

    // Attack speed bonuses
    case 'condPostSkillAtkSpd':
    case 'condFullHPAtkSpd':
    case 'condHitSlowedAtkSpd':
      bonuses.percentAttackSpeed += value;
      break;

    // Projectile speed bonuses
    case 'condFarRangeProjSpeed':
      bonuses.percentProjectileSpeed += value;
      break;

    // Armor bonuses
    case 'condCloseRangeArmor':
    case 'condAfterSkillArmor':
    case 'condRecentlyHitArmor':
      bonuses.flatArmor += value;
      break;

    // HP regen bonuses
    case 'condLowHPRegen':
    case 'condHighVitRegen':
      bonuses.hpRegen += value;
      break;

    // Movement speed bonuses
    case 'condKillStreakSpeed':
    case 'condNoDamageTakenSpeed':
      bonuses.percentMoveSpeed += value;
      break;

    // CDR bonuses
    case 'condHighFocusCDR':
      bonuses.percentCDR += value;
      break;

    // Special cases handled elsewhere (on-kill heal, on-kill CDR, on-hit slow, proj count)
    case 'condOnKillHeal':
    case 'condOnKillCDR':
    case 'condOnHitSlow':
    case 'condHighDexProjCount':
      // These are instant/proc effects, not passive stat bonuses
      break;

    default:
      break;
  }
}

// ── Public: query equipped conditional affix values (for proc effects) ──

/**
 * Returns the total rolled value of a given conditional affix stat
 * across all equipped gear. Returns 0 if the affix is not equipped.
 * Used by CollisionSystem and skill code for proc-based effects
 * (on-kill heal, on-kill CDR, on-hit slow, extra projectile, etc.).
 */
export function getEquippedConditionalValue(statKey: string): number {
  let total = 0;
  const equippedItems = [
    inventory.equipped.weapon,
    inventory.equipped.helmet,
    inventory.equipped.chest,
    inventory.equipped.boots,
    inventory.equipped.ring1,
    inventory.equipped.ring2,
    inventory.equipped.amulet,
    inventory.equipped.offhand,
  ];

  for (const item of equippedItems) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.stat === statKey) {
        total += affix.value;
      }
    }
  }
  return total;
}

/**
 * Returns the bonus damage multiplier for status-on-target conditional affixes.
 * Checks the target enemy's status effects and returns the additive bonus percent.
 * Called per-hit in CollisionSystem before damage is dealt.
 */
export function getStatusOnTargetDamageBonus(enemy: {
  statusEffects?: { type: number }[];
}): number {
  // Import StatusType values locally to avoid circular dependency issues
  // StatusType.Burn = 2, StatusType.Slow = 0, StatusType.Chill = 1
  const BURN = 2;
  const SLOW = 0;
  const CHILL = 1;

  let bonusPct = 0;

  const burningVal = getEquippedConditionalValue('condHitBurningDamage');
  if (burningVal > 0 && enemy.statusEffects?.some(e => e.type === BURN)) {
    bonusPct += burningVal;
  }

  return bonusPct;
}

/**
 * Returns bonus attack speed percent from hitting slowed/chilled enemies.
 * This is a per-hit check -- the bonus is reflected in ConditionalBonuses
 * via the status-on-target passive evaluation path, but for real-time
 * accuracy we also check here.
 */
export function getStatusOnTargetAtkSpdBonus(enemy: {
  statusEffects?: { type: number }[];
}): number {
  const SLOW = 0;
  const CHILL = 1;

  let bonusPct = 0;

  const slowVal = getEquippedConditionalValue('condHitSlowedAtkSpd');
  if (slowVal > 0 && enemy.statusEffects?.some(e => e.type === SLOW || e.type === CHILL)) {
    bonusPct += slowVal;
  }

  return bonusPct;
}

/**
 * Check if the high-Dex +1 projectile conditional is active.
 * Requires both the affix to be equipped AND dexterity >= 25.
 */
export function hasExtraProjectileConditional(): boolean {
  const val = getEquippedConditionalValue('condHighDexProjCount');
  if (val <= 0) return false;

  const playerEntities = world.with('player', 'position', 'health').entities;
  if (playerEntities.length === 0) return false;
  const playerStats = playerEntities[0].stats;
  if (!playerStats) return false;

  return playerStats.dexterity >= 25;
}

// ── Reset (called on zone transition, class switch, etc.) ─────────────

export function resetConditionalState(): void {
  isMoving = false;
  stationaryTimeMs = 0;
  lastDamageTime = -Infinity;
  lastSkillTime = -Infinity;
  lastMovementSkillTime = -Infinity;
  lastMultiHitCount = 0;
  lastMultiHitTime = -Infinity;
  killTimestamps.length = 0;
  activeBuffs.clear();
  gameTime = 0;
}
