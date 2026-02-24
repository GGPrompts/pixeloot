import { BaseStats, Slot, WeaponType } from './ItemTypes';

export interface UniqueItemDefinition {
  name: string;
  slot: Slot;
  weaponType?: WeaponType;
  baseStats: BaseStats;
  uniqueEffect: string;
  effectId: string;
}

export const UNIQUE_ITEMS: UniqueItemDefinition[] = [
  // ── Weapons ────────────────────────────────────────────────────────────

  {
    name: 'Splinterbow',
    slot: Slot.Weapon,
    weaponType: WeaponType.Bow,
    baseStats: { damage: 16, attackSpeed: 1.1 },
    uniqueEffect: 'Power Shot fires 3 arrows in a narrow spread',
    effectId: 'splinterbow_spread',
  },
  {
    name: 'Inferno Staff',
    slot: Slot.Weapon,
    weaponType: WeaponType.Staff,
    baseStats: { damage: 14, attackSpeed: 0.95 },
    uniqueEffect: 'Fireball leaves burning ground for 3 seconds',
    effectId: 'inferno_burning_ground',
  },
  {
    name: 'Stormcaller Wand',
    slot: Slot.Weapon,
    weaponType: WeaponType.Wand,
    baseStats: { damage: 9, attackSpeed: 1.4 },
    uniqueEffect: 'Lightning Chain can bounce to the same enemy twice',
    effectId: 'stormcaller_double_bounce',
  },
  {
    name: 'Voidcaster Orb',
    slot: Slot.Weapon,
    weaponType: WeaponType.Orb,
    baseStats: { damage: 11, attackSpeed: 1.15 },
    uniqueEffect: 'Teleport leaves a Frost Nova at your departure point',
    effectId: 'voidcaster_frost_nova',
  },

  // ── Armor ──────────────────────────────────────────────────────────────

  {
    name: 'Deathweaver Vest',
    slot: Slot.Chest,
    baseStats: { armor: 22 },
    uniqueEffect: 'Enemies you kill explode for 10% of their max HP',
    effectId: 'deathweaver_explode',
  },
  {
    name: 'Phasewalker Cloak',
    slot: Slot.Chest,
    baseStats: { armor: 14 },
    uniqueEffect: 'Evasive Roll drops a trap at your starting position',
    effectId: 'phasewalker_trap',
  },

  // ── Rings ──────────────────────────────────────────────────────────────

  {
    name: 'Band of Echoes',
    slot: Slot.Ring,
    baseStats: {},
    uniqueEffect: 'Skills have 15% chance to not trigger cooldown',
    effectId: 'echoes_cooldown_reset',
  },
  {
    name: 'Vampiric Loop',
    slot: Slot.Ring,
    baseStats: {},
    uniqueEffect: 'Recover 2% of damage dealt as health',
    effectId: 'vampiric_leech',
  },

  // ── Amulets ────────────────────────────────────────────────────────────

  {
    name: 'Prism of Elements',
    slot: Slot.Amulet,
    baseStats: {},
    uniqueEffect: 'Status effects you apply deal 25% more damage',
    effectId: 'prism_status_amplify',
  },
  {
    name: 'Heart of the Grid',
    slot: Slot.Amulet,
    baseStats: {},
    uniqueEffect: '+1 projectile to all attacks',
    effectId: 'grid_extra_projectile',
  },

  // ── Offhand ────────────────────────────────────────────────────────────

  {
    name: 'Chrono Shield',
    slot: Slot.Offhand,
    baseStats: { armor: 18 },
    uniqueEffect: 'Taking fatal damage instead heals 30% HP (60s cooldown)',
    effectId: 'chrono_cheat_death',
  },
  {
    name: 'Essence Conduit',
    slot: Slot.Offhand,
    baseStats: { armor: 10 },
    uniqueEffect: 'Kills grant 3s of +20% movement and attack speed',
    effectId: 'essence_kill_frenzy',
  },
];

/**
 * Get all unique item definitions that can drop for a given slot.
 * Returns an empty array if no uniques exist for that slot.
 */
export function getUniquesForSlot(slot: Slot): UniqueItemDefinition[] {
  return UNIQUE_ITEMS.filter((u) => u.slot === slot);
}

/**
 * Pick a random unique item for a given slot, or null if none exist.
 */
export function pickRandomUnique(slot: Slot): UniqueItemDefinition | null {
  const pool = getUniquesForSlot(slot);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}
