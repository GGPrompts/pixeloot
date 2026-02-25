/**
 * Wave Formation Designs for Pixeloot
 *
 * This file contains 15 designed wave encounters that go beyond the existing
 * 5 formations (column, pincer, surround, shieldWall, chaoticSwarm). Each
 * design specifies enemy composition, spatial layout, spawn timing, and the
 * tactical challenge it presents.
 *
 * These are design documents -- they reference the existing enemy types from
 * Enemy.ts (rusher, swarm, tank, sniper, flanker, splitter, shielder) and
 * the existing spawn/formation infrastructure in WaveSystem.ts.
 *
 * EXISTING SYSTEM REFERENCE:
 *   Enemy types: rusher (80 spd, 30hp), swarm (100 spd, 10hp), tank (40 spd, 120hp),
 *     sniper (50 spd, 25hp, ranged), flanker (130 spd, 20hp, circles then dashes),
 *     splitter (90 spd, 40hp, splits on death), shielder (60 spd, 60hp, frontal shield)
 *   Formations: column, pincer, surround, shieldWall, chaoticSwarm
 *   Spawn distances: MIN_PLAYER_DIST=200, SURROUND_DIST=400
 *   Stagger delay: 0.3s between sequential spawns
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EnemyType =
  | 'rusher'
  | 'swarm'
  | 'tank'
  | 'sniper'
  | 'flanker'
  | 'splitter'
  | 'shielder';

export type DifficultyTier = 'early' | 'mid' | 'late' | 'boss';

/**
 * Describes where a group of enemies spawns relative to the player or room.
 *
 * - 'relative_to_player': offset is a polar vector from the player position
 *     (angle in radians, distance in pixels). angle=0 means "direction player
 *     is facing"; angle uses the same convention as formation builders
 *     (random base rotation applied at runtime).
 * - 'room_geometry': spawns at a named location in the current room
 *     (entrance, exit, center, corners, corridors).
 */
export type SpawnAnchor =
  | { kind: 'relative_to_player'; angle: number; distance: number }
  | { kind: 'room_geometry'; location: 'entrance' | 'exit' | 'center' | 'corners' | 'corridors' };

export type SpawnTiming =
  | { kind: 'immediate' }
  | { kind: 'staggered'; delaySeconds: number }
  | { kind: 'triggered'; trigger: TriggerCondition };

export type TriggerCondition =
  | { type: 'time_elapsed'; seconds: number }
  | { type: 'enemies_remaining'; count: number }
  | { type: 'enemies_killed'; count: number }
  | { type: 'health_threshold'; targetGroup: string; percent: number };

export interface SpawnGroup {
  /** Identifier for this group within the wave, used by triggers. */
  id: string;
  enemies: { type: EnemyType; count: number }[];
  /** Where this group appears. */
  anchor: SpawnAnchor;
  /** How individual enemies within the group are arranged. */
  spread: 'cluster' | 'line' | 'arc' | 'ring' | 'scattered';
  /** When this group spawns. */
  timing: SpawnTiming;
}

export interface WaveDesign {
  name: string;
  difficulty: DifficultyTier;
  /** Total enemy count across all groups (for quick reference). */
  totalEnemies: number;
  groups: SpawnGroup[];
  /** What makes this wave tactically interesting. */
  tacticalChallenge: string;
  /** How Ranger should approach it. */
  rangerStrategy: string;
  /** How Mage should approach it. */
  mageStrategy: string;
}

// ---------------------------------------------------------------------------
// Wave Designs
// ---------------------------------------------------------------------------

