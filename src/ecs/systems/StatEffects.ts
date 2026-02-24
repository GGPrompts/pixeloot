import type { Entity } from '../world';
import { markStatsDirty, applyComputedToEntity } from '../../core/ComputedStats';

/**
 * Applies passive stat effects to the player entity.
 * Called whenever a stat point is allocated.
 * Uses ComputedStats to aggregate base + gear + stat point bonuses.
 *
 * Stat effects (via ComputedStats):
 * - Dexterity: +5% projectile speed per point, +3% attack speed per point
 * - Intelligence: +8% skill damage per point
 * - Vitality: +10 max HP per point + gear bonuses
 * - Focus: +5% cooldown reduction per point
 */
export function applyStatEffects(
  player: Entity & {
    stats: { dexterity: number; intelligence: number; vitality: number; focus: number };
    health: { current: number; max: number };
    baseSpeed?: number;
    speed?: number;
  },
): void {
  // Mark dirty so computed stats reflect the new stat allocation
  markStatsDirty();
  // Apply computed maxHP, moveSpeed, etc. to the player entity
  applyComputedToEntity(player);
}

/**
 * Returns the projectile speed multiplier based on dexterity.
 * +5% per point.
 */
export function getProjectileSpeedMultiplier(dex: number): number {
  return 1 + dex * 0.05;
}

/**
 * Returns the fire cooldown multiplier based on dexterity.
 * +3% attack speed per point means cooldown is reduced.
 */
export function getAttackSpeedMultiplier(dex: number): number {
  return 1 / (1 + dex * 0.03);
}

/**
 * Returns the skill damage multiplier based on intelligence.
 * +8% per point.
 */
export function getDamageMultiplier(int: number): number {
  return 1 + int * 0.08;
}

/**
 * Returns the cooldown reduction multiplier based on focus.
 * +5% per point (multiplicative reduction).
 */
export function getCooldownMultiplier(focus: number): number {
  return 1 / (1 + focus * 0.05);
}
