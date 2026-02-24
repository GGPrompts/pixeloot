import type { Entity } from '../world';

const BASE_MAX_HP = 100;

/**
 * Applies passive stat effects to the player entity.
 * Called whenever a stat point is allocated.
 *
 * Stat effects:
 * - Dexterity: +5% projectile speed per point, +3% attack speed per point
 * - Intelligence: +8% skill damage per point (multiplier stored on entity)
 * - Vitality: +10 max HP per point
 * - Focus: +5% cooldown reduction per point
 */
export function applyStatEffects(
  player: Entity & { stats: { dexterity: number; intelligence: number; vitality: number; focus: number }; health: { current: number; max: number } },
): void {
  const { stats, health } = player;

  // Vitality: +10 max HP per point
  const newMax = BASE_MAX_HP + stats.vitality * 10;
  const hpDiff = newMax - health.max;
  health.max = newMax;
  // When gaining max HP, also heal for the gained amount
  if (hpDiff > 0) {
    health.current = Math.min(health.current + hpDiff, health.max);
  }
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
