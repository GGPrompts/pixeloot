import { BaseItem, Rarity } from './ItemTypes';
import { materials, MaterialType } from './Materials';

interface SalvageResult {
  material: MaterialType;
  amount: number;
}

/** Rarity-to-material mapping with amount ranges [min, max] */
const SALVAGE_TABLE: Record<Rarity, { material: MaterialType; min: number; max: number }> = {
  [Rarity.Normal]: { material: 'scrap', min: 1, max: 3 },
  [Rarity.Magic]: { material: 'essence', min: 1, max: 2 },
  [Rarity.Rare]: { material: 'crystal', min: 1, max: 1 },
  [Rarity.Unique]: { material: 'prism', min: 1, max: 1 },
};

/**
 * Salvage an item into crafting materials.
 * The material type and amount depend on item rarity.
 */
export function salvageItem(item: BaseItem): SalvageResult {
  const entry = SALVAGE_TABLE[item.rarity];
  const amount = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));

  materials.add(entry.material, amount);

  return { material: entry.material, amount };
}
