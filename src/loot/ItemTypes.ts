export enum Rarity {
  Normal,
  Magic,
  Rare,
  Unique,
}

export enum Slot {
  Weapon,
  Helmet,
  Chest,
  Boots,
  Ring,
  Amulet,
  Offhand,
}

export enum WeaponType {
  Bow,
  Staff,
  Wand,
  Crossbow,
  Orb,
}

export interface ItemSocket {
  gem?: import('./Gems').Gem;
}

export interface BaseItem {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  level: number;
  baseStats: BaseStats;
  affixes: Affix[];
  uniqueEffect?: string;
  effectId?: string;
  weaponType?: WeaponType;
  socket?: ItemSocket;
}

export interface BaseStats {
  damage?: number;
  armor?: number;
  attackSpeed?: number;
}

export interface Affix {
  id: string;
  name: string;
  category: AffixCategory;
  stat: string;
  value: number;
  minValue: number;
  maxValue: number;
}

export type AffixCategory = 'offensive' | 'defensive' | 'utility' | 'conditional';

export interface AffixDefinition {
  id: string;
  name: string;
  category: AffixCategory;
  stat: string;
  minValue: number;
  maxValue: number;
  weight: number;
}

export interface BaseItemTemplate {
  name: string;
  slot: Slot;
  weaponType?: WeaponType;
  baseStats: BaseStats;
}
