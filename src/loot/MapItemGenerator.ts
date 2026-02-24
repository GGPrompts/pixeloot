import { MapItem, MapModifier, MAP_MODIFIER_POOL } from './MapItem';

let nextMapId = 0;

function makeMapId(): string {
  return `map_${Date.now()}_${nextMapId++}`;
}

/**
 * Generate a map item of the given tier (1-5).
 *
 * - Modifier count equals tier (T1=1, T2=2, ... T5=5).
 * - Quantity bonus: 10% per tier.
 * - Rarity bonus: 5% per tier.
 * - Modifiers are drawn without duplicates from the pool.
 */
export function generateMapItem(tier: number): MapItem {
  const clampedTier = Math.max(1, Math.min(5, Math.round(tier)));
  const modCount = clampedTier;

  // Shuffle and pick modifiers without duplicates
  const shuffled = [...MAP_MODIFIER_POOL].sort(() => Math.random() - 0.5);
  const modifiers: MapModifier[] = shuffled.slice(0, modCount);

  return {
    id: makeMapId(),
    tier: clampedTier,
    modifiers,
    quantityBonus: clampedTier * 10,
    rarityBonus: clampedTier * 5,
  };
}
