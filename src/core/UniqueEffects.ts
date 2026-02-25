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
