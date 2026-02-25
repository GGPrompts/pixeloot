/**
 * Boss Encounter Designs for Pixeloot
 *
 * Each boss is tied to a zone theme and features multi-phase mechanics,
 * telegraphed attacks, add waves, and a signature mechanic that creates
 * a distinct combat puzzle.
 *
 * Design principles:
 * - Every attack is telegraphed (no unfair one-shots)
 * - Phases escalate pressure, never just repeat faster
 * - Each boss teaches a different skill (kiting, burst, positioning, etc.)
 * - Ranger and Mage approach each fight differently
 * - Soft enrage prevents infinite stalling
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface BossAbility {
  /** Internal identifier for the ability. */
  id: string;
  /** Display name shown in boss health bar or telegraph. */
  name: string;
  /** How the ability works mechanically. */
  description: string;
  /** Telegraph type so the player knows what is coming. */
  telegraph: 'circle_aoe' | 'line' | 'cone' | 'ring' | 'pulse' | 'none' | 'ground_marker' | 'screen_flash';
  /** Seconds of warning before the ability lands. */
  telegraphDuration: number;
  /** Base cooldown in seconds between uses. */
  cooldown: number;
  /** Base damage as a multiplier of the boss's base damage stat. */
  damageMultiplier: number;
}

export interface AddWave {
  /** Which enemy types spawn during this phase's add waves. */
  enemies: { type: 'rusher' | 'swarm' | 'tank' | 'sniper' | 'flanker' | 'splitter' | 'shielder'; count: number }[];
  /** Seconds between add spawns (0 = one-time spawn on phase entry). */
  interval: number;
  /** Formation used for spawning adds. */
  formation: 'surround' | 'column' | 'pincer' | 'chaoticSwarm' | 'shieldWall';
}

export interface BossPhase {
  /** Phase number (1-based). */
  phase: number;
  /** HP threshold to enter this phase (percentage of max HP, 1.0 = fight start). */
  hpThreshold: number;
  /** Abilities active during this phase. */
  abilities: BossAbility[];
  /** Add waves during this phase (empty array = no adds). */
  adds: AddWave[];
  /** Description of what changes in this phase for design reference. */
  designNotes: string;
}

export interface BossEnrage {
  /** Type of enrage mechanic. */
  type: 'hard_timer' | 'soft_escalation' | 'arena_shrink' | 'damage_ramp';
  /** Seconds into the fight before enrage begins (for hard_timer). */
  timerSeconds?: number;
  /** How the enrage manifests. */
  description: string;
}

export interface BossDesign {
  /** Internal unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Zone theme key this boss belongs to (matches ZoneThemes.ts keys). */
  zone: string;
  /** Total number of phases. */
  phaseCount: number;
  /** Geometric shape description for Phase 1 rendering. */
  shape: string;
  /** Primary body color (hex). */
  primaryColor: number;
  /** Glow/accent color (hex). */
  accentColor: number;
  /** Radius in pixels for collision and rendering. */
  radius: number;
  /** Base HP multiplier relative to the standard boss (BOSS_BASE_HP = 500). */
  hpMultiplier: number;
  /** Base damage multiplier relative to standard boss (BOSS_BASE_DAMAGE = 25). */
  damageMultiplier: number;
  /** Base movement speed. */
  baseSpeed: number;
  /** The signature mechanic that defines this fight. */
  signatureMechanic: {
    name: string;
    description: string;
  };
  /** Phase definitions. */
  phases: BossPhase[];
  /** Enrage mechanic. */
  enrage: BossEnrage;
  /** Design notes: how Ranger is expected to approach this fight. */
  rangerStrategy: string;
  /** Design notes: how Mage is expected to approach this fight. */
  mageStrategy: string;
  /** One-line design intent summary. */
  designIntent: string;
}

// ---------------------------------------------------------------------------
// Boss Definitions
// ---------------------------------------------------------------------------

