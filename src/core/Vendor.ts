import { BaseItem, Rarity, Slot } from '../loot/ItemTypes';
import { generateItem } from '../loot/ItemGenerator';
import { generateMapItem } from '../loot/MapItemGenerator';
import type { MapItem } from '../loot/MapItem';

export interface VendorItem {
  item: BaseItem;
  price: number;
}

export interface VendorMapItem {
  mapItem: MapItem;
  price: number;
}

// All gear slots to pick from when generating stock
const GEAR_SLOTS: Slot[] = [
  Slot.Weapon,
  Slot.Helmet,
  Slot.Chest,
  Slot.Boots,
  Slot.Ring,
  Slot.Amulet,
];

/** Current vendor stock (refreshed on open or after timeout). */
let currentStock: VendorItem[] = [];
let currentMapStock: VendorMapItem[] = [];
let lastRefreshTime = 0;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Price an item for the vendor's "for sale" stock.
 * Normal 10-30g, Magic 50-150g scaled slightly by level.
 */
function priceForSale(item: BaseItem): number {
  const levelFactor = 1 + (item.level - 1) * 0.05;
  switch (item.rarity) {
    case Rarity.Normal:
      return Math.round(randomInt(10, 30) * levelFactor);
    case Rarity.Magic:
      return Math.round(randomInt(50, 150) * levelFactor);
    default:
      return Math.round(randomInt(50, 150) * levelFactor);
  }
}

/**
 * Price a map item for vendor stock. 100-300g.
 */
function priceMapForSale(mapItem: MapItem): number {
  return randomInt(100, 300);
}

/**
 * Generate vendor stock scaled to the player's level.
 * Returns 8-12 gear items (Normal/Magic) plus 1-2 map items.
 */
export function generateVendorStock(playerLevel: number): {
  items: VendorItem[];
  maps: VendorMapItem[];
} {
  const itemCount = randomInt(8, 12);
  const items: VendorItem[] = [];

  for (let i = 0; i < itemCount; i++) {
    const slot = GEAR_SLOTS[Math.floor(Math.random() * GEAR_SLOTS.length)];
    // Mix of Normal (60%) and Magic (40%)
    const rarity = Math.random() < 0.6 ? Rarity.Normal : Rarity.Magic;
    // Item level varies slightly around player level
    const itemLevel = Math.max(1, playerLevel + randomInt(-1, 2));
    const item = generateItem(slot, itemLevel, rarity);
    items.push({ item, price: priceForSale(item) });
  }

  // 1-2 map items, tier 1-2
  const mapCount = randomInt(1, 2);
  const maps: VendorMapItem[] = [];
  for (let i = 0; i < mapCount; i++) {
    const tier = randomInt(1, 2);
    const mapItem = generateMapItem(tier);
    maps.push({ mapItem, price: priceMapForSale(mapItem) });
  }

  return { items, maps };
}

/**
 * Get the sell price for a player-owned item.
 * Normal 2-5g, Magic 10-25g, Rare 50-100g, Unique 200g.
 * Scales slightly with item level.
 */
export function getSellPrice(item: BaseItem): number {
  const levelFactor = 1 + (item.level - 1) * 0.03;
  switch (item.rarity) {
    case Rarity.Normal:
      return Math.max(1, Math.round(randomInt(2, 5) * levelFactor));
    case Rarity.Magic:
      return Math.max(5, Math.round(randomInt(10, 25) * levelFactor));
    case Rarity.Rare:
      return Math.max(25, Math.round(randomInt(50, 100) * levelFactor));
    case Rarity.Unique:
      return Math.round(200 * levelFactor);
    default:
      return 1;
  }
}

/**
 * Get or refresh vendor stock. Refreshes if first open or stale (>5 min).
 */
export function getVendorStock(playerLevel: number): {
  items: VendorItem[];
  maps: VendorMapItem[];
} {
  const now = Date.now();
  if (currentStock.length === 0 || now - lastRefreshTime > REFRESH_INTERVAL_MS) {
    const stock = generateVendorStock(playerLevel);
    currentStock = stock.items;
    currentMapStock = stock.maps;
    lastRefreshTime = now;
  }
  return { items: currentStock, maps: currentMapStock };
}

/** Force refresh vendor stock (called when vendor is opened). */
export function refreshVendorStock(playerLevel: number): {
  items: VendorItem[];
  maps: VendorMapItem[];
} {
  const stock = generateVendorStock(playerLevel);
  currentStock = stock.items;
  currentMapStock = stock.maps;
  lastRefreshTime = Date.now();
  return { items: currentStock, maps: currentMapStock };
}

/** Remove a purchased item from stock by index. */
export function removeFromStock(index: number): void {
  if (index >= 0 && index < currentStock.length) {
    currentStock.splice(index, 1);
  }
}

/** Remove a purchased map from stock by index. */
export function removeMapFromStock(index: number): void {
  if (index >= 0 && index < currentMapStock.length) {
    currentMapStock.splice(index, 1);
  }
}
