import { BaseItem, Rarity } from './ItemTypes';
import { materials, MaterialType } from './Materials';
import { rollAffixes } from './AffixRoller';

export interface Recipe {
  name: string;
  description: string;
  cost: Partial<Record<MaterialType, number>>;
  /** Returns true if this recipe can be applied to the given item. */
  canApply: (item: BaseItem) => boolean;
  /** Apply the recipe to the item. Returns the modified item. */
  apply: (item: BaseItem) => BaseItem;
}

/**
 * Reroll Affixes: 3 Crystals
 * Rerolls all affixes on the item (same count, new random values).
 * Only works on Magic or Rare items.
 */
const rerollAffixes: Recipe = {
  name: 'Reroll Affixes',
  description: '3 Crystals: Reroll all affixes (same count, new random values)',
  cost: { crystal: 3 },
  canApply: (item: BaseItem) =>
    item.rarity === Rarity.Magic || item.rarity === Rarity.Rare,
  apply: (item: BaseItem): BaseItem => {
    const count = item.affixes.length;
    // Roll new affixes of the same count
    let newAffixes = rollAffixes(item.rarity, item.level, item.slot);
    // If the new roll doesn't match count, keep rerolling (edge case with conditional chance)
    // But to keep it simple, just ensure we have at least 'count' by slicing or padding
    while (newAffixes.length < count) {
      const extra = rollAffixes(item.rarity, item.level, item.slot);
      for (const a of extra) {
        if (newAffixes.length >= count) break;
        if (!newAffixes.find((e) => e.id === a.id)) {
          newAffixes.push(a);
        }
      }
    }
    newAffixes = newAffixes.slice(0, count);

    return { ...item, affixes: newAffixes };
  },
};

/**
 * Upgrade Rarity: 5 Essences + 2 Crystals
 * Upgrades Normal -> Magic or Magic -> Rare (adds affixes accordingly).
 */
const upgradeRarity: Recipe = {
  name: 'Upgrade Rarity',
  description: '5 Essences + 2 Crystals: Upgrade Normal->Magic or Magic->Rare',
  cost: { essence: 5, crystal: 2 },
  canApply: (item: BaseItem) =>
    item.rarity === Rarity.Normal || item.rarity === Rarity.Magic,
  apply: (item: BaseItem): BaseItem => {
    const newRarity = item.rarity === Rarity.Normal ? Rarity.Magic : Rarity.Rare;
    const newAffixes = rollAffixes(newRarity, item.level, item.slot);
    return { ...item, rarity: newRarity, affixes: newAffixes };
  },
};

/**
 * Add Socket: 1 Prism
 * Adds a gem socket to an item. Max 1 socket per item.
 */
const addSocket: Recipe = {
  name: 'Add Socket',
  description: '1 Prism: Add a gem socket (max 1)',
  cost: { prism: 1 },
  canApply: (item: BaseItem) => !item.socket,
  apply: (item: BaseItem): BaseItem => {
    return { ...item, socket: {} };
  },
};

/** All available crafting recipes */
export const RECIPES: Recipe[] = [rerollAffixes, upgradeRarity, addSocket];

/**
 * Attempt to craft using a recipe on a target item.
 * Returns the crafted item, or null if materials are insufficient or recipe can't apply.
 */
export function craft(recipe: Recipe, item: BaseItem): BaseItem | null {
  if (!recipe.canApply(item)) return null;
  if (!materials.spend(recipe.cost)) return null;
  return recipe.apply(item);
}