export const BOSS_DESIGNS: BossDesign[] = [

  // =========================================================================
  // 1. SENTINEL PRIME -- The Grid (tutorial boss)
  // =========================================================================
  {
    id: 'sentinel_prime',
    name: 'Sentinel Prime',
    zone: 'the_grid',
    phaseCount: 3,
    shape: 'Large octagon with rotating inner square. Cyan wireframe outline pulses on beat.',
    primaryColor: 0x00ffff,
    accentColor: 0x88ffff,
    radius: 44,
    hpMultiplier: 1.0,
    damageMultiplier: 1.0,
    baseSpeed: 55,
    signatureMechanic: {
      name: 'Grid Lock',
      description:
        'Sentinel Prime periodically electrifies grid lines on the floor, creating a temporary ' +
        'maze of damage zones. Players must read the telegraph (lines glow brighter for 1s) and ' +
        'navigate to safe tiles. Lines always leave at least one safe corridor, but the corridor ' +
        'shifts each cast. In phase 3, two sets of lines activate in sequence.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'grid_burst',
            name: 'Grid Burst',
            description: 'Fires 4 projectiles aligned to cardinal directions.',
            telegraph: 'line',
            telegraphDuration: 0.6,
            cooldown: 3.5,
            damageMultiplier: 0.8,
          },
          {
            id: 'grid_lock_v1',
            name: 'Grid Lock',
            description: 'Electrifies 3 random grid rows/columns for 2s. One safe corridor guaranteed.',
            telegraph: 'ground_marker',
            telegraphDuration: 1.0,
            cooldown: 8,
            damageMultiplier: 1.2,
          },
        ],
        adds: [],
        designNotes: 'Teaching phase. Slow attacks, generous telegraphs. Player learns to dodge grid lines.',
      },
      {
        phase: 2,
        hpThreshold: 0.6,
        abilities: [
          {
            id: 'grid_burst_8',
            name: 'Grid Burst+',
            description: 'Fires 8 projectiles (cardinal + diagonal).',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 2.5,
            damageMultiplier: 0.8,
          },
          {
            id: 'grid_lock_v2',
            name: 'Grid Lock+',
            description: 'Electrifies 5 grid lines. Safe corridor is narrower.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.8,
            cooldown: 6,
            damageMultiplier: 1.2,
          },
          {
            id: 'sentinel_charge',
            name: 'Sentinel Charge',
            description: 'Dashes toward player position. Leaves a trail of sparks that linger for 1.5s.',
            telegraph: 'line',
            telegraphDuration: 0.7,
            cooldown: 5,
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
        designNotes: 'More projectiles, tighter safe zones. Charge attack forces repositioning.',
      },
      {
        phase: 3,
        hpThreshold: 0.25,
        abilities: [
          {
            id: 'grid_burst_spiral',
            name: 'Grid Spiral',
            description: 'Continuous spiral of projectiles for 3s (rotates slowly, weave through gaps).',
            telegraph: 'pulse',
            telegraphDuration: 0.5,
            cooldown: 6,
            damageMultiplier: 0.6,
          },
          {
            id: 'grid_lock_v3',
            name: 'Grid Lock++',
            description: 'Two waves of electrified lines, 1s apart. Must dodge twice in sequence.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.8,
            cooldown: 5,
            damageMultiplier: 1.4,
          },
          {
            id: 'sentinel_charge',
            name: 'Sentinel Charge',
            description: 'Faster charge with shorter telegraph.',
            telegraph: 'line',
            telegraphDuration: 0.4,
            cooldown: 3,
            damageMultiplier: 1.5,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 3 }],
            interval: 12,
            formation: 'pincer',
          },
        ],
        designNotes: 'Enrage-lite. Spiral requires continuous movement. Double grid lock is the skill check.',
      },
    ],
    enrage: {
      type: 'soft_escalation',
      description:
        'After 90s, Grid Lock activates every 3s and covers 80% of the arena. ' +
        'Player must continuously navigate shrinking safe zones while DPSing.',
    },
    rangerStrategy:
      'Use Evasive Roll to cross electrified lines safely. Power Shot threading ' +
      'through the safe corridor while boss is stationary during Grid Lock cast. ' +
      'Multi Shot good for clearing swarm adds.',
    mageStrategy:
      'Teleport is excellent for Grid Lock dodging. Frost Nova the swarm adds on phase 2 entry. ' +
      'Position Arcane Wall to block charge path. Fireball the boss during Grid Lock wind-up.',
    designIntent: 'Tutorial boss. Teaches telegraph reading and movement under pressure.',
  },

  // =========================================================================
  // 2. VOID WEAVER -- Neon Wastes
  // =========================================================================
  {
    id: 'void_weaver',
    name: 'Void Weaver',
    zone: 'neon_wastes',
    phaseCount: 4,
    shape: 'Pulsating star with 8 points. Inner body shifts between magenta and deep purple. Trailing afterimages.',
    primaryColor: 0xff00ff,
    accentColor: 0xcc44ff,
    radius: 38,
    hpMultiplier: 1.2,
    damageMultiplier: 0.9,
    baseSpeed: 75,
    signatureMechanic: {
      name: 'Dimensional Tether',
      description:
        'Void Weaver places 2-4 void anchors around the arena (purple obelisks). ' +
        'Tether beams connect adjacent anchors, creating walls of void energy that deal ' +
        'damage on contact. Anchors can be destroyed (low HP) to break the tether web. ' +
        'In later phases, anchors regenerate after 10s if not all are destroyed simultaneously. ' +
        'Creates a positioning puzzle: navigate the tether maze or invest DPS to clear anchors.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'void_bolt',
            name: 'Void Bolt',
            description: 'Fires 3 homing projectiles that track for 1.5s then fly straight.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 3,
            damageMultiplier: 0.7,
          },
          {
            id: 'place_anchors_2',
            name: 'Void Anchors',
            description: 'Places 2 void anchors, connected by a tether beam.',
            telegraph: 'ground_marker',
            telegraphDuration: 1.2,
            cooldown: 12,
            damageMultiplier: 0,
          },
        ],
        adds: [],
        designNotes: 'Introduction to tether mechanic. Only one beam to navigate. Homing bolts teach dodge timing.',
      },
      {
        phase: 2,
        hpThreshold: 0.7,
        abilities: [
          {
            id: 'void_bolt',
            name: 'Void Bolt',
            description: 'Fires 5 homing projectiles.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2.5,
            damageMultiplier: 0.7,
          },
          {
            id: 'place_anchors_3',
            name: 'Void Anchors+',
            description: 'Places 3 anchors forming a triangle tether cage.',
            telegraph: 'ground_marker',
            telegraphDuration: 1.0,
            cooldown: 10,
            damageMultiplier: 0,
          },
          {
            id: 'blink_strike',
            name: 'Blink Strike',
            description: 'Teleports to a position behind the player, attacks immediately.',
            telegraph: 'screen_flash',
            telegraphDuration: 0.4,
            cooldown: 6,
            damageMultiplier: 1.3,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'flanker', count: 3 }],
            interval: 0,
            formation: 'surround',
          },
        ],
        designNotes: 'Triangle cage restricts movement. Blink Strike punishes standing still. Flankers harass.',
      },
      {
        phase: 3,
        hpThreshold: 0.4,
        abilities: [
          {
            id: 'void_bolt_spread',
            name: 'Void Barrage',
            description: 'Rapid-fire 3 bursts of 4 bolts each over 2s.',
            telegraph: 'pulse',
            telegraphDuration: 0.3,
            cooldown: 4,
            damageMultiplier: 0.6,
          },
          {
            id: 'place_anchors_4',
            name: 'Void Anchors++',
            description: 'Places 4 anchors forming a square cage. Anchors regenerate after 10s.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.8,
            cooldown: 15,
            damageMultiplier: 0,
          },
          {
            id: 'blink_strike',
            name: 'Blink Strike',
            description: 'Shorter cooldown, leaves a void puddle at departure point.',
            telegraph: 'screen_flash',
            telegraphDuration: 0.3,
            cooldown: 4,
            damageMultiplier: 1.3,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'flanker', count: 2 }, { type: 'sniper', count: 2 }],
            interval: 15,
            formation: 'pincer',
          },
        ],
        designNotes: 'Full anchor cage. Must destroy anchors or navigate tight corridors while dodging barrages.',
      },
      {
        phase: 4,
        hpThreshold: 0.15,
        abilities: [
          {
            id: 'void_collapse',
            name: 'Void Collapse',
            description:
              'All active anchors detonate in sequence (1s intervals), each creating a large AoE. ' +
              'Then Void Weaver channels a massive room-wide pulse that deals heavy damage unless ' +
              'the player stands in the dead zone at the exact center of the arena.',
            telegraph: 'ring',
            telegraphDuration: 1.5,
            cooldown: 20,
            damageMultiplier: 2.5,
          },
          {
            id: 'void_barrage_constant',
            name: 'Desperate Barrage',
            description: 'Continuous homing bolt stream, 1 bolt per 0.3s.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 0.3,
            damageMultiplier: 0.5,
          },
        ],
        adds: [],
        designNotes: 'Burn phase. No more adds, pure DPS race with constant dodging. Void Collapse is the wipe check.',
      },
    ],
    enrage: {
      type: 'hard_timer',
      timerSeconds: 120,
      description:
        'After 120s, Void Weaver permanently channels Void Collapse every 8s ' +
        'while maintaining constant bolt barrage. Arena becomes nearly undodgeable.',
    },
    rangerStrategy:
      'Focus anchors with Power Shot (pierce can hit 2 anchors in a line). ' +
      'Evasive Roll through tether beams. Trap placement near anchor spawn points. ' +
      'Mark Target on boss during burn phases for maximum DPS.',
    mageStrategy:
      'Lightning Chain bounces well off clustered anchors. Teleport through tether walls. ' +
      'Frost Nova the flanker adds on phase 2/3 entry. Meteor on boss during Void Collapse ' +
      'channel for massive damage window.',
    designIntent: 'Positioning puzzle. Teaches arena awareness and target priority (anchors vs boss).',
  },

  // =========================================================================
  // 3. MELTDOWN -- Reactor Core
  // =========================================================================
  {
    id: 'meltdown',
    name: 'Meltdown',
    zone: 'reactor_core',
    phaseCount: 4,
    shape: 'Thick-bordered circle with a rotating inner triangle (nuclear symbol). Radiates heat waves from edges.',
    primaryColor: 0xff6600,
    accentColor: 0xff2200,
    radius: 42,
    hpMultiplier: 1.4,
    damageMultiplier: 1.1,
    baseSpeed: 45,
    signatureMechanic: {
      name: 'Thermal Overload',
      description:
        'The arena floor has a heat gauge that rises over time. At certain thresholds, ' +
        'floor tiles ignite in expanding patterns from the boss outward. Safe tiles glow ' +
        'blue-white. Standing on burning tiles applies a stacking Burn DoT. The boss ' +
        'periodically vents heat (2s channel), which resets the floor but pushes all ' +
        'players outward with heavy knockback. The fight is a rhythm: deal damage during ' +
        'cool floors, survive the vent, reposition, repeat.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'magma_spit',
            name: 'Magma Spit',
            description: 'Lobs 3 magma globs in an arc. They leave burning puddles for 4s on landing.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.8,
            cooldown: 4,
            damageMultiplier: 1.0,
          },
          {
            id: 'heat_vent',
            name: 'Heat Vent',
            description: '2s channel. Resets floor heat. Knockback pulse at end. Damage close range.',
            telegraph: 'ring',
            telegraphDuration: 2.0,
            cooldown: 18,
            damageMultiplier: 1.8,
          },
        ],
        adds: [],
        designNotes:
          'Teaches the heat cycle. Floor heats slowly (30s to danger). Magma puddles block ' +
          'safe spots. Heat Vent knockback is gentle, mainly repositions.',
      },
      {
        phase: 2,
        hpThreshold: 0.65,
        abilities: [
          {
            id: 'magma_spit_5',
            name: 'Magma Spit+',
            description: 'Lobs 5 magma globs, larger puddles.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.7,
            cooldown: 3.5,
            damageMultiplier: 1.0,
          },
          {
            id: 'heat_vent',
            name: 'Heat Vent',
            description: 'Same channel but floor heats faster after the reset.',
            telegraph: 'ring',
            telegraphDuration: 2.0,
            cooldown: 15,
            damageMultiplier: 1.8,
          },
          {
            id: 'eruption',
            name: 'Eruption',
            description:
              'Targets player position. After 1.2s, a column of fire erupts dealing heavy damage ' +
              'in a small radius. Three eruptions chain in sequence tracking the player.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.2,
            cooldown: 7,
            damageMultiplier: 2.0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 4 }],
            interval: 0,
            formation: 'surround',
          },
        ],
        designNotes:
          'Eruption chasing forces continuous movement. Floor heats 50% faster. ' +
          'Rushers pressure during eruption dodging.',
      },
      {
        phase: 3,
        hpThreshold: 0.35,
        abilities: [
          {
            id: 'magma_barrage',
            name: 'Magma Barrage',
            description: 'Rapid-fire 8 small magma globs over 2s in random directions.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 5,
            damageMultiplier: 0.6,
          },
          {
            id: 'heat_vent_empowered',
            name: 'Empowered Heat Vent',
            description:
              'Stronger knockback. Spawns a ring of fire at the knockback landing zone. ' +
              'Players must dodge through the ring or take burn damage.',
            telegraph: 'ring',
            telegraphDuration: 2.0,
            cooldown: 12,
            damageMultiplier: 2.0,
          },
          {
            id: 'eruption_5chain',
            name: 'Eruption Chain',
            description: 'Five eruptions chasing the player in sequence, faster tracking.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.0,
            cooldown: 6,
            damageMultiplier: 2.0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 2 }, { type: 'tank', count: 1 }],
            interval: 14,
            formation: 'column',
          },
        ],
        designNotes:
          'Empowered vent creates a landing trap. Must plan escape route before vent finishes. ' +
          'Tank add body-blocks retreat paths.',
      },
      {
        phase: 4,
        hpThreshold: 0.1,
        abilities: [
          {
            id: 'total_meltdown',
            name: 'Total Meltdown',
            description:
              'Boss becomes stationary and begins a 15s channel. Floor ignites outward from boss ' +
              'in waves, leaving only a thin ring of safe tiles that slowly shrinks. If the boss ' +
              'finishes the channel, the entire arena ignites for lethal damage.',
            telegraph: 'ring',
            telegraphDuration: 1.0,
            cooldown: 999,
            damageMultiplier: 10.0,
          },
          {
            id: 'magma_barrage',
            name: 'Magma Barrage',
            description: 'Continues during Total Meltdown channel.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 3,
            damageMultiplier: 0.6,
          },
        ],
        adds: [],
        designNotes:
          'Final DPS check. Kill the boss before the channel completes. ' +
          'Safe ring forces close-range combat for ranged players.',
      },
    ],
    enrage: {
      type: 'arena_shrink',
      description:
        'Floor heat accumulates 20% faster each Heat Vent cycle. After 100s the floor ' +
        'becomes permanently on fire with only a small safe zone near the boss.',
    },
    rangerStrategy:
      'Kite in circles to avoid eruption chains. Evasive Roll through fire ring after vent. ' +
      'Save Trap for rush adds. Power Shot has good uptime during Heat Vent channel windows. ' +
      'Phase 4 forces close range -- switch to rapid-fire Multi Shot.',
    mageStrategy:
      'Frost Nova is king here -- slows rushers and provides breathing room. Teleport through fire rings. ' +
      'Arcane Wall blocks magma glob trajectories. Meteor during Heat Vent channel for huge damage. ' +
      'Phase 4 Frost Nova the shrinking ring to buy seconds.',
    designIntent: 'DPS race with a rhythmic cycle. Teaches managing damage-over-time and knockback recovery.',
  },

  // =========================================================================
  // 4. CRYO MATRIX -- Frozen Array
  // =========================================================================
  {
    id: 'cryo_matrix',
    name: 'Cryo Matrix',
    zone: 'frozen_array',
    phaseCount: 4,
    shape: 'Snowflake geometry -- hexagonal core with 6 extending crystal arms. Arms break off as phases progress.',
    primaryColor: 0x88ccff,
    accentColor: 0xffffff,
    radius: 48,
    hpMultiplier: 1.3,
    damageMultiplier: 0.8,
    baseSpeed: 35,
    signatureMechanic: {
      name: 'Permafrost',
      description:
        'Cryo Matrix coats the arena floor in ice patches that cause sliding (momentum-based movement ' +
        'override for 0.5s when stepping on ice). Ice patches expand over time. The boss can shatter ' +
        'ice patches to create crystal shrapnel projectiles. Safe (non-icy) ground shrinks as the fight ' +
        'progresses. Destroying the boss crystal arms (targetable sub-entities) temporarily melts ' +
        'nearby ice, creating safe zones.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'ice_shard',
            name: 'Ice Shard Volley',
            description: 'Fires a fan of 5 ice shards in a cone toward the player. Applies Chill on hit.',
            telegraph: 'cone',
            telegraphDuration: 0.6,
            cooldown: 3,
            damageMultiplier: 0.7,
          },
          {
            id: 'freeze_ground',
            name: 'Freeze Ground',
            description: 'Coats a 3x3 tile area under the player with ice. Standing still on ice applies Slow.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.8,
            cooldown: 6,
            damageMultiplier: 0,
          },
        ],
        adds: [],
        designNotes: 'Teaches ice sliding mechanic. Low danger, player learns to avoid ice patches.',
      },
      {
        phase: 2,
        hpThreshold: 0.65,
        abilities: [
          {
            id: 'ice_shard_tracking',
            name: 'Tracking Shards',
            description: 'Fires 3 ice shards that curve toward the player, applying Chill.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2.5,
            damageMultiplier: 0.7,
          },
          {
            id: 'ice_shatter',
            name: 'Ice Shatter',
            description:
              'Detonates all ice patches, launching crystal shrapnel in all directions. ' +
              'More ice on the ground = more projectiles. Then re-freezes a new pattern.',
            telegraph: 'pulse',
            telegraphDuration: 1.0,
            cooldown: 10,
            damageMultiplier: 1.0,
          },
          {
            id: 'crystal_wall',
            name: 'Crystal Wall',
            description: 'Raises a wall of ice crystals between boss and player. Blocks projectiles, must go around.',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 8,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'sniper', count: 2 }],
            interval: 0,
            formation: 'pincer',
          },
        ],
        designNotes:
          'Ice Shatter punishes players who let too much ice accumulate. Crystal Wall forces repositioning. ' +
          'Snipers add pressure from range.',
      },
      {
        phase: 3,
        hpThreshold: 0.35,
        abilities: [
          {
            id: 'blizzard',
            name: 'Blizzard',
            description:
              'Channels for 4s. Random ice shards rain across the arena (telegraphed circles). ' +
              'Applies Chill stacks. At 3 stacks, player is Frozen (stunned 1s).',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.5,
            cooldown: 12,
            damageMultiplier: 0.5,
          },
          {
            id: 'ice_shatter',
            name: 'Ice Shatter',
            description: 'Faster, bigger detonation. Shrapnel count doubled.',
            telegraph: 'pulse',
            telegraphDuration: 0.8,
            cooldown: 8,
            damageMultiplier: 1.2,
          },
          {
            id: 'flash_freeze',
            name: 'Flash Freeze',
            description:
              'Targets a large circle around the player. After 1s, everything inside freezes. ' +
              'Must leave the zone or be stunned for 2s.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.0,
            cooldown: 7,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'sniper', count: 1 }, { type: 'shielder', count: 2 }],
            interval: 16,
            formation: 'shieldWall',
          },
        ],
        designNotes:
          'Chill stacking mechanic creates urgency. Flash Freeze into Blizzard combo is the skill check. ' +
          'Shielders protect snipers, requiring flanking.',
      },
      {
        phase: 4,
        hpThreshold: 0.15,
        abilities: [
          {
            id: 'absolute_zero',
            name: 'Absolute Zero',
            description:
              'Entire arena freezes. Boss pulses cold damage every 0.5s. Player takes increasing Chill ' +
              'stacks. Breaking the 4 crystal arms (sub-entities at compass points, low HP) creates temporary ' +
              'warm zones that negate Chill. All 4 arms regenerate after 8s.',
            telegraph: 'ring',
            telegraphDuration: 2.0,
            cooldown: 20,
            damageMultiplier: 0.3,
          },
        ],
        adds: [],
        designNotes:
          'Survival phase. Must cycle between destroying arms and DPSing boss. ' +
          'Arms at compass points create a rotation pattern.',
      },
    ],
    enrage: {
      type: 'damage_ramp',
      description:
        'Chill damage ticks increase by 10% every 15s. After 90s, Chill stacking rate doubles. ' +
        'Eventually unavoidable freeze-lock unless boss is killed.',
    },
    rangerStrategy:
      'Pierce shots through Crystal Walls. Evasive Roll cancels ice slide momentum. ' +
      'Rain of Arrows on clustered ice patches before Shatter to pre-clear them. ' +
      'Mark Target on crystal arms in phase 4 for quick breaks.',
    mageStrategy:
      'Teleport ignores ice sliding. Lightning Chain bounces off crystal arms efficiently. ' +
      'Arcane Wall to block crystal shrapnel from Ice Shatter. ' +
      'Fireball splash can hit boss through Crystal Walls at angles.',
    designIntent: 'Control-based fight. Teaches debuff management and sub-entity targeting.',
  },

  // =========================================================================
  // 5. OVERMIND -- Overgrowth
  // =========================================================================
  {
    id: 'overmind',
    name: 'Overmind',
    zone: 'overgrowth',
    phaseCount: 3,
    shape: 'Large pentagon with organic tendrils extending outward. Tendrils retract and extend rhythmically.',
    primaryColor: 0x44dd88,
    accentColor: 0x88ff44,
    radius: 50,
    hpMultiplier: 1.6,
    damageMultiplier: 0.7,
    baseSpeed: 30,
    signatureMechanic: {
      name: 'Hive Network',
      description:
        'Overmind is a summoner boss that fights through its minions. It continuously spawns adds ' +
        'and buffs them with proximity auras. Adds within 100px of the boss gain +30% speed and ' +
        '+20% damage. The boss itself has very high HP but low personal damage. When adds die near ' +
        'the boss, it absorbs their life force and heals for 5% of the add\'s max HP. The strategy ' +
        'is to kite adds away from the boss before killing them and to burst the boss during ' +
        'windows when it is isolated.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'tendril_whip',
            name: 'Tendril Whip',
            description: 'Sweeps a tendril in an arc. Short range but wide cone.',
            telegraph: 'cone',
            telegraphDuration: 0.5,
            cooldown: 3,
            damageMultiplier: 1.0,
          },
          {
            id: 'spore_cloud',
            name: 'Spore Cloud',
            description: 'Places a poison cloud at player position. Lingers 5s, deals DoT inside.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.0,
            cooldown: 6,
            damageMultiplier: 0.4,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 6 }],
            interval: 8,
            formation: 'surround',
          },
        ],
        designNotes:
          'Constant swarm pressure. Boss moves slowly, stays mostly in center. ' +
          'Player must manage add count while chipping at boss HP.',
      },
      {
        phase: 2,
        hpThreshold: 0.55,
        abilities: [
          {
            id: 'tendril_slam',
            name: 'Tendril Slam',
            description:
              'Slams all 5 tendrils into the ground in sequence, each targeting the player position. ' +
              'Creates small AoE on impact.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.4,
            cooldown: 5,
            damageMultiplier: 1.2,
          },
          {
            id: 'spore_cloud',
            name: 'Spore Cloud',
            description: 'Two clouds placed simultaneously.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.8,
            cooldown: 5,
            damageMultiplier: 0.4,
          },
          {
            id: 'root_snare',
            name: 'Root Snare',
            description:
              'Roots erupt from the ground under the player. If hit, player is rooted for 1.5s. ' +
              'Roots are destructible (one hit breaks them).',
            telegraph: 'ground_marker',
            telegraphDuration: 0.6,
            cooldown: 8,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 4 }, { type: 'splitter', count: 2 }],
            interval: 10,
            formation: 'chaoticSwarm',
          },
        ],
        designNotes:
          'Splitters add exponential pressure if not managed. Root Snare during Tendril Slam is the combo threat. ' +
          'Boss healing from nearby add deaths becomes a real problem.',
      },
      {
        phase: 3,
        hpThreshold: 0.2,
        abilities: [
          {
            id: 'overgrowth_surge',
            name: 'Overgrowth Surge',
            description:
              'Boss channels for 3s. All living adds rush the player at double speed. After channel, ' +
              'boss is vulnerable (slowed 50%) for 4s. Major damage window if adds are cleared first.',
            telegraph: 'pulse',
            telegraphDuration: 1.0,
            cooldown: 15,
            damageMultiplier: 0,
          },
          {
            id: 'tendril_nova',
            name: 'Tendril Nova',
            description: 'All tendrils slam simultaneously in a full ring around the boss.',
            telegraph: 'ring',
            telegraphDuration: 0.8,
            cooldown: 4,
            damageMultiplier: 1.5,
          },
          {
            id: 'root_snare_field',
            name: 'Root Field',
            description: 'Places 5 root snares in a spread pattern.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.5,
            cooldown: 7,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 6 }, { type: 'splitter', count: 3 }, { type: 'tank', count: 1 }],
            interval: 12,
            formation: 'surround',
          },
        ],
        designNotes:
          'Overgrowth Surge is risk/reward: clear adds first for a safe damage window, or try to ' +
          'burst boss while adds are rushing. Tank add absorbs player damage meant for boss.',
      },
    ],
    enrage: {
      type: 'soft_escalation',
      description:
        'Add spawn rate increases by 1 enemy every 20s. Boss heal-on-add-death increases to 10%. ' +
        'After 120s, add spawn rate doubles. Eventually overwhelms any player who cannot out-DPS the healing.',
    },
    rangerStrategy:
      'Multi Shot and Rain of Arrows for add clear. Kite adds away from boss before killing. ' +
      'Power Shot on boss during Overgrowth Surge vulnerability window. Trap on root snare locations. ' +
      'Mark Target on boss for damage windows.',
    mageStrategy:
      'This fight is Mage-favored. Fireball splash clears swarms. Lightning Chain bounces through packs. ' +
      'Frost Nova before Overgrowth Surge to slow the add rush. Arcane Wall to separate adds from boss. ' +
      'Meteor on boss during vulnerability window.',
    designIntent: 'Add management fight. Teaches target priority and resource management.',
  },

  // =========================================================================
  // 6. ARC TYRANT -- Storm Network
  // =========================================================================
  {
    id: 'arc_tyrant',
    name: 'Arc Tyrant',
    zone: 'storm_network',
    phaseCount: 3,
    shape: 'Jagged bolt-shaped body (zigzag polygon). Constantly sparking with small lightning arcs between points.',
    primaryColor: 0xffdd44,
    accentColor: 0xffffff,
    radius: 36,
    hpMultiplier: 1.1,
    damageMultiplier: 1.2,
    baseSpeed: 90,
    signatureMechanic: {
      name: 'Chain Conductor',
      description:
        'Arc Tyrant places lightning rods around the arena. When the boss fires its chain lightning, ' +
        'it bounces between rods, creating persistent arc beams between them for 3s. The player must ' +
        'not cross arc beams. The twist: the player character also conducts lightning. Standing too close ' +
        'to a rod causes a bolt to arc to the player. Rods can be destroyed, but the boss replaces them. ' +
        'The optimal play is to position so the chain lightning path misses you, not to destroy all rods.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'chain_lightning',
            name: 'Chain Lightning',
            description:
              'Fires a bolt that bounces between up to 3 lightning rods, creating arc beams. ' +
              'Deals damage to player if they are the closest conductor.',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 4,
            damageMultiplier: 1.0,
          },
          {
            id: 'place_rod',
            name: 'Plant Rod',
            description: 'Throws a lightning rod that embeds in the ground. Max 4 rods.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.3,
            cooldown: 8,
            damageMultiplier: 0,
          },
          {
            id: 'static_dash',
            name: 'Static Dash',
            description: 'Boss dashes between two rods instantly, damaging anything in the path.',
            telegraph: 'line',
            telegraphDuration: 0.6,
            cooldown: 6,
            damageMultiplier: 1.3,
          },
        ],
        adds: [],
        designNotes: 'Teaches rod mechanics. Few rods, predictable chain paths. Static Dash is the main threat.',
      },
      {
        phase: 2,
        hpThreshold: 0.55,
        abilities: [
          {
            id: 'chain_lightning_5',
            name: 'Chain Lightning+',
            description: 'Bounces between up to 5 rods. Arc beams persist 4s.',
            telegraph: 'line',
            telegraphDuration: 0.4,
            cooldown: 3,
            damageMultiplier: 1.0,
          },
          {
            id: 'place_rod_double',
            name: 'Plant Rod x2',
            description: 'Throws 2 rods at once. Max 6 rods.',
            telegraph: 'ground_marker',
            telegraphDuration: 0.3,
            cooldown: 7,
            damageMultiplier: 0,
          },
          {
            id: 'static_dash',
            name: 'Static Dash',
            description: 'Now chains through 2 rods (triangular dash path).',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 5,
            damageMultiplier: 1.3,
          },
          {
            id: 'overcharge',
            name: 'Overcharge',
            description:
              'Boss charges up for 1.5s, then releases a ring of lightning that expands outward. ' +
              'Jump over it (gap in the ring) or dodge through.',
            telegraph: 'ring',
            telegraphDuration: 1.5,
            cooldown: 9,
            damageMultiplier: 1.5,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 3 }, { type: 'flanker', count: 2 }],
            interval: 0,
            formation: 'pincer',
          },
        ],
        designNotes:
          'More rods = more complex arc beam networks. Overcharge ring forces movement. ' +
          'Adds pressure movement decisions. Boss is very fast -- hard to kite.',
      },
      {
        phase: 3,
        hpThreshold: 0.2,
        abilities: [
          {
            id: 'storm_cage',
            name: 'Storm Cage',
            description:
              'All rods activate simultaneously, creating a cage of arc beams around the player. ' +
              'One gap in the cage rotates clockwise. Player must track the gap while DPSing boss. ' +
              'Lasts 6s.',
            telegraph: 'pulse',
            telegraphDuration: 1.0,
            cooldown: 12,
            damageMultiplier: 1.2,
          },
          {
            id: 'chain_lightning_constant',
            name: 'Rapid Chain',
            description: 'Chain lightning fires every 1.5s.',
            telegraph: 'line',
            telegraphDuration: 0.3,
            cooldown: 1.5,
            damageMultiplier: 0.8,
          },
          {
            id: 'thunder_slam',
            name: 'Thunder Slam',
            description: 'Boss jumps to player position, AoE on landing, places a rod at the impact point.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.8,
            cooldown: 5,
            damageMultiplier: 2.0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'flanker', count: 4 }],
            interval: 15,
            formation: 'surround',
          },
        ],
        designNotes:
          'Storm Cage is the signature phase 3 mechanic. Rotating gap requires constant repositioning. ' +
          'Thunder Slam adds rods, making future cages more complex. Boss is relentless.',
      },
    ],
    enrage: {
      type: 'hard_timer',
      timerSeconds: 90,
      description:
        'After 90s, Arc Tyrant permanently enters Storm Cage mode. Rod count maxes at 8. ' +
        'Chain lightning fires every second. Arena becomes an electric death trap.',
    },
    rangerStrategy:
      'Fast fight due to enrage timer. Evasive Roll through arc beams (i-frames). ' +
      'Destroy rods with Power Shot to simplify chain paths (pick your battles). ' +
      'Multi Shot the flanker adds quickly. This is a pure dodging fight for Ranger.',
    mageStrategy:
      'Teleport through arc beams. Frost Nova slows the fast boss. Lightning Chain actually ' +
      'bounces off rods dealing damage to boss if positioned correctly (ironic synergy). ' +
      'Arcane Wall blocks static dash path. Meteor during Storm Cage when boss is predictable.',
    designIntent: 'Speed and spatial awareness fight. Teaches reading complex patterns and finding safe lanes.',
  },

  // =========================================================================
  // 7. DREAD HOLLOW -- The Abyss
  // =========================================================================
  {
    id: 'dread_hollow',
    name: 'Dread Hollow',
    zone: 'the_abyss',
    phaseCount: 5,
    shape: 'Amorphous blob with a single glowing eye. Shape undulates and shifts. Nearly invisible until close.',
    primaryColor: 0x4444aa,
    accentColor: 0x2222ff,
    radius: 46,
    hpMultiplier: 1.5,
    damageMultiplier: 1.0,
    baseSpeed: 50,
    signatureMechanic: {
      name: 'Encroaching Darkness',
      description:
        'The arena has a limited light radius centered on the player (visibility circle). ' +
        'Enemies outside the light circle are invisible. The boss can extinguish portions of ' +
        'the light by spawning darkness zones. The player\'s light radius shrinks over the course ' +
        'of the fight. Light pickups (glowing orbs) spawn periodically and restore light radius ' +
        'when collected. The boss takes 25% more damage when inside the player\'s light circle, ' +
        'creating a push-pull: stay near the boss to damage it efficiently, but its attacks are ' +
        'more dangerous up close.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'shadow_bolt',
            name: 'Shadow Bolt',
            description: 'Fires a slow-moving dark projectile. Nearly invisible until within light radius.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2,
            damageMultiplier: 0.8,
          },
          {
            id: 'darkness_zone',
            name: 'Darkness Zone',
            description: 'Creates a dark patch that extinguishes light in a small area for 8s.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.0,
            cooldown: 10,
            damageMultiplier: 0,
          },
        ],
        adds: [],
        designNotes: 'Teaches darkness mechanic. Light radius is generous. Shadow Bolts force awareness.',
      },
      {
        phase: 2,
        hpThreshold: 0.75,
        abilities: [
          {
            id: 'shadow_volley',
            name: 'Shadow Volley',
            description: 'Fires 5 shadow bolts in a spread.',
            telegraph: 'cone',
            telegraphDuration: 0.4,
            cooldown: 3,
            damageMultiplier: 0.7,
          },
          {
            id: 'vanish',
            name: 'Vanish',
            description:
              'Boss turns invisible for 3s, repositions behind player. First attack after reappearing ' +
              'deals 1.5x damage. A faint sound cue plays 0.5s before it strikes.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 8,
            damageMultiplier: 1.5,
          },
          {
            id: 'darkness_zone',
            name: 'Darkness Zone',
            description: 'Places 2 darkness zones.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.8,
            cooldown: 8,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 5 }],
            interval: 0,
            formation: 'chaoticSwarm',
          },
        ],
        designNotes:
          'Vanish mechanic. Audio cue is the only warning. Swarm adds emerge from the darkness. ' +
          'Light radius reduced to 75%.',
      },
      {
        phase: 3,
        hpThreshold: 0.5,
        abilities: [
          {
            id: 'shadow_nova',
            name: 'Shadow Nova',
            description: 'Ring of dark energy expands outward from boss. Dodgeable via the gap.',
            telegraph: 'ring',
            telegraphDuration: 0.8,
            cooldown: 5,
            damageMultiplier: 1.2,
          },
          {
            id: 'vanish_triple',
            name: 'Phantom Strike',
            description: 'Vanishes and strikes 3 times in rapid succession from different angles.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 10,
            damageMultiplier: 1.0,
          },
          {
            id: 'devour_light',
            name: 'Devour Light',
            description: 'Destroys all active light pickups and shrinks player light by 15%.',
            telegraph: 'pulse',
            telegraphDuration: 1.5,
            cooldown: 20,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'flanker', count: 3 }],
            interval: 12,
            formation: 'surround',
          },
        ],
        designNotes:
          'Phantom Strike combo is the skill check. Devour Light makes pickup management critical. ' +
          'Light radius at 60%.',
      },
      {
        phase: 4,
        hpThreshold: 0.25,
        abilities: [
          {
            id: 'shadow_barrage',
            name: 'Shadow Barrage',
            description: 'Continuous stream of shadow bolts from multiple angles (darkness clones).',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 1,
            damageMultiplier: 0.5,
          },
          {
            id: 'vanish_triple',
            name: 'Phantom Strike',
            description: 'Now 4 strikes.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 8,
            damageMultiplier: 1.0,
          },
          {
            id: 'darkness_flood',
            name: 'Darkness Flood',
            description: 'Places 4 large darkness zones. Only small patches of lit ground remain.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.0,
            cooldown: 15,
            damageMultiplier: 0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'flanker', count: 2 }, { type: 'sniper', count: 2 }],
            interval: 14,
            formation: 'pincer',
          },
        ],
        designNotes:
          'Near-darkness. Light radius at 40%. Snipers firing from the dark are extremely dangerous. ' +
          'Sound cues become critical for survival.',
      },
      {
        phase: 5,
        hpThreshold: 0.1,
        abilities: [
          {
            id: 'total_darkness',
            name: 'Total Darkness',
            description:
              'Light radius reduced to 10%. Boss glows faintly. Only the boss eye and player are visible. ' +
              'All abilities fire faster. Light pickups spawn at double rate as a lifeline.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 999,
            damageMultiplier: 0,
          },
          {
            id: 'shadow_barrage',
            name: 'Shadow Barrage',
            description: '2 bolts per second from random dark angles.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 0.5,
            damageMultiplier: 0.5,
          },
        ],
        adds: [],
        designNotes:
          'Pure atmosphere. Minimal visibility, maximum tension. Boss takes 50% bonus damage in light (was 25%) ' +
          'as a mercy mechanic. Light pickups are the lifeline.',
      },
    ],
    enrage: {
      type: 'soft_escalation',
      description:
        'Player light radius passively shrinks by 5% every 15s. After 150s, light radius hits 0 ' +
        'and the player takes constant darkness damage (2% max HP per second).',
    },
    rangerStrategy:
      'Long range is your friend -- shoot from light edge to keep boss in light for damage bonus. ' +
      'Evasive Roll toward light pickups. Trap placement at your feet before Phantom Strike as a ' +
      'reactive defense. Rain of Arrows to hit invisible adds.',
    mageStrategy:
      'Frost Nova is critical for detecting invisible enemies (applies Chill, revealing them). ' +
      'Teleport to light pickups. Fireball lights up the area briefly on explosion (visual aid). ' +
      'Arcane Wall behind you to block Phantom Strike flanks.',
    designIntent: 'Atmosphere and awareness fight. Teaches players to use audio cues and manage a shrinking resource.',
  },

  // =========================================================================
  // 8. PRISM LORD -- Chromatic Rift
  // =========================================================================
  {
    id: 'prism_lord',
    name: 'Prism Lord',
    zone: 'chromatic_rift',
    phaseCount: 4,
    shape: 'Dodecahedron (12-sided polygon). Each face a different neon color. Rotates slowly, active face glows brightest.',
    primaryColor: 0xff44ff,
    accentColor: 0xffffff,
    radius: 50,
    hpMultiplier: 1.8,
    damageMultiplier: 1.0,
    baseSpeed: 40,
    signatureMechanic: {
      name: 'Chromatic Shift',
      description:
        'Prism Lord cycles between 3 elemental states (Fire/Ice/Lightning), each lasting 10s. ' +
        'In Fire state: melee-range fire aura damages nearby players, projectiles leave burning trails. ' +
        'In Ice state: slowing aura, freezing projectiles, ice armor reduces damage taken by 30%. ' +
        'In Lightning state: fast movement, chain attacks, but takes 20% more damage (vulnerability window). ' +
        'The player must adapt their positioning each shift: stay close during Lightning (DPS window, ' +
        'but dodge chains), stay far during Fire (avoid aura), and kite carefully during Ice (avoid freeze). ' +
        'On phase 3+, shifts happen every 6s and transitions cause a burst of the departing element.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'fire_breath',
            name: 'Fire Breath',
            description: 'Cone of fire in front. Only used in Fire state.',
            telegraph: 'cone',
            telegraphDuration: 0.6,
            cooldown: 3,
            damageMultiplier: 1.0,
          },
          {
            id: 'ice_lance',
            name: 'Ice Lance',
            description: 'Line of ice shards. Applies Chill. Only used in Ice state.',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 2.5,
            damageMultiplier: 0.8,
          },
          {
            id: 'lightning_arc',
            name: 'Lightning Arc',
            description: 'Chain lightning between boss and 2 nearest entities (adds or player).',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2,
            damageMultiplier: 0.9,
          },
          {
            id: 'chromatic_shift',
            name: 'Chromatic Shift',
            description: 'Cycles to next element every 10s.',
            telegraph: 'screen_flash',
            telegraphDuration: 0.5,
            cooldown: 10,
            damageMultiplier: 0,
          },
        ],
        adds: [],
        designNotes:
          'Teaches the 3-state cycle. Long shift timers. Each state has a clear visual/color change. ' +
          'Lightning state is the DPS window.',
      },
      {
        phase: 2,
        hpThreshold: 0.65,
        abilities: [
          {
            id: 'fire_rain',
            name: 'Fire Rain',
            description: 'Multiple fire circles rain down during Fire state. Area denial.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.8,
            cooldown: 4,
            damageMultiplier: 1.0,
          },
          {
            id: 'blizzard_prism',
            name: 'Prism Blizzard',
            description: 'Arena-wide ice shard rain during Ice state. Must keep moving.',
            telegraph: 'circle_aoe',
            telegraphDuration: 0.5,
            cooldown: 5,
            damageMultiplier: 0.6,
          },
          {
            id: 'storm_surge',
            name: 'Storm Surge',
            description: 'Fast dash-and-strike pattern during Lightning state. 3 dashes in sequence.',
            telegraph: 'line',
            telegraphDuration: 0.3,
            cooldown: 5,
            damageMultiplier: 1.2,
          },
          {
            id: 'chromatic_shift',
            name: 'Chromatic Shift',
            description: 'Shifts every 8s. Transition burst deals element damage in a ring.',
            telegraph: 'ring',
            telegraphDuration: 0.5,
            cooldown: 8,
            damageMultiplier: 1.0,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 2 }, { type: 'sniper', count: 2 }],
            interval: 0,
            formation: 'surround',
          },
        ],
        designNotes:
          'Each state now has area denial. Transition burst makes state changes dangerous. ' +
          'Storm Surge during Lightning makes the DPS window more risky.',
      },
      {
        phase: 3,
        hpThreshold: 0.35,
        abilities: [
          {
            id: 'prismatic_beam',
            name: 'Prismatic Beam',
            description:
              'Fires a rotating beam that sweeps 360 degrees over 3s. Changes element as it rotates ' +
              '(fire -> ice -> lightning). Each element applies its debuff.',
            telegraph: 'line',
            telegraphDuration: 1.0,
            cooldown: 8,
            damageMultiplier: 1.5,
          },
          {
            id: 'elemental_clones',
            name: 'Elemental Clones',
            description:
              'Spawns 2 elemental copies of itself (one Fire, one Ice) that use the boss abilities ' +
              'of their respective states. Clones have 20% of boss max HP.',
            telegraph: 'screen_flash',
            telegraphDuration: 1.5,
            cooldown: 25,
            damageMultiplier: 0,
          },
          {
            id: 'chromatic_shift_rapid',
            name: 'Rapid Shift',
            description: 'Element shifts every 6s. Transition burst larger.',
            telegraph: 'ring',
            telegraphDuration: 0.4,
            cooldown: 6,
            damageMultiplier: 1.2,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'shielder', count: 1 }, { type: 'tank', count: 1 }, { type: 'flanker', count: 2 }],
            interval: 18,
            formation: 'shieldWall',
          },
        ],
        designNotes:
          'Prismatic Beam is the signature attack -- must jump/dodge the rotating beam. ' +
          'Clones create chaos. Rapid shifts demand fast adaptation.',
      },
      {
        phase: 4,
        hpThreshold: 0.1,
        abilities: [
          {
            id: 'chromatic_overload',
            name: 'Chromatic Overload',
            description:
              'All 3 elements activate simultaneously. Fire aura + ice armor + lightning speed. ' +
              'Boss cycles through all attacks with no element restriction. Overwhelming but boss ' +
              'also takes 15% more damage in this unstable state.',
            telegraph: 'screen_flash',
            telegraphDuration: 2.0,
            cooldown: 999,
            damageMultiplier: 0,
          },
          {
            id: 'prismatic_beam',
            name: 'Prismatic Beam',
            description: 'Fires every 6s during Overload.',
            telegraph: 'line',
            telegraphDuration: 0.8,
            cooldown: 6,
            damageMultiplier: 1.5,
          },
        ],
        adds: [],
        designNotes:
          'Final chaos phase. Everything at once. The 15% vulnerability and no more adds is the mercy. ' +
          'Pure mechanical execution test.',
      },
    ],
    enrage: {
      type: 'damage_ramp',
      description:
        'Each Chromatic Shift increases boss damage by 5% (stacking). After 8+ shifts (60-80s), ' +
        'boss damage is doubled. Chromatic Overload activates permanently if fight exceeds 120s.',
    },
    rangerStrategy:
      'Exploit Lightning state vulnerability -- Power Shot + Mark Target for burst. ' +
      'Stay at max range during Fire state. Evasive Roll through transition bursts. ' +
      'Multi Shot for clone clear. Rain of Arrows during Ice state when boss is slow.',
    mageStrategy:
      'Frost Nova counters Lightning state dash patterns. Teleport through Prismatic Beam. ' +
      'Fireball clones efficiently (splash hits both if clustered). Meteor on Lightning state ' +
      'vulnerability for massive burst. Arcane Wall blocks Fire Breath cone.',
    designIntent: 'Adaptation fight. Teaches reading boss state and changing strategy on the fly. Final exam boss.',
  },

  // =========================================================================
  // 9. RECURSION -- Chromatic Rift (alt boss)
  // =========================================================================
  {
    id: 'recursion',
    name: 'Recursion',
    zone: 'chromatic_rift',
    phaseCount: 4,
    shape: 'Fractal triangle (Sierpinski pattern). Each phase adds a depth level to the fractal. Shifts and rotates.',
    primaryColor: 0x00ff88,
    accentColor: 0x44ffcc,
    radius: 44,
    hpMultiplier: 1.3,
    damageMultiplier: 0.9,
    baseSpeed: 60,
    signatureMechanic: {
      name: 'Fractal Split',
      description:
        'When Recursion reaches a phase threshold, it splits into 2 smaller copies of itself, ' +
        'each with the remaining HP pool divided between them. Both copies must be killed within ' +
        '8s of each other, or the surviving copy absorbs the dead one and regenerates to the phase ' +
        'threshold HP. In phase 3, it splits into 3 copies. Each copy has reduced abilities but they ' +
        'coordinate attacks. This is a DPS balancing puzzle: you must damage copies evenly.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'fractal_bolt',
            name: 'Fractal Bolt',
            description: 'Fires a projectile that splits into 2 smaller projectiles after 0.5s travel.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2.5,
            damageMultiplier: 0.8,
          },
          {
            id: 'mirror_dash',
            name: 'Mirror Dash',
            description: 'Dashes toward player, leaving a mirror image at the start point that fires one bolt.',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 5,
            damageMultiplier: 1.0,
          },
        ],
        adds: [],
        designNotes: 'Single boss. Teaches splitting projectile patterns. Mirror images foreshadow the split mechanic.',
      },
      {
        phase: 2,
        hpThreshold: 0.65,
        abilities: [
          {
            id: 'fractal_spray',
            name: 'Fractal Spray',
            description: 'Each copy fires a spread of 3 bolts, each splitting into 2 (9 total projectiles per copy).',
            telegraph: 'cone',
            telegraphDuration: 0.4,
            cooldown: 3,
            damageMultiplier: 0.6,
          },
          {
            id: 'mirror_dash',
            name: 'Mirror Dash',
            description: 'Both copies dash simultaneously from different angles.',
            telegraph: 'line',
            telegraphDuration: 0.5,
            cooldown: 5,
            damageMultiplier: 1.0,
          },
          {
            id: 'convergence',
            name: 'Convergence',
            description:
              'Both copies dash toward each other. If they overlap, they merge briefly and ' +
              'release a large AoE burst. Creates a no-go zone between them.',
            telegraph: 'line',
            telegraphDuration: 0.8,
            cooldown: 10,
            damageMultiplier: 1.8,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 4 }],
            interval: 0,
            formation: 'chaoticSwarm',
          },
        ],
        designNotes:
          'First split into 2 copies. Must damage both evenly. Convergence punishes letting them group up. ' +
          'Swarm adds complicate target switching.',
      },
      {
        phase: 3,
        hpThreshold: 0.35,
        abilities: [
          {
            id: 'fractal_storm',
            name: 'Fractal Storm',
            description:
              'All 3 copies channel simultaneously. Splitting projectiles rain from all 3 directions. ' +
              'Must find the gap between the 3 firing arcs.',
            telegraph: 'cone',
            telegraphDuration: 0.6,
            cooldown: 7,
            damageMultiplier: 0.5,
          },
          {
            id: 'convergence_triple',
            name: 'Triple Convergence',
            description: 'All 3 copies dash toward center. Massive AoE if all three overlap.',
            telegraph: 'ground_marker',
            telegraphDuration: 1.0,
            cooldown: 12,
            damageMultiplier: 2.5,
          },
          {
            id: 'fractal_bolt',
            name: 'Fractal Bolt',
            description: 'Each copy fires independently. 3x the projectile density.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 2,
            damageMultiplier: 0.6,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'splitter', count: 3 }],
            interval: 0,
            formation: 'surround',
          },
        ],
        designNotes:
          'Three copies. Must kill all within 8s window. Splitter adds echo the fractal theme. ' +
          'Triple Convergence is the biggest threat -- must not be between all 3.',
      },
      {
        phase: 4,
        hpThreshold: 0.1,
        abilities: [
          {
            id: 'final_recursion',
            name: 'Final Recursion',
            description:
              'Copies re-merge into one entity. Boss gains all projectile patterns simultaneously. ' +
              'Fires Fractal Storm + splitting bolts nonstop. No more split mechanic. Pure DPS burn.',
            telegraph: 'screen_flash',
            telegraphDuration: 1.5,
            cooldown: 999,
            damageMultiplier: 0,
          },
          {
            id: 'fractal_nova',
            name: 'Fractal Nova',
            description: 'Ring burst that splits into smaller ring bursts. Concentric dodging.',
            telegraph: 'ring',
            telegraphDuration: 0.8,
            cooldown: 4,
            damageMultiplier: 1.0,
          },
        ],
        adds: [],
        designNotes: 'Merged final form. Projectile chaos. Short phase -- either you have the DPS or you do not.',
      },
    ],
    enrage: {
      type: 'soft_escalation',
      description:
        'Each time a copy absorbs its dead twin (failed 8s kill window), it gains a permanent ' +
        '+15% damage and +10% speed stack. After 3 failed splits, the boss is nearly unkillable.',
    },
    rangerStrategy:
      'Pierce shots can hit multiple copies if lined up. Multi Shot for even damage across copies. ' +
      'Mark Target on whichever copy has more HP to balance them. Rain of Arrows for AoE damage ' +
      'during Convergence when copies cluster. Evasive Roll through Fractal Nova rings.',
    mageStrategy:
      'Lightning Chain bounces between copies -- excellent for even damage. Frost Nova slows all ' +
      'copies at once. Fireball splash can hit 2 copies if close. Meteor the Convergence point ' +
      'for massive damage when copies merge.',
    designIntent: 'Multitasking and DPS balancing fight. Teaches even damage distribution and priority management.',
  },

  // =========================================================================
  // 10. NULLPOINT -- The Abyss (alt boss)
  // =========================================================================
  {
    id: 'nullpoint',
    name: 'Nullpoint',
    zone: 'the_abyss',
    phaseCount: 3,
    shape: 'Inverted circle (black hole visual). Ring of white particles orbiting a void center. Warps nearby geometry.',
    primaryColor: 0x220033,
    accentColor: 0x8844cc,
    radius: 40,
    hpMultiplier: 1.2,
    damageMultiplier: 1.3,
    baseSpeed: 0,
    signatureMechanic: {
      name: 'Gravitational Pull',
      description:
        'Nullpoint is stationary but exerts a constant gravitational pull on the player, slowly ' +
        'dragging them toward the center. Movement away from the boss is slowed by 30%, movement ' +
        'toward it is sped up by 30%. The pull strength increases each phase. Contact with the boss ' +
        'deals heavy damage per second. The fight is about maintaining distance while DPSing a stationary ' +
        'target -- simple concept, brutal execution as abilities layer on top of the pull.',
    },
    phases: [
      {
        phase: 1,
        hpThreshold: 1.0,
        abilities: [
          {
            id: 'gravity_well',
            name: 'Gravity Well',
            description:
              'Creates a secondary gravity point that pulls the player sideways. Lasts 5s. ' +
              'Combines with the boss pull to create diagonal drag.',
            telegraph: 'ground_marker',
            telegraphDuration: 1.0,
            cooldown: 8,
            damageMultiplier: 0,
          },
          {
            id: 'void_ring',
            name: 'Void Ring',
            description: 'Expanding ring of void energy from boss center. Must dodge through the gap.',
            telegraph: 'ring',
            telegraphDuration: 0.8,
            cooldown: 4,
            damageMultiplier: 1.0,
          },
          {
            id: 'debris_orbit',
            name: 'Debris Orbit',
            description: '4 debris chunks orbit the boss at medium range. They deal contact damage.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 999,
            damageMultiplier: 0.6,
          },
        ],
        adds: [],
        designNotes:
          'Teaches the gravity mechanic. Pull is gentle (15% strength). Void Ring + pull creates the core ' +
          'dodge challenge: you are being pulled toward the ring.',
      },
      {
        phase: 2,
        hpThreshold: 0.55,
        abilities: [
          {
            id: 'gravity_surge',
            name: 'Gravity Surge',
            description:
              'Pull strength triples for 2s. Player must use movement skills or be dragged into boss. ' +
              'Followed by a repulsion burst that pushes player to arena edge.',
            telegraph: 'pulse',
            telegraphDuration: 1.0,
            cooldown: 10,
            damageMultiplier: 0,
          },
          {
            id: 'void_ring_double',
            name: 'Double Void Ring',
            description: 'Two concentric rings with staggered gaps. Must dodge through both.',
            telegraph: 'ring',
            telegraphDuration: 0.7,
            cooldown: 3.5,
            damageMultiplier: 1.0,
          },
          {
            id: 'event_horizon',
            name: 'Event Horizon',
            description:
              'A damage zone appears at close range around the boss that slowly expands. ' +
              'Shrinks back after 5s. Forces the player to stay at max range temporarily.',
            telegraph: 'circle_aoe',
            telegraphDuration: 1.5,
            cooldown: 12,
            damageMultiplier: 1.5,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'swarm', count: 6 }],
            interval: 12,
            formation: 'surround',
          },
        ],
        designNotes:
          'Pull at 25% strength. Gravity Surge is the phase-defining mechanic. Swarm adds get pulled ' +
          'toward boss too, clustering around it. Event Horizon creates a distance management puzzle.',
      },
      {
        phase: 3,
        hpThreshold: 0.2,
        abilities: [
          {
            id: 'singularity',
            name: 'Singularity',
            description:
              'Boss channels for 4s. Pull maxes out at 100% strength. Everything in the arena slides ' +
              'toward center. Player must fight against the pull using movement skills. After channel, ' +
              'releases a massive AoE at point-blank that one-shots if the player is too close.',
            telegraph: 'pulse',
            telegraphDuration: 1.5,
            cooldown: 15,
            damageMultiplier: 5.0,
          },
          {
            id: 'void_ring_triple',
            name: 'Triple Void Ring',
            description: 'Three concentric rings, very tight gaps.',
            telegraph: 'ring',
            telegraphDuration: 0.5,
            cooldown: 3,
            damageMultiplier: 1.2,
          },
          {
            id: 'debris_orbit_8',
            name: 'Debris Storm',
            description: '8 debris chunks orbiting at variable speeds. Crossing the orbit zone is dangerous.',
            telegraph: 'none',
            telegraphDuration: 0,
            cooldown: 999,
            damageMultiplier: 0.8,
          },
        ],
        adds: [
          {
            enemies: [{ type: 'rusher', count: 4 }, { type: 'flanker', count: 2 }],
            interval: 0,
            formation: 'surround',
          },
        ],
        designNotes:
          'Full gravity. Singularity is the wipe check -- use Evasive Roll/Teleport/movement skills to resist. ' +
          'Triple rings through gravity pull is the hardest dodge in the game.',
      },
    ],
    enrage: {
      type: 'arena_shrink',
      description:
        'The gravitational pull strength increases by 5% every 10s. After 80s, the pull is so ' +
        'strong that the player can barely maintain distance without constant movement skill usage. ' +
        'After 120s, Singularity fires every 8s.',
    },
    rangerStrategy:
      'Movement speed boots are critical. Evasive Roll away from boss constantly. Power Shot has ' +
      'good DPS on a stationary target. Rain of Arrows from max range. Trap placed near boss ' +
      'detonates on pulled-in adds. Mark Target for sustained damage on stationary boss.',
    mageStrategy:
      'Teleport is essential for Gravity Surge and Singularity. Frost Nova the swarm adds being ' +
      'pulled in. Arcane Wall placed near boss creates a "breakwater" against pull. ' +
      'Meteor on stationary boss is free damage. Lightning Chain off clustered pulled-in adds.',
    designIntent: 'Positioning endurance test. Simple concept (stay away from thing pulling you) with layered complexity.',
  },
];
