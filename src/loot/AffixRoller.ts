import { Affix, AffixDefinition, Rarity, Slot } from './ItemTypes';
import { REGULAR_AFFIXES, CONDITIONAL_AFFIXES } from './AffixPool';

/** Number of affixes per rarity tier: [min, max] */
const AFFIX_COUNTS: Record<number, [number, number]> = {
  [Rarity.Normal]: [0, 0],
  [Rarity.Magic]: [1, 2],
  [Rarity.Rare]: [3, 4],
  [Rarity.Unique]: [0, 0], // Unique items have fixed affixes
};

/** Chance that one regular affix is replaced by a conditional (Rare+ only) */
const CONDITIONAL_CHANCE = 0.15;

/**
 * Pick a random item from an array using weighted selection.
 * Each item must have a `weight` property.
 */
function weightedPick<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Roll a value for an affix, scaled by item level.
 *
 * The base range is [minValue, maxValue]. Item level scales the effective
 * range -- higher levels push the roll toward the upper end.
 * A 30-50% variance is applied around the scaled midpoint.
 */
function rollValue(def: AffixDefinition, itemLevel: number): number {
  const range = def.maxValue - def.minValue;
  // Level factor: 0.3 at level 1, approaches 1.0 around level 50+
  const levelFactor = Math.min(1, 0.3 + (itemLevel / 70));
  const scaledMid = def.minValue + range * levelFactor;

  // Variance: 30-50% of the base range
  const variancePct = 0.3 + Math.random() * 0.2; // 0.30 - 0.50
  const variance = range * variancePct;
  const value = scaledMid + (Math.random() - 0.5) * variance;

  // Clamp to [minValue, maxValue] and round to 1 decimal
  return Math.round(Math.max(def.minValue, Math.min(def.maxValue, value)) * 10) / 10;
}

/**
 * Instantiate an Affix from a definition at a given item level.
 */
function instantiateAffix(def: AffixDefinition, itemLevel: number): Affix {
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    stat: def.stat,
    value: rollValue(def, itemLevel),
    minValue: def.minValue,
    maxValue: def.maxValue,
  };
}

/**
 * Roll affixes for an item based on its rarity, level, and slot.
 *
 * - Normal: 0 affixes
 * - Magic: 1-2 affixes
 * - Rare: 3-4 affixes (15% chance one is conditional)
 * - Unique: returns empty array (unique items have fixed affixes)
 *
 * No duplicate affix types will appear on the same item.
 */
export function rollAffixes(
  rarity: Rarity,
  itemLevel: number,
  _slot: Slot,
): Affix[] {
  const countRange = AFFIX_COUNTS[rarity];
  if (!countRange) return [];

  const [min, max] = countRange;
  if (max === 0) return [];

  const count = min + Math.floor(Math.random() * (max - min + 1));
  const usedIds = new Set<string>();
  const affixes: Affix[] = [];

  // Determine how many regular vs conditional slots
  let regularSlots = count;
  let conditionalSlots = 0;

  if (rarity >= Rarity.Rare && count > 0 && Math.random() < CONDITIONAL_CHANCE) {
    conditionalSlots = 1;
    regularSlots = count - 1;
  }

  // Pick regular affixes
  const availableRegular = [...REGULAR_AFFIXES];
  for (let i = 0; i < regularSlots; i++) {
    const eligible = availableRegular.filter((a) => !usedIds.has(a.id));
    if (eligible.length === 0) break;

    const picked = weightedPick(eligible);
    usedIds.add(picked.id);
    affixes.push(instantiateAffix(picked, itemLevel));
  }

  // Pick conditional affixes
  if (conditionalSlots > 0) {
    const eligibleConditional = CONDITIONAL_AFFIXES.filter((a) => !usedIds.has(a.id));
    if (eligibleConditional.length > 0) {
      const picked = weightedPick(eligibleConditional);
      usedIds.add(picked.id);
      affixes.push(instantiateAffix(picked, itemLevel));
    }
  }

  return affixes;
}
