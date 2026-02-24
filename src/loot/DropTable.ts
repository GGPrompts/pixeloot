import { BaseItem, Slot } from './ItemTypes';
import { generateItem } from './ItemGenerator';
import type { MapItem } from './MapItem';
import { generateMapItem } from './MapItemGenerator';
import { getRarityBonus } from '../core/MapDevice';
import { Gem, generateGem, GEM_DROP_CHANCE } from './Gems';

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

/** Map drop chances */
const MAP_DROP_CHANCE_REGULAR = 0.02; // 2% from regular enemies
const MAP_DROP_CHANCE_BOSS = 1.0;     // guaranteed from bosses

/** All equippable slots for random item generation */
const ALL_SLOTS = [Slot.Weapon, Slot.Helmet, Slot.Chest, Slot.Boots, Slot.Ring, Slot.Amulet];

function randomSlot(): Slot {
  return ALL_SLOTS[Math.floor(Math.random() * ALL_SLOTS.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Roll a random map tier for boss drops (T1-T3 guaranteed).
 */
function rollBossMapTier(): number {
  const roll = Math.random();
  if (roll < 0.5) return 1;
  if (roll < 0.85) return 2;
  return 3;
}

/**
 * Roll a random map tier for regular enemy drops (T1-T2, rarely T3).
 */
function rollRegularMapTier(): number {
  const roll = Math.random();
  if (roll < 0.7) return 1;
  if (roll < 0.95) return 2;
  return 3;
}

/**
 * Roll drops for a defeated enemy.
 * Returns a list of items, a gold amount, and optionally a map item.
 */
export function rollDrops(
  enemyType: string,
  monsterLevel: number,
): { items: BaseItem[]; gold: number; mapItem?: MapItem; gem?: Gem } {
  // Gold always drops, scaled by level
  const gold = randomInt(GOLD_BASE_MIN, GOLD_BASE_MAX) + Math.floor(monsterLevel * 1.5);

  const items: BaseItem[] = [];
  const type = enemyType.toLowerCase();
  const dropChance = ITEM_DROP_CHANCE[type] ?? 0.10;

  // Apply rarity bonus from active map modifiers
  const rarityBonus = getRarityBonus();
  const adjustedDropChance = dropChance * (1 + rarityBonus / 100);

  let mapItem: MapItem | undefined;

  if (type === 'boss') {
    // Boss always drops multiple items
    const count = randomInt(BOSS_MIN_ITEMS, BOSS_MAX_ITEMS);
    for (let i = 0; i < count; i++) {
      items.push(generateItem(randomSlot(), monsterLevel));
    }
    // Boss guaranteed map drop
    if (Math.random() < MAP_DROP_CHANCE_BOSS) {
      mapItem = generateMapItem(rollBossMapTier());
    }
  } else {
    // Standard enemies: single roll with rarity bonus
    if (Math.random() < adjustedDropChance) {
      items.push(generateItem(randomSlot(), monsterLevel));
    }
    // Rare map drop from regular enemies
    if (Math.random() < MAP_DROP_CHANCE_REGULAR) {
      mapItem = generateMapItem(rollRegularMapTier());
    }
  }

  // Gem drop (~3% chance from any enemy)
  let gem: Gem | undefined;
  if (Math.random() < GEM_DROP_CHANCE) {
    gem = generateGem();
  }

  return { items, gold, mapItem, gem };
}
