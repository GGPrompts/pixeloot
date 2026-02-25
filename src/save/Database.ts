import Dexie, { type EntityTable } from 'dexie';
import type { BaseItem } from '../loot/ItemTypes';
import type { EquipSlots } from '../core/Inventory';
import type { StashSaveData } from '../core/Stash';
import type { MapItem } from '../loot/MapItem';
import type { Gem } from '../loot/Gems';

// ---- Data interfaces ----

export interface SaveSlot {
  id?: number;
  name: string;
  timestamp: number;
  classType: string;
  level: number;
}

/** Shared state that persists across class switches. */
export interface PlayerStateData {
  saveId: number;
  gold: number;
  classType: string; // last active class
  maps?: MapItem[];
  gems?: Gem[];
}

/** Per-class state: level, xp, stats, gear, skills. */
export interface ClassStateData {
  id?: number; // auto-increment
  saveId: number;
  classType: string; // 'Ranger' or 'Mage'
  level: number;
  xp: number;
  statPoints: number;
  stats: { dexterity: number; intelligence: number; vitality: number; focus: number };
  health: { current: number; max: number };
  equipped: Record<keyof EquipSlots, BaseItem | null>;
  backpack: (BaseItem | null)[];
  rmbSkillName?: string;
  eSkillName?: string;
}

export interface InventoryData {
  saveId: number;
  equipped: Record<keyof EquipSlots, BaseItem | null>;
  backpack: (BaseItem | null)[];
  maps?: MapItem[];
  gems?: Gem[];
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
  classState: EntityTable<ClassStateData, 'id'>;
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

db.version(3).stores({
  saves: '++id, name, timestamp',
  playerState: 'saveId',
  inventoryState: 'saveId',
  worldState: 'saveId',
  stashState: 'saveId',
  classState: '++id, [saveId+classType]',
});

export { db };
