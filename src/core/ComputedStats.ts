import { inventory, type EquipSlots } from './Inventory';
import type { BaseItem } from '../loot/ItemTypes';
import { GEM_BONUSES } from '../loot/Gems';
import {
  getProjectileSpeedMultiplier,
  getDamageMultiplier,
  getAttackSpeedMultiplier,
  getCooldownMultiplier,
} from '../ecs/systems/StatEffects';

// ── FinalStats Interface ────────────────────────────────────────────

export interface FinalStats {
  // Offensive
  damage: number;          // final damage per hit
  attackSpeed: number;     // attacks per second (fire rate multiplier)
  projectileSpeed: number; // multiplier on base projectile speed
  critChance: number;      // 0-1
  critMultiplier: number;  // default 1.5x

  // Defensive
  maxHP: number;
  armor: number;
  damageReduction: number; // from armor, 0-1
  hpRegen: number;         // per second

  // Utility
  moveSpeed: number;       // pixels per second (base 200)
  cooldownReduction: number; // 0-1, capped at 0.4
  xpMultiplier: number;
  goldMultiplier: number;
}

// ── Affix Aggregation ───────────────────────────────────────────────

interface AffixTotals {
  flatDamage: number;
  percentDamage: number;
  percentAttackSpeed: number;
  percentProjectileSpeed: number;
  percentCritChance: number;
  flatHP: number;
  percentHP: number;
  flatArmor: number;
  hpRegen: number;
  percentMoveSpeed: number;
  percentXPGain: number;
  percentGoldFind: number;
  percentCDR: number;
}

function emptyTotals(): AffixTotals {
  return {
    flatDamage: 0,
    percentDamage: 0,
    percentAttackSpeed: 0,
    percentProjectileSpeed: 0,
    percentCritChance: 0,
    flatHP: 0,
    percentHP: 0,
    flatArmor: 0,
    hpRegen: 0,
    percentMoveSpeed: 0,
    percentXPGain: 0,
    percentGoldFind: 0,
    percentCDR: 0,
  };
}

function aggregateAffixes(items: (BaseItem | null)[]): AffixTotals {
  const totals = emptyTotals();

  for (const item of items) {
    if (!item) continue;
    for (const affix of item.affixes) {
      if (affix.stat in totals) {
        totals[affix.stat as keyof AffixTotals] += affix.value;
      }
    }
    // Add gem socket bonuses
    if (item.socket?.gem) {
      const bonus = GEM_BONUSES[item.socket.gem.type];
      if (bonus && bonus.stat in totals) {
        totals[bonus.stat as keyof AffixTotals] += bonus.value;
      }
    }
  }

  return totals;
}

function getEquippedItems(): (BaseItem | null)[] {
  const slots = inventory.equipped;
  return [
    slots.weapon,
    slots.helmet,
    slots.chest,
    slots.boots,
    slots.ring1,
    slots.ring2,
    slots.amulet,
    slots.offhand,
  ];
}

// ── Cached Stats ────────────────────────────────────────────────────

const BASE_MOVE_SPEED = 200;
const BASE_MAX_HP = 100;
const BASE_CRIT_MULTIPLIER = 1.5;

let cachedStats: FinalStats = createDefaultStats();
let dirty = true;

function createDefaultStats(): FinalStats {
  return {
    damage: 10,
    attackSpeed: 1,
    projectileSpeed: 1,
    critChance: 0,
    critMultiplier: BASE_CRIT_MULTIPLIER,
    maxHP: BASE_MAX_HP,
    armor: 0,
    damageReduction: 0,
    hpRegen: 0,
    moveSpeed: BASE_MOVE_SPEED,
    cooldownReduction: 0,
    xpMultiplier: 1,
    goldMultiplier: 1,
  };
}

// ── Player Stats Access ─────────────────────────────────────────────

/** Cached reference to current player stats. Set via setPlayerStats(). */
let playerStats: { dexterity: number; intelligence: number; vitality: number; focus: number } | null = null;

/**
 * Set the player stat allocation reference so ComputedStats can read stat points.
 * Call once after player entity is created.
 */
export function setPlayerStats(stats: { dexterity: number; intelligence: number; vitality: number; focus: number }): void {
  playerStats = stats;
}

// ── Recalculation ───────────────────────────────────────────────────

/**
 * Mark stats as dirty so next getComputedStats() call triggers recalculation.
 * Call this on equip/unequip and on stat point allocation.
 */
export function markStatsDirty(): void {
  dirty = true;
}

/**
 * Recalculate all final stats from base + gear + stat points.
 * Returns the newly computed stats.
 */
