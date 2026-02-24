import Dexie, { type EntityTable } from 'dexie';
import type { BaseItem } from '../loot/ItemTypes';
import type { EquipSlots } from '../core/Inventory';
import type { StashSaveData } from '../core/Stash';

// ---- Data interfaces ----

export interface SaveSlot {
  id?: number;
  name: string;
  timestamp: number;
  classType: string;
  level: number;
}

export interface PlayerStateData {
  saveId: number;
  level: number;
  xp: number;
  statPoints: number;
  stats: { dexterity: number; intelligence: number; vitality: number; focus: number };
  gold: number;
  health: { current: number; max: number };
  classType: string;
}

export interface InventoryData {
  saveId: number;
  equipped: Record<keyof EquipSlots, BaseItem | null>;
  backpack: (BaseItem | null)[];
}

export interface WorldStateData {
  saveId: number;
  waveNumber: number;
}

export interface StashData {
  saveId: number;
  stash: StashSaveData;
}

// ---- Database ----

type PixelootDB = Dexie & {
  saves: EntityTable<SaveSlot, 'id'>;
  playerState: EntityTable<PlayerStateData, 'saveId'>;
  inventoryState: EntityTable<InventoryData, 'saveId'>;
  worldState: EntityTable<WorldStateData, 'saveId'>;
  stashState: EntityTable<StashData, 'saveId'>;
};

const db = new Dexie('pixeloot') as PixelootDB;

db.version(1).stores({
  saves: '++id, name, timestamp',
  playerState: 'saveId',
  inventoryState: 'saveId',
  worldState: 'saveId',
});

db.version(2).stores({
  saves: '++id, name, timestamp',
  playerState: 'saveId',
  inventoryState: 'saveId',
  worldState: 'saveId',
  stashState: 'saveId',
});

export { db };
