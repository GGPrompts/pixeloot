/**
 * New Enemy Type Designs for Pixeloot
 *
 * Design goals (from GDD):
 * - "Positioning is king" -- enemies create movement puzzles
 * - Shapes AND colors distinct for colorblind accessibility
 * - Mechanical depth over number inflation
 * - Enemy combos that synergize dangerously
 *
 * Existing 7 types (do not duplicate):
 *   Rusher   - red triangle,    chase
 *   Swarm    - orange circle,   chase+jitter
 *   Tank     - green hexagon,   slow chase
 *   Sniper   - magenta diamond, ranged kite
 *   Flanker  - yellow crescent, orbit+dash
 *   Splitter - teal pentagon,   chase, splits on death
 *   Shielder - white square,    directional shield
 *
 * Color budget already used: red, orange, green, magenta, yellow, teal, white.
 * Available distinct colors: cyan, pink, purple, brown, lime, blue, gray, crimson, gold.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HpTier = 'minion' | 'normal' | 'elite';
export type DamageTier = 'low' | 'medium' | 'high';

export type MovementAI =
  | 'chase'          // beeline via flow field
  | 'orbit'          // circle player at fixed range
  | 'kite'           // maintain preferred distance
  | 'patrol'         // move between waypoints until aggro
  | 'ambush'         // stationary until player is close, then burst
  | 'flee'           // run away from player
  | 'anchor'         // stationary, does not move
  | 'mimic'          // mirrors player movement
  | 'escort'         // stays near another enemy
  | 'burrow'         // underground, surfaces periodically
  | 'swoop'          // fast diagonal passes through player position
  | 'leapfrog'       // short hops toward player with pauses
  ;

export type AttackPattern =
  | 'melee_contact'       // damage on touch
  | 'ranged_projectile'   // single aimed shot
  | 'ranged_burst'        // 3-round burst
  | 'ranged_spiral'       // rotating projectile pattern
  | 'aoe_pulse'           // periodic AoE around self
  | 'aoe_ground'          // places hazard zone on ground
  | 'summon'              // spawns other enemies
  | 'self_destruct'       // explodes on death or proximity
  | 'beam'                // continuous line damage
  | 'lob'                 // arcing projectile to player position (delayed impact)
  | 'chain_link'          // damage beam between linked pair
  | 'reflect'             // reflects player projectiles
  | 'pull'                // pulls player toward self
  | 'buff_allies'         // strengthens nearby enemies
  ;

export type StatusApplied =
  | 'none'
  | 'slow'
  | 'chill'
  | 'burn'
  | 'shock'
  | 'stun'
  | 'knockback'
  | 'mark'
  ;

export interface EnemyDesign {
  /** Unique identifier for the enemy type (used as enemyType in ECS). */
  id: string;
  /** Display name. */
  name: string;

  // -- Visual --
  /** Geometric shape for Phase 1 (geometry wars) rendering. */
  shape: string;
  /** Shape description for how to draw it in PixiJS Graphics. */
  shapeDescription: string;
  /** Primary fill color (hex). Must be distinct from all other enemies. */
  color: number;
  /** Approximate radius in pixels (half-size). */
  size: number;

  // -- Behavior --
  movementAI: MovementAI;
  attackPattern: AttackPattern;
  /** Base speed in px/sec (for reference: Rusher=80, Swarm=100, Tank=40). */
  baseSpeed: number;

  // -- Stats --
  hpTier: HpTier;
  /** Base HP before monster-level scaling (for reference: Swarm=10, Rusher=30, Tank=120). */
  baseHp: number;
  damageTier: DamageTier;
  /** Base damage before scaling (for reference: Swarm=5, Rusher=10, Tank=20). */
  baseDamage: number;

  // -- Status --
  statusApplied: StatusApplied;

  // -- AI details --
  /** Extra fields needed on the Entity (aiTimer, aiState, custom flags). */
  requiredComponents: string[];
  /** Detailed AI behavior description for implementation. */
  aiBehavior: string;

  // -- Design notes --
  /** What positioning puzzle does this enemy create for the player? */
  tacticalRole: string;
  /** Which existing or new enemies synergize dangerously with this one? */
  synergies: string[];
  /** When should this enemy first appear (wave number or zone). */
  introWave: number;
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

