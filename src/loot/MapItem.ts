/**
 * Map items that generate new dungeons with modifiers.
 * Maps drop from enemies and can be activated via the Map Device.
 */

export interface MapModifier {
  id: string;
  name: string;
  description: string;
  /** Key used to look up and apply the effect during gameplay. */
  effect: string;
}

export interface MapItem {
  id: string;
  /** Tier 1-5 determines modifier count and bonuses. */
  tier: number;
  /** Active modifiers rolled for this map. */
  modifiers: MapModifier[];
  /** +% more monsters spawned per wave. */
  quantityBonus: number;
  /** +% better drop chance. */
  rarityBonus: number;
  /** Zone theme key applied when this map is activated. */
  theme?: string;
}

// ── Modifier Pool ───────────────────────────────────────────────────

export const MAP_MODIFIER_POOL: MapModifier[] = [
  {
    id: 'hp_boost',
    name: 'Fortified',
    description: 'Monsters have +20% HP',
    effect: 'hp_boost',
  },
  {
    id: 'speed_boost',
    name: 'Hastened',
    description: 'Monsters move 15% faster',
    effect: 'speed_boost',
  },
  {
    id: 'fire_enchanted',
    name: 'Fire Enchanted',
    description: 'Enemies apply Burn on hit',
    effect: 'fire_enchanted',
  },
  {
    id: 'explode_on_death',
    name: 'Volatile',
    description: 'Monsters explode on death',
    effect: 'explode_on_death',
  },
  {
    id: 'extra_swarm',
    name: 'Swarming',
    description: 'Extra swarm spawns (+50%)',
    effect: 'extra_swarm',
  },
  {
    id: 'boss_phases',
    name: 'Empowered Boss',
    description: 'Boss has +2 phases',
    effect: 'boss_phases',
  },
  {
    id: 'resist_first_hit',
    name: 'Iron Skin',
    description: 'Enemies resist first hit',
    effect: 'resist_first_hit',
  },
];
