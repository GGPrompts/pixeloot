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

/** Condition type for conditional affixes. */
export type ConditionType =
  | 'while-moving'
  | 'while-stationary'
  | 'on-kill'
  | 'on-hit'
  | 'low-hp'
  | 'full-hp'
  | 'after-skill'
  | 'after-movement-skill'
  | 'distance-close'
  | 'distance-far'
  | 'stat-breakpoint'
  | 'kill-streak'
  | 'status-on-target'
  | 'multi-hit'
  | 'recently-hit'
  | 'no-damage-taken';

export interface AffixDefinition {
  id: string;
  name: string;
  category: AffixCategory;
  stat: string;
  minValue: number;
  maxValue: number;
  weight: number;
  /** Condition type for conditional affixes. */
  conditionType?: ConditionType;
  /** Additional condition parameters (thresholds, time windows, etc.). */
  conditionParams?: Record<string, number | string>;
  /** Duration of the buff in seconds after trigger. 0 = passive/while-condition-met. */
  buffDuration?: number;
}

export interface BaseItemTemplate {
  name: string;
  slot: Slot;
  weaponType?: WeaponType;
  baseStats: BaseStats;
}
