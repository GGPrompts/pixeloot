import { BaseItem, BaseStats, Rarity, Slot } from './ItemTypes';
import { pickRandomTemplate } from './BaseItems';
import { rollAffixes } from './AffixRoller';
import { generateName } from './NameGenerator';

let nextId = 0;

/** Generate a unique item ID */
function makeId(): string {
  return `item_${Date.now()}_${nextId++}`;
}

/**
 * Roll a random rarity if none is specified.
 * Normal 50%, Magic 35%, Rare 14%, Unique 1%
 */
function rollRarity(): Rarity {
  const roll = Math.random() * 100;
  if (roll < 50) return Rarity.Normal;
  if (roll < 85) return Rarity.Magic;
  if (roll < 99) return Rarity.Rare;
  return Rarity.Unique;
}

/**
 * Scale base stats by item level.
 * Higher level items get proportionally stronger base stats.
 */
function scaleBaseStats(stats: BaseStats, itemLevel: number): BaseStats {
  const factor = 1 + (itemLevel - 1) * 0.08;
  const scaled: BaseStats = {};

  if (stats.damage !== undefined) {
    scaled.damage = Math.round(stats.damage * factor);
  }
  if (stats.armor !== undefined) {
    scaled.armor = Math.round(stats.armor * factor);
  }
  if (stats.attackSpeed !== undefined) {
    // Attack speed scales much more slowly
    scaled.attackSpeed = Math.round(stats.attackSpeed * (1 + (itemLevel - 1) * 0.01) * 100) / 100;
  }

  return scaled;
}

/**
 * Generate a complete item for a given slot and level.
 *
 * @param slot - The equipment slot to generate for
 * @param itemLevel - The item level (affects stat ranges and affix rolls)
 * @param rarity - Optional forced rarity; if omitted, rolled randomly
 * @returns A fully formed BaseItem with stats, affixes, and a generated name
 */
export function generateItem(
  slot: Slot,
  itemLevel: number,
  rarity?: Rarity,
): BaseItem {
  const finalRarity = rarity ?? rollRarity();
  const template = pickRandomTemplate(slot);
  const baseStats = scaleBaseStats(template.baseStats, itemLevel);
  const affixes = rollAffixes(finalRarity, itemLevel, slot);
  const name = generateName(template.name, finalRarity, affixes);

  return {
    id: makeId(),
    name,
    slot,
    rarity: finalRarity,
    level: itemLevel,
    baseStats,
    affixes,
    ...(template.weaponType !== undefined && { weaponType: template.weaponType }),
  };
}