export function recalculateStats(): FinalStats {
  const items = getEquippedItems();
  const affixes = aggregateAffixes(items);

  const dex = playerStats?.dexterity ?? 0;
  const int = playerStats?.intelligence ?? 0;
  const vit = playerStats?.vitality ?? 0;
  const focus = playerStats?.focus ?? 0;

  // ── Base armor from gear base stats ──
  let totalBaseArmor = 0;
  for (const item of items) {
    if (item?.baseStats.armor) {
      totalBaseArmor += item.baseStats.armor;
    }
  }

  // ── Offensive ──

  // Damage: (baseWeaponDmg + flatBonuses) * (1 + sumPercentBonuses/100) * statMultiplier
  const weapon = inventory.equipped.weapon;
  const baseWeaponDmg = weapon?.baseStats.damage ?? 10;
  const finalDamage = (baseWeaponDmg + affixes.flatDamage)
    * (1 + affixes.percentDamage / 100)
    * getDamageMultiplier(int);

  // Attack speed: base weapon fire rate * (1 + percentAttackSpeed/100) * dex multiplier
  // getAttackSpeedMultiplier returns a cooldown multiplier (< 1 means faster).
  // We convert to an attacks-per-second multiplier: 1 / getAttackSpeedMultiplier
  const atkSpeedFromGear = 1 + affixes.percentAttackSpeed / 100;
  const atkSpeedFromDex = 1 / getAttackSpeedMultiplier(dex); // converts cooldown reduction to speed multiplier
  const attackSpeed = atkSpeedFromGear * atkSpeedFromDex;

  // Projectile speed multiplier
  const projSpeedFromGear = 1 + affixes.percentProjectileSpeed / 100;
  const projSpeedFromDex = getProjectileSpeedMultiplier(dex);
  const projectileSpeed = projSpeedFromGear * projSpeedFromDex;

  // Crit chance (affix values are already percentages, e.g. 5 = 5%)
  const critChance = Math.min(affixes.percentCritChance / 100, 1);

  // ── Defensive ──

  // Max HP: (100 + vitalityBonus + flatHPAffixes) * (1 + percentHPAffixes/100)
  const vitalityBonus = vit * 10;
  const maxHP = (BASE_MAX_HP + vitalityBonus + affixes.flatHP) * (1 + affixes.percentHP / 100);

  // Armor: base armor from gear + flat armor affixes
  const armor = totalBaseArmor + affixes.flatArmor;

  // Damage reduction: armor / (armor + 100) -- diminishing returns
  const damageReduction = armor / (armor + 100);

  // HP regen
  const hpRegen = affixes.hpRegen;

  // ── Utility ──

  // Move speed
  const moveSpeed = BASE_MOVE_SPEED * (1 + affixes.percentMoveSpeed / 100);

  // Cooldown reduction: combine gear CDR with focus stat CDR, cap at 40%
  // Focus gives multiplicative reduction via getCooldownMultiplier
  // Gear gives additive percentage
  const gearCDR = affixes.percentCDR / 100;
  const focusCDRMultiplier = getCooldownMultiplier(focus); // e.g. 0.8 for 20% CDR
  const focusCDR = 1 - focusCDRMultiplier; // convert to additive (e.g. 0.2)
  const totalCDR = Math.min(gearCDR + focusCDR, 0.4);

  // XP multiplier
  const xpMultiplier = 1 + affixes.percentXPGain / 100;

  // Gold multiplier
  const goldMultiplier = 1 + affixes.percentGoldFind / 100;

  cachedStats = {
    damage: Math.round(finalDamage),
    attackSpeed,
    projectileSpeed,
    critChance,
    critMultiplier: BASE_CRIT_MULTIPLIER,
    maxHP: Math.round(maxHP),
    armor,
    damageReduction,
    hpRegen,
    moveSpeed,
    cooldownReduction: totalCDR,
    xpMultiplier,
    goldMultiplier,
  };

  dirty = false;
  return cachedStats;
}

/**
 * Get the current computed stats. Recalculates only if dirty.
 */
export function getComputedStats(): FinalStats {
  if (dirty) {
    recalculateStats();
  }
  return cachedStats;
}

/**
 * Apply computed stats to a player entity's health and movement.
 * Call after equip/unequip or stat allocation to sync entity state.
 */
export function applyComputedToEntity(
  player: {
    health: { current: number; max: number };
    baseSpeed?: number;
    speed?: number;
  },
): void {
  const computed = getComputedStats();

  // Update max HP, heal difference when gaining
  const hpDiff = computed.maxHP - player.health.max;
  player.health.max = computed.maxHP;
  if (hpDiff > 0) {
    player.health.current = Math.min(player.health.current + hpDiff, player.health.max);
  }
  // Clamp current HP if max decreased
  if (player.health.current > player.health.max) {
    player.health.current = player.health.max;
  }

  // Update base move speed (StatusEffectSystem applies debuffs on top)
  if (player.baseSpeed !== undefined) {
    player.baseSpeed = computed.moveSpeed;
    if (player.speed !== undefined) {
      player.speed = computed.moveSpeed;
    }
  }
}
