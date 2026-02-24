import { BaseItemTemplate, Slot, WeaponType } from './ItemTypes';

export const WEAPON_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Short Bow',
    slot: Slot.Weapon,
    weaponType: WeaponType.Bow,
    baseStats: { damage: 8, attackSpeed: 1.2 },
  },
  {
    name: 'Long Bow',
    slot: Slot.Weapon,
    weaponType: WeaponType.Bow,
    baseStats: { damage: 14, attackSpeed: 0.9 },
  },
  {
    name: 'Oak Staff',
    slot: Slot.Weapon,
    weaponType: WeaponType.Staff,
    baseStats: { damage: 11, attackSpeed: 1.0 },
  },
  {
    name: 'Crystal Wand',
    slot: Slot.Weapon,
    weaponType: WeaponType.Wand,
    baseStats: { damage: 6, attackSpeed: 1.5 },
  },
  {
    name: 'Light Crossbow',
    slot: Slot.Weapon,
    weaponType: WeaponType.Crossbow,
    baseStats: { damage: 18, attackSpeed: 0.7 },
  },
  {
    name: 'Spirit Orb',
    slot: Slot.Weapon,
    weaponType: WeaponType.Orb,
    baseStats: { damage: 9, attackSpeed: 1.1 },
  },
];

export const HELMET_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Leather Cap',
    slot: Slot.Helmet,
    baseStats: { armor: 5 },
  },
  {
    name: 'Iron Helm',
    slot: Slot.Helmet,
    baseStats: { armor: 12 },
  },
  {
    name: 'Wizard Hat',
    slot: Slot.Helmet,
    baseStats: { armor: 3 },
  },
];

export const CHEST_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Leather Vest',
    slot: Slot.Chest,
    baseStats: { armor: 8 },
  },
  {
    name: 'Chain Mail',
    slot: Slot.Chest,
    baseStats: { armor: 18 },
  },
  {
    name: 'Robe',
    slot: Slot.Chest,
    baseStats: { armor: 4 },
  },
];

export const BOOTS_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Sandals',
    slot: Slot.Boots,
    baseStats: { armor: 2 },
  },
  {
    name: 'Iron Boots',
    slot: Slot.Boots,
    baseStats: { armor: 10 },
  },
  {
    name: 'Mage Slippers',
    slot: Slot.Boots,
    baseStats: { armor: 3 },
  },
];

export const RING_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Iron Band',
    slot: Slot.Ring,
    baseStats: {},
  },
  {
    name: 'Gold Ring',
    slot: Slot.Ring,
    baseStats: {},
  },
];

export const AMULET_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Bone Pendant',
    slot: Slot.Amulet,
    baseStats: {},
  },
  {
    name: 'Crystal Amulet',
    slot: Slot.Amulet,
    baseStats: {},
  },
];

export const OFFHAND_TEMPLATES: BaseItemTemplate[] = [
  {
    name: 'Wooden Shield',
    slot: Slot.Offhand,
    baseStats: { armor: 10 },
  },
  {
    name: 'Spell Focus',
    slot: Slot.Offhand,
    baseStats: { armor: 5 },
  },
];

const TEMPLATES_BY_SLOT: Record<number, BaseItemTemplate[]> = {
  [Slot.Weapon]: WEAPON_TEMPLATES,
  [Slot.Helmet]: HELMET_TEMPLATES,
  [Slot.Chest]: CHEST_TEMPLATES,
  [Slot.Boots]: BOOTS_TEMPLATES,
  [Slot.Ring]: RING_TEMPLATES,
  [Slot.Amulet]: AMULET_TEMPLATES,
  [Slot.Offhand]: OFFHAND_TEMPLATES,
};

/** Get all base item templates for a given equipment slot */
export function getTemplatesForSlot(slot: Slot): BaseItemTemplate[] {
  return TEMPLATES_BY_SLOT[slot] ?? [];
}

/** Pick a random base item template for a given slot */
export function pickRandomTemplate(slot: Slot): BaseItemTemplate {
  const templates = getTemplatesForSlot(slot);
  if (templates.length === 0) {
    throw new Error(`No base item templates defined for slot ${Slot[slot]}`);
  }
  return templates[Math.floor(Math.random() * templates.length)];
}
