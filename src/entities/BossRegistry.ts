import type { BossDesign, BossAbility, BossPhase, AddWave } from '../../designs/bosses';

export type { BossDesign, BossAbility, BossPhase, AddWave };

// ---------------------------------------------------------------------------
// Registry: maps boss IDs to their BossDesign configs
// ---------------------------------------------------------------------------

const registry = new Map<string, BossDesign>();

/** Register a boss design. Overwrites if the ID already exists. */
export function registerBoss(design: BossDesign): void {
  registry.set(design.id, design);
}

/** Look up a boss design by ID. Returns undefined for unknown IDs. */
export function getBossDesign(id: string): BossDesign | undefined {
  return registry.get(id);
}

/** Get all registered boss IDs. */
export function getAllBossIds(): string[] {
  return Array.from(registry.keys());
}

/** Get all registered boss designs. */
export function getAllBossDesigns(): BossDesign[] {
  return Array.from(registry.values());
}

// ---------------------------------------------------------------------------
// Generic fallback boss for zones without a custom boss
// ---------------------------------------------------------------------------

export const GENERIC_BOSS: BossDesign = {
  id: 'generic',
  name: 'Boss',
  zone: '_any',
  phaseCount: 3,
  shape: 'hexagon',
  primaryColor: 0xffffff,
  accentColor: 0xcccccc,
  radius: 40,
  hpMultiplier: 1.0,
  damageMultiplier: 1.0,
  baseSpeed: 60,
  signatureMechanic: {
    name: 'None',
    description: 'Generic boss with burst fire and charge attacks.',
  },
  phases: [
    {
      phase: 1,
      hpThreshold: 1.0,
      abilities: [
        {
          id: 'burst',
          name: 'Burst Fire',
          description: 'Fires a spread of projectiles toward the player.',
          telegraph: 'none',
          telegraphDuration: 0,
          cooldown: 3,
          damageMultiplier: 1.0,
        },
        {
          id: 'charge',
          name: 'Charge',
          description: 'Dashes toward the player.',
          telegraph: 'circle_aoe',
          telegraphDuration: 0.6,
          cooldown: 6,
          damageMultiplier: 1.5,
        },
      ],
      adds: [],
      designNotes: 'Simple intro phase.',
    },
    {
      phase: 2,
      hpThreshold: 0.6,
      abilities: [
        {
          id: 'burst',
          name: 'Burst Fire',
          description: 'Faster burst fire with more projectiles.',
          telegraph: 'none',
          telegraphDuration: 0,
          cooldown: 2,
          damageMultiplier: 1.0,
        },
        {
          id: 'charge',
          name: 'Charge',
          description: 'Faster charge with shorter cooldown.',
          telegraph: 'circle_aoe',
          telegraphDuration: 0.6,
          cooldown: 4,
          damageMultiplier: 1.5,
        },
      ],
      adds: [
        {
          enemies: [{ type: 'swarm', count: 4 }],
          interval: 0,
          formation: 'surround',
        },
      ],
      designNotes: 'Adds spawn, attacks speed up.',
    },
    {
      phase: 3,
      hpThreshold: 0.3,
      abilities: [
        {
          id: 'burst',
          name: 'Burst Fire',
          description: 'Rapid burst fire.',
          telegraph: 'none',
          telegraphDuration: 0,
          cooldown: 1,
          damageMultiplier: 1.0,
        },
        {
          id: 'charge',
          name: 'Charge',
          description: 'Very fast charges.',
          telegraph: 'circle_aoe',
          telegraphDuration: 0.4,
          cooldown: 2,
          damageMultiplier: 1.5,
        },
      ],
      adds: [
        {
          enemies: [{ type: 'rusher', count: 2 }],
          interval: 10,
          formation: 'surround',
        },
      ],
      designNotes: 'Enrage-lite. Maximum pressure.',
    },
  ],
  enrage: {
    type: 'soft_escalation',
    description: 'Boss gradually speeds up and attacks faster over time.',
  },
  rangerStrategy: 'Kite and dodge.',
  mageStrategy: 'Teleport and burst.',
  designIntent: 'Generic boss encounter.',
};

// ---------------------------------------------------------------------------
// Zone-to-boss mapping: each zone key maps to the boss IDs that belong to it
// ---------------------------------------------------------------------------

const ZONE_BOSS_MAP: Record<string, string[]> = {
  the_grid:       ['sentinel_prime'],
  neon_wastes:    ['void_weaver'],
  reactor_core:   ['meltdown'],
  frozen_array:   ['cryo_matrix'],
  overgrowth:     ['overmind'],
  storm_network:  ['arc_tyrant'],
  the_abyss:      ['dread_hollow', 'nullpoint'],
  chromatic_rift:  ['prism_lord', 'recursion'],
};

/**
 * Get the boss ID for a given zone theme key.
 * Returns the mapped boss (random pick when a zone has multiple bosses).
 * Falls back to a random registered boss for unmapped zones.
 */
export function getBossForZone(themeKey: string): string {
  const zoneBosses = ZONE_BOSS_MAP[themeKey];
  if (zoneBosses && zoneBosses.length > 0) {
    return zoneBosses[Math.floor(Math.random() * zoneBosses.length)];
  }
  // Fallback: pick a random boss from the full registry (excluding generic)
  const allIds = getAllBossIds().filter(id => id !== 'generic');
  if (allIds.length > 0) {
    return allIds[Math.floor(Math.random() * allIds.length)];
  }
  return 'generic';
}

// ---------------------------------------------------------------------------
// Load all designs from the design file and populate the registry
// ---------------------------------------------------------------------------

import { BOSS_DESIGNS } from '../../designs/bosses';

for (const design of BOSS_DESIGNS) {
  registerBoss(design);
}

// Also register the generic fallback
registerBoss(GENERIC_BOSS);
