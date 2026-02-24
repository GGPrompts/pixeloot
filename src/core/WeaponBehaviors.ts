import { WeaponType } from '../loot/ItemTypes';

export interface WeaponBehavior {
  type: WeaponType;
  /** Projectile base name for lookups. */
  name: string;
  projectileSpeed: number;
  projectileDamage: number;  // multiplier on base damage
  projectileColor: number;
  projectileRadius: number;
  fireRate: number;          // shots per second
  /** Behavior tag driving special mechanics. */
  special: 'none' | 'piercing' | 'knockback' | 'explodeOnDeath' | 'homing';
}

// ── Weapon Behavior Definitions ─────────────────────────────────────

const BEHAVIORS: WeaponBehavior[] = [
  {
    type: WeaponType.Bow,
    name: 'Short Bow',
    projectileSpeed: 500,
    projectileDamage: 1.0,
    projectileColor: 0x00ffff,
    projectileRadius: 4,
    fireRate: 4,
    special: 'none',
  },
  {
    type: WeaponType.Bow,
    name: 'Long Bow',
    projectileSpeed: 700,
    projectileDamage: 1.0,
    projectileColor: 0x00ffff,
    projectileRadius: 5,
    fireRate: 2,
    special: 'piercing',
  },
  {
    type: WeaponType.Crossbow,
    name: 'Crossbow',
    projectileSpeed: 600,
    projectileDamage: 1.0,
    projectileColor: 0xffffff,
    projectileRadius: 5,
    fireRate: 3,
    special: 'knockback',
  },
  {
    type: WeaponType.Wand,
    name: 'Wand',
    projectileSpeed: 550,
    projectileDamage: 1.0,
    projectileColor: 0xaa44ff,
    projectileRadius: 3,
    fireRate: 5,
    special: 'none',
  },
  {
    type: WeaponType.Staff,
    name: 'Staff',
    projectileSpeed: 400,
    projectileDamage: 1.0,
    projectileColor: 0x4488ff,
    projectileRadius: 8,
    fireRate: 1.5,
    special: 'explodeOnDeath',
  },
  {
    type: WeaponType.Orb,
    name: 'Orb',
    projectileSpeed: 450,
    projectileDamage: 1.0,
    projectileColor: 0x44ff88,
    projectileRadius: 4,
    fireRate: 3.5,
    special: 'homing',
  },
];

// ── Lookup maps ─────────────────────────────────────────────────────

/** Map from weapon name (lowercase) to behavior. */
const byName = new Map<string, WeaponBehavior>();
for (const b of BEHAVIORS) {
  byName.set(b.name.toLowerCase(), b);
}

/** Default behavior when no weapon is equipped (Short Bow). */
export const DEFAULT_WEAPON_BEHAVIOR = BEHAVIORS[0];

/**
 * Resolve a weapon behavior from an item name.
 * Falls back to matching by WeaponType if no exact name match.
 */
export function getWeaponBehavior(weaponName?: string, weaponType?: WeaponType): WeaponBehavior {
  if (weaponName) {
    const normalized = weaponName.toLowerCase();
    // Exact name match first
    const exact = byName.get(normalized);
    if (exact) return exact;

    // Partial match: check if the weapon name contains any behavior name
    for (const [key, behavior] of byName) {
      if (normalized.includes(key)) return behavior;
    }
  }

  // Fall back to weapon type lookup (first behavior for that type)
  if (weaponType !== undefined) {
    const match = BEHAVIORS.find((b) => b.type === weaponType);
    if (match) return match;
  }

  return DEFAULT_WEAPON_BEHAVIOR;
}

/**
 * Get the weapon behavior for a specific WeaponType enum value.
 * If multiple behaviors exist for the same type, returns the first.
 */
export function getWeaponBehaviorByType(type: WeaponType): WeaponBehavior {
  return BEHAVIORS.find((b) => b.type === type) ?? DEFAULT_WEAPON_BEHAVIOR;
}

/** Get all defined weapon behaviors. */
export function getAllWeaponBehaviors(): readonly WeaponBehavior[] {
  return BEHAVIORS;
}
