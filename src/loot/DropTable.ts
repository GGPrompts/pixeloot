import { BaseItem, Slot } from './ItemTypes';
import { generateItem } from './ItemGenerator';

/** Drop chance per enemy type (0-1) */
const ITEM_DROP_CHANCE: Record<string, number> = {
  swarm: 0.05,
  rusher: 0.10,
  flanker: 0.15,
  sniper: 0.15,
  tank: 0.25,
  boss: 1.0,
};

/** Number of items a boss drops */
const BOSS_MIN_ITEMS = 3;
const BOSS_MAX_ITEMS = 5;

/** Base gold range */
const GOLD_BASE_MIN = 5;
const GOLD_BASE_MAX = 15;

/** All equippable slots for random item generation */
const ALL_SLOTS = [Slot.Weapon, Slot.Helmet, Slot.Chest, Slot.Boots, Slot.Ring, Slot.Amulet];

function randomSlot(): Slot {
  return ALL_SLOTS[Math.floor(Math.random() * ALL_SLOTS.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Roll drops for a defeated enemy.
 * Returns a list of items and a gold amount.
 */
export function rollDrops(
  enemyType: string,
  monsterLevel: number,
): { items: BaseItem[]; gold: number } {
  // Gold always drops, scaled by level
  const gold = randomInt(GOLD_BASE_MIN, GOLD_BASE_MAX) + Math.floor(monsterLevel * 1.5);

  const items: BaseItem[] = [];
  const type = enemyType.toLowerCase();
  const dropChance = ITEM_DROP_CHANCE[type] ?? 0.10;

  if (type === 'boss') {
    // Boss always drops multiple items
    const count = randomInt(BOSS_MIN_ITEMS, BOSS_MAX_ITEMS);
    for (let i = 0; i < count; i++) {
      items.push(generateItem(randomSlot(), monsterLevel));
    }
  } else {
    // Standard enemies: single roll
    if (Math.random() < dropChance) {
      items.push(generateItem(randomSlot(), monsterLevel));
    }
  }

  return { items, gold };
}
