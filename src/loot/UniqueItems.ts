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
  {
    name: 'Ricochet Longbow',
    slot: Slot.Weapon,
    weaponType: WeaponType.Bow,
    baseStats: { damage: 12, attackSpeed: 0.85 },
    uniqueEffect: 'Arrows bounce to a nearby enemy on kill, dealing 60% damage',
    effectId: 'ricochet_on_kill',
  },
  {
    name: 'Threadcutter',
    slot: Slot.Weapon,
    weaponType: WeaponType.Bow,
    baseStats: { damage: 10, attackSpeed: 1.3 },
    uniqueEffect: 'Multi Shot fires in a full 360-degree ring',
    effectId: 'threadcutter_ring',
  },
  {
    name: 'Cascade Orb',
    slot: Slot.Weapon,
    weaponType: WeaponType.Orb,
    baseStats: { damage: 10, attackSpeed: 1.1 },
    uniqueEffect: 'Lightning Chain gains +3 bounces but each bounce deals 30% less (instead of 20%)',
    effectId: 'cascade_extra_bounces',
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
  {
    name: 'Resonance Loop',
    slot: Slot.Ring,
    baseStats: {},
    uniqueEffect: 'Reapplying a status effect the enemy already has deals 20 bonus damage',
    effectId: 'resonance_double_status',
  },
  {
    name: 'Kinetic Band',
    slot: Slot.Ring,
    baseStats: {},
    uniqueEffect: 'Every 4th projectile deals double damage and applies Knockback',
    effectId: 'kinetic_fourth_shot',
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

  // ── Helmets ──────────────────────────────────────────────────────────

  {
    name: 'Allseeing Visor',
    slot: Slot.Helmet,
    baseStats: { armor: 8 },
    uniqueEffect: 'Enemies below 20% HP take +25% damage from you',
    effectId: 'visor_execute',
  },
  {
    name: "Tracker's Hood",
    slot: Slot.Helmet,
    baseStats: { armor: 7 },
    uniqueEffect: 'Mark Target also applies to all enemies within 64px',
    effectId: 'tracker_aoe_mark',
  },
  {
    name: 'Shatterglass Lens',
    slot: Slot.Helmet,
    baseStats: { armor: 5 },
    uniqueEffect: 'Projectiles at >300px deal +20% damage; within 100px deal -15% damage',
    effectId: 'shatterglass_range_scaling',
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

  // ── Wave 2 Uniques (triggered effects) ─────────────────────────────

  {
    name: 'Whisperstring',
    slot: Slot.Weapon,
    weaponType: WeaponType.Crossbow,
    baseStats: { damage: 20, attackSpeed: 0.6 },
    uniqueEffect:
      'Standing still for 1s grants Steady Aim: next shot deals +40% damage and passes through walls',
    effectId: 'whisperstring_steady',
  },
  {
    name: 'Frostfire Scepter',
    slot: Slot.Weapon,
    weaponType: WeaponType.Wand,
    baseStats: { damage: 8, attackSpeed: 1.35 },
    uniqueEffect:
      'Fireball applies Chill instead of Burn. Frost Nova applies Burn instead of Slow',
    effectId: 'frostfire_conversion',
  },
  {
    name: 'Mindstorm Crown',
    slot: Slot.Helmet,
    baseStats: { armor: 6 },
    uniqueEffect:
      'Killing 5 enemies within 4 seconds triggers a free Frost Nova centered on the player',
    effectId: 'mindstorm_killstreak_nova',
  },
  {
    name: 'Flickerstep Shroud',
    slot: Slot.Chest,
    baseStats: { armor: 10 },
    uniqueEffect:
      'After using any movement skill, gain +30% attack speed for 2 seconds',
    effectId: 'flickerstep_post_dash',
  },
  {
    name: 'Trailblazer Greaves',
    slot: Slot.Boots,
    baseStats: { armor: 6 },
    uniqueEffect:
      'While moving, leave a burning trail that deals damage to enemies who walk through it (3s duration)',
    effectId: 'trailblazer_fire_trail',
  },
  {
    name: 'Rootwalkers',
    slot: Slot.Boots,
    baseStats: { armor: 8 },
    uniqueEffect:
      'Standing still for 0.5s roots you in place but grants +20% damage and 25 flat armor',
    effectId: 'rootwalkers_plant',
  },
  {
    name: 'Manaforge Ring',
    slot: Slot.Ring,
    baseStats: {},
    uniqueEffect:
      'Skills that hit 3+ enemies at once have their cooldown refunded by 30%',
    effectId: 'manaforge_aoe_refund',
  },
  {
    name: 'Ember Quiver',
    slot: Slot.Offhand,
    baseStats: { armor: 6 },
    uniqueEffect:
      'All Ranger projectiles apply Burn on hit. Burning enemies take +10% damage from your projectiles',
    effectId: 'ember_quiver_burn',
  },

  // ── Wave 3 Uniques (complex state tracking) ─────────────────────────

  {
    name: 'Gravity Well Staff',
    slot: Slot.Weapon,
    weaponType: WeaponType.Staff,
    baseStats: { damage: 13, attackSpeed: 0.9 },
    uniqueEffect:
      'Meteor pulls all enemies within 150px toward the impact point during the telegraph phase',
    effectId: 'gravity_well_meteor',
  },
  {
    name: 'Thornweave Mantle',
    slot: Slot.Chest,
    baseStats: { armor: 16 },
    uniqueEffect:
      'When hit, return 15% of the damage taken as a nova that hits all enemies within 96px',
    effectId: 'thornweave_reflect_nova',
  },
  {
    name: 'Phasewalk Boots',
    slot: Slot.Boots,
    baseStats: { armor: 4 },
    uniqueEffect:
      'Movement skills grant 1s of invisibility (enemies lose aggro). Evasive Roll distance +50%',
    effectId: 'phasewalk_enhanced_mobility',
  },
  {
    name: "Warden's Sigil",
    slot: Slot.Amulet,
    baseStats: {},
    uniqueEffect:
      'Trap maximum increased from 3 to 6. Traps arm instantly instead of after 0.5s delay',
    effectId: 'warden_enhanced_traps',
  },
  {
    name: 'Conduit Pendant',
    slot: Slot.Amulet,
    baseStats: {},
    uniqueEffect:
      'Lightning Chain arcs from you to the target before bouncing. Each arc also applies Chill',
    effectId: 'conduit_self_arc',
  },
  {
    name: "Gambler's Charm",
    slot: Slot.Amulet,
    baseStats: {},
    uniqueEffect:
      'Every 10 seconds, gain a random buff for 5s: +30% damage, +30% move speed, +50 armor, or instant skill refresh',
    effectId: 'gambler_random_buff',
  },
  {
    name: 'Tome of Recursion',
    slot: Slot.Offhand,
    baseStats: { armor: 4 },
    uniqueEffect:
      'Frost Nova triggers a second, smaller Frost Nova (64px radius) 1s after the first',
    effectId: 'recursion_double_nova',
  },
  {
    name: 'Sentinel Ward',
    slot: Slot.Offhand,
    baseStats: { armor: 20 },
    uniqueEffect:
      'While below 50% HP, a rotating shield orbits you that blocks one enemy projectile every 3s',
    effectId: 'sentinel_ward_shield',
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
