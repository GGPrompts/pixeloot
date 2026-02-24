import { BaseItem, Slot } from '../loot/ItemTypes';
import type { MapItem } from '../loot/MapItem';
import type { Gem } from '../loot/Gems';
import { markStatsDirty } from './ComputedStats';

export interface EquipSlots {
  weapon: BaseItem | null;
  helmet: BaseItem | null;
  chest: BaseItem | null;
  boots: BaseItem | null;
  ring1: BaseItem | null;
  ring2: BaseItem | null;
  amulet: BaseItem | null;
}

const BACKPACK_SIZE = 20; // 4x5 grid

const SLOT_MAP: Record<keyof EquipSlots, Slot> = {
  weapon: Slot.Weapon,
  helmet: Slot.Helmet,
  chest: Slot.Chest,
  boots: Slot.Boots,
  ring1: Slot.Ring,
  ring2: Slot.Ring,
  amulet: Slot.Amulet,
};

export class Inventory {
  equipped: EquipSlots = {
    weapon: null,
    helmet: null,
    chest: null,
    boots: null,
    ring1: null,
    ring2: null,
    amulet: null,
  };

  backpack: (BaseItem | null)[] = new Array(BACKPACK_SIZE).fill(null);

  /** Map items stored separately from gear. */
  maps: MapItem[] = [];

  /** Gems stored separately from gear. */
  gems: Gem[] = [];

  /** Optional callback fired after any equip/unequip to sync entity stats. */
  onGearChange: (() => void) | null = null;

  /** Add a map item to the map stash. */
  addMap(mapItem: MapItem): void {
    this.maps.push(mapItem);
  }

  /** Remove a map item by id. */
  removeMap(mapId: string): void {
    this.maps = this.maps.filter((m) => m.id !== mapId);
  }

  /** Add a gem to the gem stash. */
  addGem(gem: Gem): void {
    this.gems.push(gem);
  }

  /** Remove a gem by id. */
  removeGem(gemId: string): void {
    this.gems = this.gems.filter((g) => g.id !== gemId);
  }

  /** Add an item to the first empty backpack slot. Returns false if full. */
  addItem(item: BaseItem): boolean {
    const emptyIdx = this.backpack.indexOf(null);
    if (emptyIdx === -1) return false;
    this.backpack[emptyIdx] = item;
    return true;
  }

  /** Equip item from backpack index. Swaps with currently equipped item if any. */
  equipItem(backpackIndex: number): void {
    const item = this.backpack[backpackIndex];
    if (!item) return;

    // Find the appropriate equip slot
    const slotKey = this.getEquipSlotKey(item);
    if (!slotKey) return;

    const currentlyEquipped = this.equipped[slotKey];
    this.equipped[slotKey] = item;
    this.backpack[backpackIndex] = currentlyEquipped; // swap (or null)
    markStatsDirty();
    this.onGearChange?.();
  }

  /** Unequip item from slot, moving it to the backpack. */
  unequipItem(slot: keyof EquipSlots): void {
    const item = this.equipped[slot];
    if (!item) return;

    const emptyIdx = this.backpack.indexOf(null);
    if (emptyIdx === -1) return; // backpack full, can't unequip

    this.backpack[emptyIdx] = item;
    this.equipped[slot] = null;
    markStatsDirty();
    this.onGearChange?.();
  }

  /** Get the equip slot key for a given item. For rings, prefer empty slot. */
  private getEquipSlotKey(item: BaseItem): keyof EquipSlots | null {
    switch (item.slot) {
      case Slot.Weapon: return 'weapon';
      case Slot.Helmet: return 'helmet';
      case Slot.Chest: return 'chest';
      case Slot.Boots: return 'boots';
      case Slot.Amulet: return 'amulet';
      case Slot.Ring:
        // Prefer empty ring slot
        if (!this.equipped.ring1) return 'ring1';
        if (!this.equipped.ring2) return 'ring2';
        return 'ring1'; // default to ring1 if both occupied
      default:
        return null;
    }
  }
}

/** Singleton inventory instance */
export const inventory = new Inventory();
