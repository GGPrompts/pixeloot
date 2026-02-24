import { Affix, AffixCategory, Rarity } from './ItemTypes';

/** Prefixes associated with each affix category */
const PREFIXES: Record<AffixCategory, string[]> = {
  offensive: ['Deadly', 'Savage', 'Swift', 'Fierce', 'Brutal', 'Vicious'],
  defensive: ['Sturdy', 'Stalwart', 'Fortified', 'Resilient', 'Guarded', 'Ironclad'],
  utility: ['Nimble', 'Lucky', 'Wise', 'Keen', 'Resourceful', 'Cunning'],
  conditional: ['Volatile', 'Mystic', 'Primal', 'Arcane', 'Wrathful', 'Eldritch'],
};

/** Suffixes associated with each affix category */
const SUFFIXES: Record<AffixCategory, string[]> = {
  offensive: ['of Power', 'of Might', 'of Fury', 'of Slaughter', 'of Ruin'],
  defensive: ['of the Bear', 'of the Fortress', 'of Warding', 'of Endurance', 'of the Wall'],
  utility: ['of Haste', 'of Fortune', 'of Insight', 'of the Wind', 'of Discovery'],
  conditional: ['of the Storm', 'of Vengeance', 'of Rebirth', 'of Twilight', 'of the Phoenix'],
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Determine the dominant affix category from a list of affixes.
 * Falls back to 'offensive' if the list is empty.
 */
function dominantCategory(affixes: Affix[]): AffixCategory {
  if (affixes.length === 0) return 'offensive';

  const counts: Partial<Record<AffixCategory, number>> = {};
  for (const a of affixes) {
    counts[a.category] = (counts[a.category] ?? 0) + 1;
  }

  let best: AffixCategory = affixes[0].category;
  let bestCount = 0;
  for (const [cat, count] of Object.entries(counts) as [AffixCategory, number][]) {
    if (count > bestCount) {
      bestCount = count;
      best = cat;
    }
  }
  return best;
}

/**
 * Generate a display name for an item.
 *
 * - Normal: just the base name (e.g., "Short Bow")
 * - Magic: prefix OR suffix (e.g., "Swift Short Bow" or "Short Bow of Power")
 * - Rare: prefix AND suffix (e.g., "Savage Short Bow of the Bear")
 * - Unique: uses the provided uniqueName
 */
export function generateName(
  baseName: string,
  rarity: Rarity,
  affixes: Affix[],
  uniqueName?: string,
): string {
  if (rarity === Rarity.Unique && uniqueName) {
    return uniqueName;
  }

  if (rarity === Rarity.Normal) {
    return baseName;
  }

  const category = dominantCategory(affixes);

  if (rarity === Rarity.Magic) {
    // 50/50 prefix or suffix
    if (Math.random() < 0.5) {
      return `${pickRandom(PREFIXES[category])} ${baseName}`;
    }
    return `${baseName} ${pickRandom(SUFFIXES[category])}`;
  }

  if (rarity === Rarity.Rare) {
    // Use prefix from first affix category, suffix from another if available
    const categories = [...new Set(affixes.map((a) => a.category))];
    const prefixCat = categories[0] ?? category;
    const suffixCat = categories.length > 1 ? categories[1] : category;
    return `${pickRandom(PREFIXES[prefixCat])} ${baseName} ${pickRandom(SUFFIXES[suffixCat])}`;
  }

  return baseName;
}
