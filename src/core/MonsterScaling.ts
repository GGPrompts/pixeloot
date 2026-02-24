/**
 * Monster level scaling formulas.
 *
 * Monster Level = max(MapBaseLevel, PlayerLevel - 2) + MapTierBonus
 *
 * Stats scale exponentially per level above 1:
 *   Health  +12% per level
 *   Damage  +8%  per level
 *   XP      +10% per level
 */

export interface ScalingConfig {
  /** Minimum monster level for this map. */
  mapBaseLevel: number;
  /** Bonus levels from map tier (+0 to +5). */
  mapTierBonus: number;
}

/** Default config: base map, no tier bonus. */
export const DEFAULT_SCALING_CONFIG: ScalingConfig = {
  mapBaseLevel: 1,
  mapTierBonus: 0,
};

/**
 * Calculates the monster level based on the player level and map config.
 *
 * Formula: max(mapBaseLevel, playerLevel - 2) + mapTierBonus
 */
export function getMonsterLevel(playerLevel: number, config: ScalingConfig = DEFAULT_SCALING_CONFIG): number {
  return Math.max(config.mapBaseLevel, playerLevel - 2) + config.mapTierBonus;
}

/**
 * Scale a base health value for a given monster level.
 * +12% compounding per level above 1.
 */
export function scaleHealth(baseHP: number, monsterLevel: number): number {
  return Math.round(baseHP * Math.pow(1.12, monsterLevel - 1));
}

/**
 * Scale a base damage value for a given monster level.
 * +8% compounding per level above 1.
 */
export function scaleDamage(baseDmg: number, monsterLevel: number): number {
  return Math.round(baseDmg * Math.pow(1.08, monsterLevel - 1));
}

/**
 * Scale a base XP value for a given monster level.
 * +10% compounding per level above 1.
 */
export function scaleXP(baseXP: number, monsterLevel: number): number {
  return Math.round(baseXP * Math.pow(1.10, monsterLevel - 1));
}