export const ENEMY_DESIGNS: EnemyDesign[] = [

  // =========================================================================
  // 1. BOMBER -- Suicide runner that explodes on proximity
  // =========================================================================
  {
    id: 'bomber',
    name: 'Bomber',
    shape: 'octagon',
    shapeDescription: 'Regular octagon, ~10px radius, with a pulsing inner glow that accelerates as it gets closer to the player.',
    color: 0xff6688, // pink
    size: 10,
    movementAI: 'chase',
    attackPattern: 'self_destruct',
    baseSpeed: 95,
    hpTier: 'minion',
    baseHp: 15,
    damageTier: 'high',
    baseDamage: 25,
    statusApplied: 'knockback',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Chases player via flow field. When within 40px, begins a 0.6s fuse (visual pulse ' +
      'accelerates, enemy stops moving). After fuse, explodes in 60px radius AoE dealing ' +
      'baseDamage and applying knockback. If killed before detonation, explodes at half ' +
      'damage and half radius. Explosion harms other enemies too (friendly fire).',
    tacticalRole:
      'Forces the player to prioritize and burst down before it reaches melee range. ' +
      'Creates urgency -- you cannot ignore it and focus on other threats. The friendly ' +
      'fire on explosion rewards luring it into other enemy packs.',
    synergies: [
      'Tank -- Tanks body-block the player escape route while Bombers close in',
      'Swarm -- Bombers mixed into a Swarm pack are hard to pick out before detonation',
    ],
    introWave: 4,
  },

  // =========================================================================
  // 2. LEECH -- Attaches and drains, must be shaken off
  // =========================================================================
  {
    id: 'leech',
    name: 'Leech',
    shape: 'teardrop',
    shapeDescription: 'Teardrop / rounded triangle, ~8px, with a thin tail trailing behind movement direction.',
    color: 0x9944cc, // purple
    size: 8,
    movementAI: 'chase',
    attackPattern: 'melee_contact',
    baseSpeed: 110,
    hpTier: 'minion',
    baseHp: 12,
    damageTier: 'low',
    baseDamage: 3,
    statusApplied: 'slow',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Chases via flow field at high speed. On contact, "attaches" to the player: stops ' +
      'moving independently and instead follows player position with a small offset. While ' +
      'attached, deals baseDamage per second and applies Slow. Player can shake off by ' +
      'using a movement skill (Evasive Roll / Teleport) or killing it. Detaches after 4s ' +
      'if not killed. Multiple leeches can attach simultaneously.',
    tacticalRole:
      'Punishes players who let fast enemies reach them. The Slow effect compounds -- ' +
      'each attached leech makes it harder to dodge other threats. Forces movement skill ' +
      'usage as a defensive tool, creating cooldown windows of vulnerability.',
    synergies: [
      'Sniper -- Slowed player is easier to hit with Sniper projectiles',
      'Flanker -- Leech slows you, Flanker dashes in for the kill',
    ],
    introWave: 5,
  },

  // =========================================================================
  // 3. VORTEX -- Area denial via gravitational pull
  // =========================================================================
  {
    id: 'vortex',
    name: 'Vortex',
    shape: 'spiral',
    shapeDescription: 'Archimedean spiral with 2 arms, ~18px radius, slowly rotating. Drawn as two curved lines from center outward.',
    color: 0x6644ff, // indigo / blue-purple
    size: 18,
    movementAI: 'anchor',
    attackPattern: 'pull',
    baseSpeed: 0,
    hpTier: 'normal',
    baseHp: 50,
    damageTier: 'medium',
    baseDamage: 8,
    statusApplied: 'none',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Stationary. Every 3 seconds, activates a 2-second gravitational pull in a 120px ' +
      'radius. During the pull, all entities (player AND other enemies) within range are ' +
      'dragged toward the Vortex center at 60px/sec. Deals baseDamage on contact. ' +
      'Visual: rotating spiral speeds up during active pull, inner glow intensifies. ' +
      'Between pulls, the spiral rotates slowly and is harmless.',
    tacticalRole:
      'Area denial and positioning disruption. The pull drags the player into danger ' +
      'zones or toward other enemies. Smart play: stay outside the pull radius, or use ' +
      'movement skills to escape during active pull. The fact that it pulls enemies too ' +
      'can be exploited -- cluster enemies around the Vortex for AoE payoff.',
    synergies: [
      'Bomber -- Vortex pulls player toward Bombers for devastating combo',
      'Sniper -- Player dragged into open while Snipers have clear shots',
      'Tank -- Vortex clumps Tank on top of player for unavoidable body damage',
    ],
    introWave: 7,
  },

  // =========================================================================
  // 4. MIRROR -- Reflects projectiles back at the player
  // =========================================================================
  {
    id: 'mirror',
    name: 'Mirror',
    shape: 'rhombus',
    shapeDescription: 'Tall thin rhombus (diamond stretched vertically), ~14px tall, 8px wide. Reflective sheen -- draw with a bright edge highlight on the face toward the player.',
    color: 0xccccff, // pale lavender / silver
    size: 14,
    movementAI: 'orbit',
    attackPattern: 'reflect',
    baseSpeed: 55,
    hpTier: 'normal',
    baseHp: 35,
    damageTier: 'low',
    baseDamage: 0,
    statusApplied: 'none',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Orbits the player at ~180px distance, always keeping its flat face pointed at the ' +
      'player. Reflects the first projectile that hits its front face back toward the ' +
      'player at 1.5x speed, then enters a 2-second "cracked" state where it cannot ' +
      'reflect and takes double damage. After the cracked cooldown, reflection reactivates. ' +
      'Can be hit from behind at any time without triggering reflection. ' +
      'Visual: bright edge glow when reflect is active, dim and cracked lines when on cooldown.',
    tacticalRole:
      'Punishes mindless shooting. Forces the player to either: (a) wait for the cracked ' +
      'window after a reflect, (b) reposition to hit from behind, or (c) use AoE/piercing ' +
      'attacks that bypass the reflect. Orbiting behavior means the "behind" keeps moving.',
    synergies: [
      'Shielder -- Mirror reflects frontal, Shielder blocks frontal -- together they force constant repositioning',
      'Rusher -- Mirror orbiting makes it hard to aim at Rushers behind it',
    ],
    introWave: 6,
  },

  // =========================================================================
  // 5. BURROWER -- Underground ambush predator
  // =========================================================================
  {
    id: 'burrower',
    name: 'Burrower',
    shape: 'chevron_down',
    shapeDescription: 'Downward-pointing chevron (V shape), ~12px. When burrowed, render as a small rumbling dust circle on the ground (6px, semi-transparent).',
    color: 0x886633, // brown
    size: 12,
    movementAI: 'burrow',
    attackPattern: 'melee_contact',
    baseSpeed: 70,
    hpTier: 'normal',
    baseHp: 40,
    damageTier: 'high',
    baseDamage: 18,
    statusApplied: 'stun',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Starts burrowed (invulnerable, only dust-circle visible). Moves underground toward ' +
      'the player via flow field at 70px/sec. When within 50px, surfaces with a 0.3s ' +
      'telegraph (dust circle expands, rumble visual). On surfacing, deals baseDamage in ' +
      'a 30px radius and applies 0.5s Stun. Stays surfaced for 2 seconds (vulnerable, ' +
      'chases normally) then re-burrows for 3 seconds. Cannot be damaged while burrowed.',
    tacticalRole:
      'Unpredictable threat from below. The dust trail gives attentive players warning, ' +
      'but the Stun on surfacing punishes players who stand still. Forces constant ' +
      'awareness of the ground and rewards pre-emptive repositioning. The invulnerability ' +
      'while burrowed means you cannot brute-force it -- must wait for surface windows.',
    synergies: [
      'Sniper -- Burrower stuns player, Sniper lands free shots during stun',
      'Bomber -- Burrower stuns, Bomber reaches detonation range uncontested',
    ],
    introWave: 8,
  },

  // =========================================================================
  // 6. WARPER -- Teleporting harasser
  // =========================================================================
  {
    id: 'warper',
    name: 'Warper',
    shape: 'hourglass',
    shapeDescription: 'Hourglass / bowtie shape (two triangles meeting at a point), ~12px. Brief afterimage at previous position on teleport.',
    color: 0x00cccc, // cyan-teal (darker cyan to distinguish from player)
    size: 12,
    movementAI: 'ambush',
    attackPattern: 'ranged_projectile',
    baseSpeed: 40,
    hpTier: 'minion',
    baseHp: 20,
    damageTier: 'medium',
    baseDamage: 12,
    statusApplied: 'shock',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Moves slowly when visible. Every 2.5 seconds, teleports to a random floor tile ' +
      'within 200px of the player (but at least 80px away). Immediately fires a single ' +
      'projectile at the player upon arrival, applying Shock on hit. After firing, is ' +
      'stationary for 0.8 seconds (vulnerable window) before resuming slow movement. ' +
      'Teleport has a 0.3s wind-up with visual shimmer at the destination.',
    tacticalRole:
      'Disrupts player focus -- hard to track and predict position. The Shock debuff ' +
      'makes the next hit from ANY enemy deal +25% damage, so Warpers are force ' +
      'multipliers for other threats. The 0.8s post-fire window rewards reactive aim.',
    synergies: [
      'Rusher -- Warper applies Shock, Rusher contact hit deals +25% bonus',
      'Flanker -- Shock + Flanker dash = burst damage spike',
    ],
    introWave: 6,
  },

  // =========================================================================
  // 7. HEALER -- Support enemy that restores allies
  // =========================================================================
  {
    id: 'healer',
    name: 'Healer',
    shape: 'cross',
    shapeDescription: 'Plus/cross shape, ~14px. Drawn as two overlapping rectangles (6px wide, 14px long). Pulsing green glow when healing.',
    color: 0x66ff66, // lime green (distinct from Tank dark green 0x44ff44)
    size: 14,
    movementAI: 'flee',
    attackPattern: 'buff_allies',
    baseSpeed: 65,
    hpTier: 'normal',
    baseHp: 30,
    damageTier: 'low',
    baseDamage: 5,
    statusApplied: 'none',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Flees from the player, trying to maintain at least 150px distance using inverse ' +
      'flow field direction. Every 2 seconds, emits a healing pulse in 100px radius that ' +
      'restores 10% max HP to all nearby enemies (not self). Visual: green ring expands ' +
      'outward from Healer on pulse. Prioritizes staying near the largest cluster of allies. ' +
      'If no allies within 200px, switches to slow chase (lonely = desperate).',
    tacticalRole:
      'Priority target. The Healer forces the player to push through other enemies to ' +
      'reach it in the back line. Creates a "kill order" puzzle -- do you ignore the ' +
      'frontline to snipe the Healer, or do you clear the front first and risk heals? ' +
      'Piercing and AoE skills shine for reaching Healers behind Tank walls.',
    synergies: [
      'Tank -- Tank body-blocks while Healer undoes player damage from behind',
      'Shielder -- Shielder + Healer creates a nearly impenetrable duo from the front',
    ],
    introWave: 7,
  },

  // =========================================================================
  // 8. TRAPPER -- Places hazard zones on the ground
  // =========================================================================
  {
    id: 'trapper',
    name: 'Trapper',
    shape: 'trapezoid',
    shapeDescription: 'Isosceles trapezoid, wider at bottom (~16px base, ~10px top, 12px tall). Trap zones render as pulsing red circles on the ground.',
    color: 0xcc4400, // dark orange-red / burnt orange
    size: 12,
    movementAI: 'kite',
    attackPattern: 'aoe_ground',
    baseSpeed: 55,
    hpTier: 'normal',
    baseHp: 35,
    damageTier: 'medium',
    baseDamage: 10,
    statusApplied: 'slow',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Maintains 120-200px distance from player (kites like Sniper). Every 3 seconds, ' +
      'places a trap zone at the player\'s current position (40px radius). Trap zones ' +
      'become active after 0.5s delay (visual: faint circle becomes bright). Active traps ' +
      'deal baseDamage and apply Slow when stepped on, then disappear. Traps last 8 seconds ' +
      'if not triggered. Maximum 3 traps active per Trapper. Traps are visible but easy ' +
      'to miss during combat.',
    tacticalRole:
      'Area denial that constrains player movement over time. The Trapper slowly fills ' +
      'the arena with danger zones, punishing players who stay in one area too long. ' +
      'Forces the player to keep moving and be aware of the ground. The Slow on trigger ' +
      'chains into other threats.',
    synergies: [
      'Vortex -- Vortex pulls player onto trap zones',
      'Rusher -- Traps slow the player, Rushers close the gap',
      'Healer -- Trapper kites and zones while Healer sustains the frontline',
    ],
    introWave: 6,
  },

  // =========================================================================
  // 9. CHARGER -- Telegraphed bull-rush with stun
  // =========================================================================
  {
    id: 'charger',
    name: 'Charger',
    shape: 'arrow',
    shapeDescription: 'Large thick arrow/chevron pointing forward, ~16px long, 12px wide. Drawn as a filled arrowhead. Glows brighter during charge wind-up.',
    color: 0xdd2222, // deep crimson (distinct from Rusher bright red 0xff3333)
    size: 16,
    movementAI: 'leapfrog',
    attackPattern: 'melee_contact',
    baseSpeed: 50,
    hpTier: 'elite',
    baseHp: 80,
    damageTier: 'high',
    baseDamage: 22,
    statusApplied: 'stun',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Walks slowly toward player via flow field. Every 4 seconds, stops and begins a ' +
      '1-second charge wind-up (visual: body glows, shakes, red telegraph line appears ' +
      'showing charge direction locked to player position at wind-up START). Then dashes ' +
      'in that locked direction at 400px/sec for 0.5 seconds. Deals baseDamage + Stun if ' +
      'it hits the player. If it hits a wall, it is stunned itself for 1 second (punish ' +
      'window). Cannot change direction mid-charge.',
    tacticalRole:
      'Classic sidestep puzzle. The telegraph gives clear warning, and the locked direction ' +
      'means a perpendicular dodge always works. But in cramped corridors or when other ' +
      'enemies restrict movement, the dodge becomes much harder. The self-stun on wall ' +
      'collision rewards players who bait charges into walls.',
    synergies: [
      'Trapper -- Traps restrict dodge options during Charger wind-up',
      'Vortex -- Pull disrupts the player dodge timing',
      'Shielder -- Blocks the escape route perpendicular to the charge',
    ],
    introWave: 5,
  },

  // =========================================================================
  // 10. LINKER -- Pair-bonded enemies with a damage beam between them
  // =========================================================================
  {
    id: 'linker',
    name: 'Linker',
    shape: 'semicircle',
    shapeDescription: 'Semicircle, ~10px radius, flat edge faces away from its linked partner. A visible beam/line connects the pair.',
    color: 0xffaa00, // gold / amber
    size: 10,
    movementAI: 'escort',
    attackPattern: 'chain_link',
    baseSpeed: 70,
    hpTier: 'normal',
    baseHp: 25,
    damageTier: 'medium',
    baseDamage: 12,
    statusApplied: 'shock',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Always spawns in pairs. The two Linkers maintain a beam between them (visual: ' +
      'pulsing electric line connecting both). The beam deals baseDamage per second to ' +
      'the player if they cross through it, and applies Shock. Linkers try to position ' +
      'on opposite sides of the player to force beam intersection with player movement. ' +
      'Each Linker orbits at ~120px from player, but on opposite sides. If one Linker ' +
      'dies, the other enters "enraged" state: double speed, direct chase, melee contact.',
    tacticalRole:
      'Creates a dynamic laser-tripwire that the player must constantly track. The pair ' +
      'tries to sandwich the player, making the beam unavoidable in narrow corridors. ' +
      'Killing one quickly is important to break the beam, but the enraged survivor ' +
      'becomes an immediate melee threat. Piercing shots that hit both are efficient.',
    synergies: [
      'Tank -- Tank body-blocks between Linker pair, complicating beam avoidance',
      'Flanker -- Flanker dash forces player through the Linker beam',
    ],
    introWave: 8,
  },

  // =========================================================================
  // 11. SPAWNER -- Stationary nest that produces Swarm enemies
  // =========================================================================
  {
    id: 'spawner',
    name: 'Spawner',
    shape: 'hive',
    shapeDescription: 'Irregular hexagonal cluster (3 overlapping hexagons, slightly offset), ~20px. Pulses each time it spawns a new Swarm.',
    color: 0xff8844, // warm orange (slightly distinct from Swarm pure orange)',
    size: 20,
    movementAI: 'anchor',
    attackPattern: 'summon',
    baseSpeed: 0,
    hpTier: 'elite',
    baseHp: 100,
    damageTier: 'low',
    baseDamage: 5,
    statusApplied: 'none',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Stationary. Every 4 seconds, spawns a single Swarm enemy at its position (maximum ' +
      '6 active children at once -- stops spawning until some die). If the player is within ' +
      '50px (melee range), deals baseDamage on contact. Visual: body contracts/expands on ' +
      'each spawn. Spawned Swarm enemies have a slight orange tether line back to the ' +
      'Spawner for 1 second after spawning (visual only).',
    tacticalRole:
      'Infinite enemy pressure if left alive. Forces the player to push to the Spawner ' +
      'and destroy it rather than kiting forever. Creates a strategic choice: deal with ' +
      'the stream of Swarm now, or push through them to kill the source? The cap of 6 ' +
      'children prevents overwhelming snowball.',
    synergies: [
      'Tank -- Tanks protect the Spawner while it generates endless reinforcements',
      'Healer -- Healer keeps the Spawner alive, compounding the pressure',
    ],
    introWave: 9,
  },

  // =========================================================================
  // 12. PHASER -- Blinks in and out of existence
  // =========================================================================
  {
    id: 'phaser',
    name: 'Phaser',
    shape: 'diamond_hollow',
    shapeDescription: 'Diamond outline (not filled) with a glowing center dot, ~12px. When phased out, the outline becomes dashed/transparent.',
    color: 0x88aaff, // light blue
    size: 12,
    movementAI: 'chase',
    attackPattern: 'melee_contact',
    baseSpeed: 85,
    hpTier: 'normal',
    baseHp: 28,
    damageTier: 'medium',
    baseDamage: 14,
    statusApplied: 'none',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Alternates between "solid" (1.5s) and "phased" (1.5s) states on a fixed timer. ' +
      'While solid: visible, takes damage, deals contact damage, chases via flow field. ' +
      'While phased: semi-transparent, invulnerable, cannot deal damage, still moves ' +
      'toward player. All Phasers in a wave share the same phase timer (they blink in ' +
      'sync). Visual: smooth fade between states over 0.2s.',
    tacticalRole:
      'Rhythm-based threat. The player must time their attacks to the solid windows and ' +
      'reposition during phased windows. Shared sync means a group of Phasers all become ' +
      'vulnerable at once -- rewarding burst AoE during the solid phase. Forces the player ' +
      'to manage attack cadence rather than just holding fire.',
    synergies: [
      'Rusher -- Rushers keep pressure constant while Phasers blink out, preventing downtime',
      'Warper -- Hard to track Warper teleports + Phaser blinks = chaotic threat assessment',
    ],
    introWave: 7,
  },

  // =========================================================================
  // 13. LOBBER -- Indirect fire artillery enemy
  // =========================================================================
  {
    id: 'lobber',
    name: 'Lobber',
    shape: 'dome',
    shapeDescription: 'Half-circle dome (flat on bottom), ~14px radius. Projectile is a small circle with an arcing shadow trail.',
    color: 0x44aaaa, // dark teal-cyan (distinct from lighter cyan and teal)',
    size: 14,
    movementAI: 'kite',
    attackPattern: 'lob',
    baseSpeed: 40,
    hpTier: 'normal',
    baseHp: 30,
    damageTier: 'medium',
    baseDamage: 15,
    statusApplied: 'burn',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Maintains 200-300px distance from player (longer range than Sniper). Every 3 seconds, ' +
      'lobs a projectile that arcs toward the player\'s position at time of fire. The ' +
      'projectile takes 1 second to land, leaving a growing shadow circle at the target ' +
      'location as telegraph. On impact, deals baseDamage in a 50px radius and applies ' +
      'Burn. The arc means line-of-sight blockers (walls) do not prevent the attack -- ' +
      'it fires over obstacles.',
    tacticalRole:
      'Indirect fire that cannot be blocked by walls or positioning. Forces the player ' +
      'to keep moving to avoid the telegraphed impact zones. The Burn DoT is extra ' +
      'punishment for getting hit. Long range means the player must actively chase the ' +
      'Lobber to kill it. Creates "dodge the circles" minigame overlaid on other combat.',
    synergies: [
      'Trapper -- Traps restrict dodge space, Lobber impacts cover remaining safe zones',
      'Vortex -- Pull disrupts Lobber impact dodging',
      'Tank -- Tank slows player approach to the backline Lobber',
    ],
    introWave: 8,
  },

  // =========================================================================
  // 14. SWOOPER -- Fast diagonal strafe runs
  // =========================================================================
  {
    id: 'swooper',
    name: 'Swooper',
    shape: 'wing',
    shapeDescription: 'Swept-back wing/delta shape (like a bird silhouette), ~14px wide, 8px tall. Points in movement direction. Trail particles behind during swoop.',
    color: 0xdddd44, // dull gold-yellow (distinct from bright yellow Flanker 0xffff00)',
    size: 14,
    movementAI: 'swoop',
    attackPattern: 'melee_contact',
    baseSpeed: 60,
    hpTier: 'minion',
    baseHp: 18,
    damageTier: 'medium',
    baseDamage: 14,
    statusApplied: 'none',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Hovers at 200-250px from player, slowly drifting laterally. Every 2.5 seconds, ' +
      'swoops in a fast diagonal pass through the player\'s position at 300px/sec, ' +
      'continuing 100px past the player before decelerating. Deals contact damage during ' +
      'the swoop. After the pass, drifts back out to hover range over 1.5 seconds. ' +
      'Always approaches from alternating sides (left pass, then right pass). ' +
      'Visual: leaves a fading trail during swoop.',
    tacticalRole:
      'Tests reaction timing. The diagonal approach is harder to dodge than a straight ' +
      'charge because the perpendicular escape is shorter. Alternating sides means the ' +
      'player cannot just dodge in one direction repeatedly. Low HP makes them glass ' +
      'cannons -- rewarding players who can snap-aim during the brief hover phase.',
    synergies: [
      'Linker -- Swooper passes force player movement through Linker beams',
      'Charger -- Swooper from one side, Charger from the other = pincer dodge puzzle',
    ],
    introWave: 5,
  },

  // =========================================================================
  // 15. NECROMANCER -- Revives dead enemies
  // =========================================================================
  {
    id: 'necromancer',
    name: 'Necromancer',
    shape: 'inverted_triangle',
    shapeDescription: 'Inverted triangle (point down), ~14px, with a small skull-like dot pattern inside (two dots for eyes, one for mouth). Raise visual: dark purple beam to corpse.',
    color: 0x8844aa, // dark magenta-purple (distinct from Sniper magenta 0xff44ff)',
    size: 14,
    movementAI: 'flee',
    attackPattern: 'summon',
    baseSpeed: 50,
    hpTier: 'elite',
    baseHp: 45,
    damageTier: 'low',
    baseDamage: 6,
    statusApplied: 'none',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Flees from the player at 50px/sec. Every 5 seconds, targets the nearest position ' +
      'where an enemy recently died (within 300px) and "raises" a Rusher at that location ' +
      'with 50% of normal HP. Maximum 3 active raised enemies. Raised enemies have a ' +
      'purple tint to distinguish from normal spawns. If no corpse positions available, ' +
      'does nothing. 2-second channel time to raise (interruptible by Stun or killing ' +
      'the Necromancer).',
    tacticalRole:
      'The ultimate priority target. If ignored, all the player\'s killing work gets ' +
      'partially undone. The flee behavior means the player must actively chase it through ' +
      'other enemies. The channel time creates a window to interrupt with stun effects. ' +
      'Creates tension between "kill new enemies" and "stop the reviver first."',
    synergies: [
      'Tank -- Dead Tanks leave corpses; revived Tanks at 50% HP are still beefy',
      'Healer -- Healer sustains Necromancer while it raises corpses; nightmare backline duo',
      'Shielder -- Shielders protect the fleeing Necromancer from frontal pursuit',
    ],
    introWave: 10,
  },

  // =========================================================================
  // 16. PULSAR -- Periodic AoE nova around itself
  // =========================================================================
  {
    id: 'pulsar',
    name: 'Pulsar',
    shape: 'starburst',
    shapeDescription: '6-pointed starburst (alternating long/short radii), ~16px outer radius. Expands briefly on each pulse. Concentric rings radiate outward during pulse.',
    color: 0xffff88, // pale yellow (distinct from solid yellow Flanker)',
    size: 16,
    movementAI: 'chase',
    attackPattern: 'aoe_pulse',
    baseSpeed: 55,
    hpTier: 'elite',
    baseHp: 70,
    damageTier: 'medium',
    baseDamage: 12,
    statusApplied: 'shock',
    requiredComponents: ['aiTimer'],
    aiBehavior:
      'Chases player via flow field at moderate speed. Every 3 seconds, emits an AoE ' +
      'pulse in an 80px radius dealing baseDamage and applying Shock to the player if ' +
      'in range. 0.5-second wind-up with visual expanding glow before the pulse fires. ' +
      'The pulse does NOT damage other enemies. Between pulses, purely a melee-contact ' +
      'chaser (baseDamage / 2 on touch).',
    tacticalRole:
      'Forces the player to maintain distance -- cannot safely melee or stand near it. ' +
      'The Shock application means getting hit by a pulse amplifies the NEXT hit from ' +
      'any source by 25%. The chase speed is moderate, so kiting works, but the player ' +
      'must balance kiting the Pulsar with dealing with other threats.',
    synergies: [
      'Rusher -- Pulsar Shock + immediate Rusher contact = amplified burst',
      'Charger -- Pulsar Shock + Charger charge = devastating combo',
      'Swarm -- Pulsar mixed into Swarm pack makes the whole group deadly to approach',
    ],
    introWave: 8,
  },

  // =========================================================================
  // 17. MIMIC -- Copies player movement inversely
  // =========================================================================
  {
    id: 'mimic',
    name: 'Mimic',
    shape: 'player_echo',
    shapeDescription: 'Ghostly copy of the player shape (chevron for Ranger, circle for Mage) but rendered as a dark outline with red fill. Slightly smaller than the player.',
    color: 0xcc3333, // dark red (distinct from bright Rusher red)',
    size: 12,
    movementAI: 'mimic',
    attackPattern: 'ranged_projectile',
    baseSpeed: 0,
    hpTier: 'normal',
    baseHp: 35,
    damageTier: 'medium',
    baseDamage: 10,
    statusApplied: 'none',
    requiredComponents: ['aiTimer', 'aiState'],
    aiBehavior:
      'Spawns at a position mirrored from the player relative to the room center. Mirrors ' +
      'the player\'s movement: when the player moves left, the Mimic moves right (and vice ' +
      'versa for all axes). Every 2 seconds, fires a projectile at the player\'s position. ' +
      'If the player stops, the Mimic stops. Speed matches player speed exactly. If the ' +
      'mirroring would put the Mimic into a wall, it slides along the wall instead.',
    tacticalRole:
      'A mind-bending positioning puzzle. The player\'s own movement controls where the ' +
      'Mimic goes, so approach requires thinking in reverse. Moving toward the Mimic ' +
      'makes it move toward you too (converge). Moving away makes it mirror away. The ' +
      'player must plan their movement around the inversion to get a good attack angle ' +
      'while dodging its projectiles.',
    synergies: [
      'Sniper -- Player tries to dodge Sniper shots but Mimic mirrors into unfavorable position',
      'Trapper -- Player movement to avoid traps has mirrored consequences for Mimic position',
    ],
    introWave: 9,
  },

  // =========================================================================
  // 18. OVERCHARGER -- Slow tank that empowers nearby enemies on death
  // =========================================================================
  {
    id: 'overcharger',
    name: 'Overcharger',
    shape: 'double_hexagon',
    shapeDescription: 'Concentric hexagon (outer ~18px, inner ~10px, gap filled with crackling energy lines). Inner hex rotates slowly opposite to outer.',
    color: 0x44ccff, // electric blue (distinct from indigo Vortex and pale blue Phaser)',
    size: 18,
    movementAI: 'chase',
    attackPattern: 'melee_contact',
    baseSpeed: 35,
    hpTier: 'elite',
    baseHp: 90,
    damageTier: 'medium',
    baseDamage: 15,
    statusApplied: 'shock',
    requiredComponents: [],
    aiBehavior:
      'Slow chase via flow field (even slower than Tank). Applies Shock on melee contact. ' +
      'The main threat is its death effect: when killed, all enemies within 150px radius ' +
      'gain +30% speed and +30% damage for 8 seconds (visual: electric blue aura on ' +
      'buffed enemies). The buff does not stack from multiple Overcharger deaths. This ' +
      'creates a "kill order" dilemma.',
    tacticalRole:
      'Kill order puzzle. The Overcharger is slow and not immediately dangerous, but killing ' +
      'it at the wrong time (near a pack of enemies) buffs everything around it. Forces ' +
      'the player to either: (a) kill it first before other enemies arrive, (b) lure it ' +
      'away from the pack before killing, or (c) kill everything else first and then ' +
      'safely finish the Overcharger. Each approach requires different positioning.',
    synergies: [
      'Rusher -- Overcharged Rushers at +30% speed are extremely fast and dangerous',
      'Flanker -- Already fast Flankers become nearly impossible to outrun when buffed',
      'Swarm -- A whole Swarm pack getting +30% damage creates a lethal swarm',
    ],
    introWave: 9,
  },
];

// ---------------------------------------------------------------------------
// Dangerous Enemy Combos (wave design reference)
// ---------------------------------------------------------------------------

/**
 * These combos are designed to create specific positioning puzzles when
 * spawned together. Wave designers should use these as building blocks.
 */
export const ENEMY_COMBOS = [
  {
    name: 'The Squeeze',
    enemies: ['charger', 'trapper'],
    description:
      'Trapper fills the ground with slow zones while Charger telegraphs bull-rushes. ' +
      'The player has increasingly limited dodge space for the charge.',
  },
  {
    name: 'The Gauntlet',
    enemies: ['linker', 'linker', 'rusher'],
    description:
      'Two Linker pairs create crossing beams while Rushers force the player to move ' +
      'through them. Must break a Linker pair to create a safe corridor.',
  },
  {
    name: 'The Immortal Line',
    enemies: ['tank', 'healer', 'necromancer'],
    description:
      'Tanks wall the front. Healer sustains them. Necromancer revives any that fall. ' +
      'Player must find a way through or around to reach the backline support.',
  },
  {
    name: 'The Blender',
    enemies: ['vortex', 'bomber', 'swarm'],
    description:
      'Vortex pulls player and Swarm together. Bombers mixed into the Swarm detonate ' +
      'in the cluster. Friendly fire from Bombers can help clear Swarm but damages player.',
  },
  {
    name: 'The Ambush',
    enemies: ['burrower', 'burrower', 'sniper'],
    description:
      'Snipers keep the player moving to dodge shots. Burrowers surface where the player ' +
      'runs to, creating unpredictable stun traps during evasive movement.',
  },
  {
    name: 'The Ghost Wall',
    enemies: ['phaser', 'phaser', 'phaser', 'mirror'],
    description:
      'Phasers blink in and out in sync while Mirror reflects shots. Player must time ' +
      'attacks to the solid window AND aim around the Mirror. High mechanical execution.',
  },
  {
    name: 'The Killswitch',
    enemies: ['overcharger', 'rusher', 'flanker', 'swarm'],
    description:
      'Overcharger is surrounded by fast enemies. Killing it buffs them all. Player must ' +
      'isolate the Overcharger by clearing its escort first, or accept the buff and ' +
      'survive the empowered rush.',
  },
  {
    name: 'The Mirror Match',
    enemies: ['mimic', 'warper'],
    description:
      'Mimic mirrors player movement, Warper teleports unpredictably. Player loses spatial ' +
      'control -- one enemy follows their inputs inversely, the other ignores positioning entirely.',
  },
  {
    name: 'Death From Above',
    enemies: ['lobber', 'lobber', 'trapper'],
    description:
      'Lobbers rain arcing fire from behind walls while Trapper zones the ground. ' +
      'Player must dodge both ground traps and incoming artillery simultaneously.',
  },
  {
    name: 'The Feedback Loop',
    enemies: ['spawner', 'overcharger'],
    description:
      'Spawner produces endless Swarm. Killing the Overcharger near the Spawner buffs ' +
      'all spawned Swarm. Must kill Spawner first or lure Overcharger far away.',
  },
];