export const WAVE_DESIGNS: WaveDesign[] = [

  // =========================================================================
  // EARLY TIER (waves ~1-4) -- teach core mechanics
  // =========================================================================

  {
    name: 'The Gauntlet',
    difficulty: 'early',
    totalEnemies: 8,
    groups: [
      {
        id: 'line1',
        enemies: [{ type: 'rusher', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 400 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'line2',
        enemies: [{ type: 'rusher', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 400 },
        spread: 'line',
        timing: { kind: 'triggered', trigger: { type: 'time_elapsed', seconds: 3 } },
      },
    ],
    tacticalChallenge:
      'Two lines of rushers from opposite directions with a 3-second delay. The ' +
      'player must commit to killing the first line quickly before the second ' +
      'arrives, or reposition to avoid being sandwiched. Teaches directional ' +
      'awareness and the value of burst damage.',
    rangerStrategy:
      'Face the first line and use Power Shot to pierce through all 4 in a row. ' +
      'Evasive Roll sideways when the second line arrives, then pick them off.',
    mageStrategy:
      'Fireball the first cluster, then Teleport to one side so both lines ' +
      'converge into a single group for a Frost Nova or Lightning Chain.',
  },

  {
    name: 'Tide Pool',
    difficulty: 'early',
    totalEnemies: 14,
    groups: [
      {
        id: 'outer_ring',
        enemies: [{ type: 'swarm', count: 10 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 350 },
        spread: 'ring',
        timing: { kind: 'immediate' },
      },
      {
        id: 'inner_ambush',
        enemies: [{ type: 'flanker', count: 2 }, { type: 'rusher', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 150 },
        spread: 'scattered',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 5 },
        },
      },
    ],
    tacticalChallenge:
      'A ring of weak swarm enemies closes in from all sides. The player focuses ' +
      'outward, thinning the ring. After 5 kills, fast flankers and rushers spawn ' +
      'close -- an ambush that punishes tunnel vision. Teaches the player to stay ' +
      'mobile even while clearing trash mobs.',
    rangerStrategy:
      'Multi Shot to thin the ring in one direction, creating an escape path. ' +
      'When the ambush hits, Evasive Roll through the gap and kite.',
    mageStrategy:
      'Frost Nova when the ring gets close to slow everything, then AoE them ' +
      'down. Save Teleport for when the inner ambush spawns.',
  },

  {
    name: 'Sniper Alley',
    difficulty: 'early',
    totalEnemies: 7,
    groups: [
      {
        id: 'snipers',
        enemies: [{ type: 'sniper', count: 3 }],
        anchor: { kind: 'room_geometry', location: 'corridors' },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'escorts',
        enemies: [{ type: 'rusher', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 250 },
        spread: 'arc',
        timing: { kind: 'staggered', delaySeconds: 0.5 },
      },
    ],
    tacticalChallenge:
      'Three snipers positioned in corridors create a crossfire zone. Four ' +
      'rushers stagger in from the front to block the player from reaching ' +
      'the snipers. The player must decide: push through the rushers to ' +
      'silence the snipers, or kite the rushers while dodging sniper shots.',
    rangerStrategy:
      'Use piercing shots to hit rushers and snipers in the same line. Rain of ' +
      'Arrows on the sniper cluster if they are grouped. Dodge sniper projectiles ' +
      'with lateral movement.',
    mageStrategy:
      'Teleport past the rusher screen to get in Fireball range of the snipers. ' +
      'Arcane Wall to block a corridor and reduce incoming fire angles.',
  },

  // =========================================================================
  // MID TIER (waves ~5-9) -- introduce synergies
  // =========================================================================

  {
    name: 'Iron Curtain',
    difficulty: 'mid',
    totalEnemies: 10,
    groups: [
      {
        id: 'shield_wall',
        enemies: [{ type: 'shielder', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'backline',
        enemies: [{ type: 'sniper', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 450 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'flanking_rushers',
        enemies: [{ type: 'flanker', count: 2 }, { type: 'rusher', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI * 0.5, distance: 350 },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 5 },
        },
      },
    ],
    tacticalChallenge:
      'A wall of shielders advances with snipers firing from behind them. The ' +
      'frontal shields block direct attacks, forcing the player to flank. But ' +
      'after 5 seconds, fast enemies arrive from the side to punish players who ' +
      'committed to flanking. A puzzle of timing -- break through the wall fast, ' +
      'or deal with threats from two directions.',
    rangerStrategy:
      'Circle around the shield wall to hit shielders from behind. Save Evasive ' +
      'Roll for when the flankers arrive. Mark Target on a sniper to focus it down ' +
      'through the gaps.',
    mageStrategy:
      'Lightning Chain bounces ignore shield facing. Alternatively, Teleport behind ' +
      'the wall and Frost Nova the snipers. Arcane Wall can block the flanking ' +
      'approach to buy time.',
  },

  {
    name: 'Mitosis',
    difficulty: 'mid',
    totalEnemies: 6,
    groups: [
      {
        id: 'splitter_pack',
        enemies: [{ type: 'splitter', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'cluster',
        timing: { kind: 'immediate' },
      },
      {
        id: 'tank_guard',
        enemies: [{ type: 'tank', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 250 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
    ],
    tacticalChallenge:
      'Four splitters clustered behind two tanks. Killing splitters creates 8 ' +
      'mini-splitters, rapidly flooding the arena. The tanks body-block, making ' +
      'it hard to reach the splitters with single-target attacks. The enemy ' +
      'count effectively triples over the wave. Tests sustained DPS and AoE ' +
      'management under pressure -- kill the splitters too fast and you are ' +
      'overwhelmed by minis; kill them too slow and the tanks grind you down.',
    rangerStrategy:
      'Pierce through tanks to hit the splitters behind. Do NOT kill all ' +
      'splitters simultaneously -- stagger kills to manage mini-splitter floods. ' +
      'Rain of Arrows on the cluster.',
    mageStrategy:
      'Fireball splash damages the cluster evenly, which risks simultaneous ' +
      'splits. Better to use Lightning Chain for controlled single-target kills. ' +
      'Frost Nova slows the mini flood after splits.',
  },

  {
    name: 'Bracketing Fire',
    difficulty: 'mid',
    totalEnemies: 12,
    groups: [
      {
        id: 'north_snipers',
        enemies: [{ type: 'sniper', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: -Math.PI / 2, distance: 400 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'south_snipers',
        enemies: [{ type: 'sniper', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI / 2, distance: 400 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'swarm_wave',
        enemies: [{ type: 'swarm', count: 8 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'arc',
        timing: { kind: 'staggered', delaySeconds: 0.3 },
      },
    ],
    tacticalChallenge:
      'Snipers on two sides create a crossfire corridor. A wave of swarm enemies ' +
      'advances from the front, herding the player backward into the fire lanes. ' +
      'Standing still means getting hit by swarm; running sideways means eating ' +
      'sniper shots. The player must either eliminate snipers first (exposing ' +
      'themselves to the swarm) or push through the swarm to escape the corridor.',
    rangerStrategy:
      'Evasive Roll through the swarm toward one sniper pair. Power Shot to ' +
      'one-shot snipers (low HP). Then kite the remaining swarm.',
    mageStrategy:
      'Teleport to one sniper pair and Fireball them. Arcane Wall across the ' +
      'corridor to slow the swarm advance while dealing with the other snipers.',
  },

  {
    name: 'Shell Game',
    difficulty: 'mid',
    totalEnemies: 9,
    groups: [
      {
        id: 'shielder_ring',
        enemies: [{ type: 'shielder', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 200 },
        spread: 'ring',
        timing: { kind: 'immediate' },
      },
      {
        id: 'inner_payload',
        enemies: [{ type: 'sniper', count: 2 }, { type: 'splitter', count: 1 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 200 },
        spread: 'cluster',
        timing: { kind: 'immediate' },
      },
      {
        id: 'late_swarm',
        enemies: [{ type: 'swarm', count: 2 }],
        anchor: { kind: 'room_geometry', location: 'entrance' },
        spread: 'cluster',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_remaining', count: 3 },
        },
      },
    ],
    tacticalChallenge:
      'Four shielders form a protective ring around snipers and a splitter. The ' +
      'shields face outward, creating a mobile fortress. The player must breach ' +
      'the ring to damage the inner enemies. Killing the splitter inside causes ' +
      'mini-splitters to flood out through the gaps. When only 3 enemies remain, ' +
      'a small swarm reinforcement arrives to prevent easy cleanup.',
    rangerStrategy:
      'Circle the formation to find gaps between shielder facings. Use Multi ' +
      'Shot at an angle to slip arrows past the shields. Trap placement inside ' +
      'the ring (if you can get one through) is devastating.',
    mageStrategy:
      'Teleport inside the ring and Frost Nova everything. Lightning Chain ' +
      'bounces past shields. Meteor on the center if you can keep distance ' +
      'long enough for the cast.',
  },

  // =========================================================================
  // LATE TIER (waves ~10-14) -- complex multi-phase encounters
  // =========================================================================

  {
    name: 'Feeding Frenzy',
    difficulty: 'late',
    totalEnemies: 18,
    groups: [
      {
        id: 'initial_swarm',
        enemies: [{ type: 'swarm', count: 10 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'scattered',
        timing: { kind: 'immediate' },
      },
      {
        id: 'phase2_mixed',
        enemies: [{ type: 'flanker', count: 3 }, { type: 'rusher', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 350 },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 6 },
        },
      },
      {
        id: 'phase3_elite',
        enemies: [{ type: 'tank', count: 1 }, { type: 'shielder', count: 1 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'line',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_remaining', count: 2 },
        },
      },
    ],
    tacticalChallenge:
      'A three-phase escalation within a single wave. Phase 1 is a swarm clear ' +
      'that builds false confidence. Phase 2 punishes with fast enemies from ' +
      'behind once you have committed to a position. Phase 3 drops a tank and ' +
      'shielder as "final exam" enemies when you think the wave is almost over. ' +
      'Tests endurance and resource management across all three phases.',
    rangerStrategy:
      'Clear the swarm efficiently with Multi Shot. Save Evasive Roll for the ' +
      'phase 2 ambush. Power Shot the tank in phase 3, kite the shielder.',
    mageStrategy:
      'AoE the swarm with Fireball. Save Teleport cooldown for phase 2 ' +
      'repositioning. Frost Nova + Lightning Chain for the tank/shielder duo.',
  },

  {
    name: 'Hydra Protocol',
    difficulty: 'late',
    totalEnemies: 8,
    groups: [
      {
        id: 'splitter_line',
        enemies: [{ type: 'splitter', count: 6 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 350 },
        spread: 'arc',
        timing: { kind: 'staggered', delaySeconds: 1.5 },
      },
      {
        id: 'healer_guard',
        enemies: [{ type: 'shielder', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 300 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
    ],
    tacticalChallenge:
      'Six splitters spawn one at a time every 1.5 seconds from the front while ' +
      'two shielders pressure from behind. Killing each splitter spawns 2 minis, ' +
      'so the enemy count ramps from 8 to potentially 20. The staggered spawning ' +
      'means the player can never fully clear the front -- new splitters keep ' +
      'arriving. Meanwhile, the shielders behind punish retreating. Tests the ' +
      'ability to manage a growing threat while under pressure from two directions.',
    rangerStrategy:
      'Focus Power Shot on each splitter as it spawns, killing it before it ' +
      'reaches the pack. Rain of Arrows on the mini-splitter pile. Keep moving ' +
      'laterally to avoid the shielders.',
    mageStrategy:
      'Arcane Wall to slow the splitter advance. Fireball each one individually. ' +
      'Teleport away from the shielders when they get close. Meteor the ' +
      'mini-splitter pile.',
  },

  {
    name: 'Killbox',
    difficulty: 'late',
    totalEnemies: 14,
    groups: [
      {
        id: 'corner_snipers',
        enemies: [{ type: 'sniper', count: 4 }],
        anchor: { kind: 'room_geometry', location: 'corners' },
        spread: 'scattered',
        timing: { kind: 'immediate' },
      },
      {
        id: 'center_tanks',
        enemies: [{ type: 'tank', count: 2 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'corridor_swarm',
        enemies: [{ type: 'swarm', count: 6 }],
        anchor: { kind: 'room_geometry', location: 'corridors' },
        spread: 'cluster',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 3 },
        },
      },
      {
        id: 'final_flankers',
        enemies: [{ type: 'flanker', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 250 },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_remaining', count: 4 },
        },
      },
    ],
    tacticalChallenge:
      'The room is a kill zone. Snipers in all four corners create unavoidable ' +
      'crossfire. Tanks in the center block the shortest path between corners. ' +
      'After 3 kills, swarm reinforcements flood from the corridors to cut off ' +
      'escape routes. When 4 enemies remain, flankers arrive behind the player ' +
      'to prevent camping. Every position has a downside -- the player must ' +
      'constantly rotate and prioritize.',
    rangerStrategy:
      'Sprint to the nearest corner sniper and burst it down. Use the corner ' +
      'as cover from the other 3 snipers. Work around the room edge, clearing ' +
      'snipers one at a time. Save Evasive Roll for the flanker arrival.',
    mageStrategy:
      'Teleport to a corner, Fireball the sniper, Arcane Wall across the corridor ' +
      'to block reinforcements. Work methodically. Frost Nova for the swarm wave.',
  },

  {
    name: 'Countdown',
    difficulty: 'late',
    totalEnemies: 16,
    groups: [
      {
        id: 'wave_1',
        enemies: [{ type: 'rusher', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 400 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'wave_2',
        enemies: [{ type: 'flanker', count: 2 }, { type: 'rusher', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI * 0.66, distance: 350 },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 4 },
        },
      },
      {
        id: 'wave_3',
        enemies: [{ type: 'sniper', count: 2 }, { type: 'shielder', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI * 1.33, distance: 300 },
        spread: 'line',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 8 },
        },
      },
      {
        id: 'wave_4_finale',
        enemies: [{ type: 'tank', count: 1 }, { type: 'splitter', count: 2 }, { type: 'swarm', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 250 },
        spread: 'cluster',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 12 },
        },
      },
    ],
    tacticalChallenge:
      'A timed survival gauntlet. New groups arrive every 4 seconds regardless ' +
      'of how many enemies are alive. If the player clears fast, each wave is ' +
      'manageable. If they fall behind, the groups overlap and the difficulty ' +
      'spirals. Each wave is harder than the last: rushers, then flankers, then ' +
      'a shielder/sniper combo, then a tank/splitter finale. Pure DPS check ' +
      'with escalating mechanical complexity.',
    rangerStrategy:
      'Burn through wave 1 with Power Shot lines. Multi Shot the flanker wave. ' +
      'Mark Target the tank in wave 4. Never stop moving -- standing still ' +
      'lets the groups stack up.',
    mageStrategy:
      'Fireball wave 1 quickly. Frost Nova when wave 2 flankers arrive. Save ' +
      'Meteor for the wave 4 cluster. Teleport to reset position between waves.',
  },

  {
    name: 'Fortress',
    difficulty: 'late',
    totalEnemies: 13,
    groups: [
      {
        id: 'outer_shell',
        enemies: [{ type: 'shielder', count: 4 }, { type: 'tank', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'ring',
        timing: { kind: 'immediate' },
      },
      {
        id: 'inner_core',
        enemies: [{ type: 'sniper', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'cluster',
        timing: { kind: 'immediate' },
      },
      {
        id: 'flanking_response',
        enemies: [{ type: 'flanker', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 400 },
        spread: 'ring',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 3 },
        },
      },
    ],
    tacticalChallenge:
      'A mobile fortress: shielders and tanks form a defensive ring around 3 ' +
      'snipers. The formation advances as a unit. Attacking from the front ' +
      'is blocked by shields. Flanking is punished when 4 fast flankers spawn ' +
      'after the player commits to a side by killing 3 outer enemies. The ' +
      'fortress has to be dismantled systematically -- brute force fails.',
    rangerStrategy:
      'Pierce shots through gaps in the shield wall. Pull individual enemies ' +
      'away from the formation with hit-and-run. Trap placement forces the ' +
      'formation to route around, creating openings.',
    mageStrategy:
      'Lightning Chain bypasses the shield ring (bounces). Teleport inside the ' +
      'ring and Frost Nova to scatter the formation. Arcane Wall to split the ' +
      'ring in half and fight each side separately.',
  },

  // =========================================================================
  // BOSS TIER (waves 5, 10, 15, ...) -- boss encounters with mechanics
  // =========================================================================

  {
    name: 'The Warden',
    difficulty: 'boss',
    totalEnemies: 9,
    groups: [
      {
        id: 'warden_boss',
        enemies: [{ type: 'tank', count: 1 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'cluster',
        timing: { kind: 'immediate' },
      },
      {
        id: 'prison_guards',
        enemies: [{ type: 'shielder', count: 2 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'reinforcement_1',
        enemies: [{ type: 'rusher', count: 3 }],
        anchor: { kind: 'room_geometry', location: 'corridors' },
        spread: 'scattered',
        timing: {
          kind: 'triggered',
          trigger: { type: 'health_threshold', targetGroup: 'warden_boss', percent: 66 },
        },
      },
      {
        id: 'reinforcement_2',
        enemies: [{ type: 'sniper', count: 2 }, { type: 'flanker', count: 1 }],
        anchor: { kind: 'room_geometry', location: 'entrance' },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'health_threshold', targetGroup: 'warden_boss', percent: 33 },
        },
      },
    ],
    tacticalChallenge:
      'The "Warden" is a tank-type boss with two shielder bodyguards. At 66% ' +
      'HP, rusher reinforcements arrive from corridors. At 33% HP, snipers and ' +
      'a flanker arrive from the entrance. The boss itself is slow but hits ' +
      'hard. The real difficulty is managing the adds while keeping DPS on the ' +
      'boss -- ignoring adds leads to being overwhelmed; ignoring the boss ' +
      'means more reinforcement phases.',
    rangerStrategy:
      'Kite the boss in a wide circle. Power Shot through the shielders from ' +
      'the side. When reinforcements arrive, thin them with Multi Shot before ' +
      'resuming boss DPS. Mark Target the boss for sustained damage.',
    mageStrategy:
      'Drop Arcane Wall between the boss and its shielders to separate them. ' +
      'Fireball the isolated boss. Use Frost Nova on reinforcement waves. ' +
      'Teleport to safety if the boss gets close.',
  },

  {
    name: 'Swarm Queen',
    difficulty: 'boss',
    totalEnemies: 17,
    groups: [
      {
        id: 'queen',
        enemies: [{ type: 'splitter', count: 1 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'cluster',
        timing: { kind: 'immediate' },
      },
      {
        id: 'initial_brood',
        enemies: [{ type: 'swarm', count: 6 }],
        anchor: { kind: 'room_geometry', location: 'center' },
        spread: 'ring',
        timing: { kind: 'immediate' },
      },
      {
        id: 'brood_wave_2',
        enemies: [{ type: 'swarm', count: 4 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 350 },
        spread: 'arc',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 6 },
        },
      },
      {
        id: 'brood_wave_3',
        enemies: [{ type: 'swarm', count: 4 }, { type: 'flanker', count: 2 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 300 },
        spread: 'scattered',
        timing: {
          kind: 'triggered',
          trigger: { type: 'time_elapsed', seconds: 12 },
        },
      },
    ],
    tacticalChallenge:
      'A "queen" splitter sits at the center, constantly generating swarm waves ' +
      'on a timer. The queen must be killed to stop reinforcements, but she is ' +
      'surrounded by her brood. Each new wave gets more dangerous (adding flankers ' +
      'in wave 3). When the queen dies, she splits into minis that join the ' +
      'remaining swarm. The race is to reach and kill the queen before the swarm ' +
      'density becomes unmanageable.',
    rangerStrategy:
      'Pierce through the swarm ring to hit the queen. Rain of Arrows on the ' +
      'brood. Rush the queen down before wave 3 arrives. Use Evasive Roll to ' +
      'dodge through the brood and get close.',
    mageStrategy:
      'Teleport to the queen and burst her with Fireball. Frost Nova the ' +
      'surrounding brood to buy time. Lightning Chain cleans up the scattered ' +
      'minis after the queen splits. Meteor on the wave 3 arrival point.',
  },

  {
    name: 'Mirror Match',
    difficulty: 'boss',
    totalEnemies: 12,
    groups: [
      {
        id: 'north_army',
        enemies: [
          { type: 'tank', count: 1 },
          { type: 'shielder', count: 1 },
          { type: 'sniper', count: 1 },
          { type: 'rusher', count: 2 },
          { type: 'flanker', count: 1 },
        ],
        anchor: { kind: 'relative_to_player', angle: -Math.PI / 2, distance: 400 },
        spread: 'line',
        timing: { kind: 'immediate' },
      },
      {
        id: 'south_army',
        enemies: [
          { type: 'tank', count: 1 },
          { type: 'shielder', count: 1 },
          { type: 'sniper', count: 1 },
          { type: 'rusher', count: 2 },
          { type: 'flanker', count: 1 },
        ],
        anchor: { kind: 'relative_to_player', angle: Math.PI / 2, distance: 400 },
        spread: 'line',
        timing: { kind: 'staggered', delaySeconds: 4 },
      },
    ],
    tacticalChallenge:
      'Two identical "armies" arrive from opposite directions, each with a full ' +
      'composition (tank, shielder, sniper, rushers, flanker). The second army ' +
      'is delayed by 4 seconds. The player must defeat (or heavily damage) the ' +
      'first army before the second arrives. If both armies merge, the tank/shielder ' +
      'combo becomes nearly impenetrable and the crossfire from two snipers is lethal. ' +
      'Tests raw efficiency and target prioritization.',
    rangerStrategy:
      'Rush the first army and focus the sniper immediately. Power Shot through ' +
      'the tank and shielder. When the second army arrives, keep moving so the ' +
      'two groups never merge. Pick off stragglers with Multi Shot.',
    mageStrategy:
      'Meteor the first army formation while they are still in their line. ' +
      'Teleport away when the second army arrives. Use Arcane Wall to keep the ' +
      'two groups separated. Frost Nova whichever group gets close.',
  },

  {
    name: 'Last Stand',
    difficulty: 'boss',
    totalEnemies: 22,
    groups: [
      {
        id: 'initial_ring',
        enemies: [{ type: 'rusher', count: 6 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 350 },
        spread: 'ring',
        timing: { kind: 'immediate' },
      },
      {
        id: 'sniper_perch',
        enemies: [{ type: 'sniper', count: 4 }],
        anchor: { kind: 'room_geometry', location: 'corners' },
        spread: 'scattered',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 3 },
        },
      },
      {
        id: 'tank_push',
        enemies: [{ type: 'tank', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'line',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 8 },
        },
      },
      {
        id: 'splitter_wave',
        enemies: [{ type: 'splitter', count: 3 }],
        anchor: { kind: 'relative_to_player', angle: Math.PI, distance: 250 },
        spread: 'cluster',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_killed', count: 13 },
        },
      },
      {
        id: 'final_assault',
        enemies: [
          { type: 'shielder', count: 2 },
          { type: 'flanker', count: 2 },
          { type: 'swarm', count: 2 },
        ],
        anchor: { kind: 'relative_to_player', angle: 0, distance: 300 },
        spread: 'ring',
        timing: {
          kind: 'triggered',
          trigger: { type: 'enemies_remaining', count: 3 },
        },
      },
    ],
    tacticalChallenge:
      'The ultimate endurance test. Five phases triggered by kill count, each ' +
      'introducing a new enemy type: rushers, then snipers, then tanks, then ' +
      'splitters, and finally a mixed assault with shielders, flankers, and swarm. ' +
      'The player is always fighting the current wave while knowing the next is ' +
      'coming. Skill cooldown management is critical -- using your escape too early ' +
      'in phase 1 means you have nothing when the tanks arrive in phase 3. ' +
      'Rewards players who pace themselves and manage resources across the full wave.',
    rangerStrategy:
      'Phase 1: Multi Shot the rusher ring quickly. Phase 2: Sprint to corners ' +
      'to clear snipers. Phase 3: Kite the tanks, Power Shot through them. ' +
      'Phase 4: Rain of Arrows on the splitter cluster. Phase 5: Evasive Roll ' +
      'through the final assault, prioritize the flankers.',
    mageStrategy:
      'Phase 1: Frost Nova the ring, Fireball the cluster. Phase 2: Teleport to ' +
      'corners for snipers. Phase 3: Arcane Wall to funnel tanks, Meteor them. ' +
      'Phase 4: Lightning Chain the splitters individually. Phase 5: Full ' +
      'cooldown rotation -- Teleport, Nova, Fireball, repeat.',
  },
];
