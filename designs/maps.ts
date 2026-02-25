/**
 * Map Layout Variant Designs for Pixeloot
 *
 * Each variant describes how to post-process a rot-js Digger BSP output
 * into a distinct dungeon layout with unique tactical properties.
 *
 * Current system reference:
 * - DungeonGenerator.ts uses rot-js Digger with roomWidth [6,16], roomHeight [6,12],
 *   corridorLength [3,8], then widens all corridors to 3 tiles.
 * - TileMap.ts renders tiles at 32x32px. Tile values: 0=floor, 1=wall.
 * - Pathfinding.ts uses BFS flow field (4-directional) rebuilt when player changes tile.
 * - Map sizes scale by tier: T1 ~85x50, T2 ~110x65, T3 ~135x80, T4 ~160x95, T5 ~185x110.
 */

// ---------------------------------------------------------------------------
// Tile Types
// ---------------------------------------------------------------------------

/**
 * Extended tile values beyond the current 0/1 system.
 * The base Digger output uses 0 (floor) and 1 (wall).
 * Post-processing can stamp additional tile types for environmental features.
 * These would need TileMap + Pathfinding support when implemented.
 */
export const enum TileType {
  Floor = 0,
  Wall = 1,
  /** Blocks movement but not projectiles. Rendered as a short obstacle. */
  Pillar = 2,
  /** Blocks nothing. Cosmetic floor variation for visual variety. */
  CrackedFloor = 3,
  /** Kills entities that walk over it. Rendered as a dark void. */
  Pit = 4,
  /** Floor tile that slows movement by 30%. Visual: darker tint. */
  SlowGround = 5,
  /** Destructible wall: takes 3 hits to break, then becomes floor. */
  Destructible = 6,
  /** Bridge over a pit: walkable, but narrow (1-2 tiles wide). */
  Bridge = 7,
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Describes a room shape pattern used by the Digger or post-processing. */
export interface RoomPattern {
  /** Human-readable label for this room type. */
  name: string;
  /** Width range in tiles [min, max]. */
  widthRange: [number, number];
  /** Height range in tiles [min, max]. */
  heightRange: [number, number];
  /** Shape of the room after post-processing carves it. */
  shape: 'rectangle' | 'circular' | 'cross' | 'L-shaped' | 'diamond' | 'irregular';
  /** How common this room type is within the layout (0-1 weight). */
  weight: number;
}

/** An environmental feature stamped into rooms or corridors. */
export interface EnvironmentalFeature {
  name: string;
  /** Which tile type this feature uses. */
  tileType: TileType;
  /** Where this feature appears. */
  placement: 'room-center' | 'room-edge' | 'corridor' | 'room-corner' | 'random';
  /** Typical count per room (or per corridor segment). */
  countPerRoom: [number, number];
  /** How the feature affects combat tactically. */
  tacticalNote: string;
}

/** A special room that appears at most once (or a fixed number of times) per map. */
export interface SpecialRoom {
  name: string;
  /** Minimum dimensions in tiles. */
  minWidth: number;
  minHeight: number;
  /** How to select which Digger room becomes this special room. */
  selectionRule: 'largest' | 'smallest' | 'farthest-from-spawn' | 'second-room' | 'random';
  /** Post-processing applied to this room specifically. */
  modifications: string;
  /** Gameplay purpose. */
  purpose: string;
}

/** Rules for how to transform the raw Digger BSP output. */
export interface PostProcessingRules {
  /** Override Digger config from the default. Null fields keep defaults. */
  diggerOverrides: {
    roomWidth?: [number, number];
    roomHeight?: [number, number];
    corridorLength?: [number, number];
  };
  /** Corridor width after widening (default is 3). */
  corridorWidth: number;
  /** Steps applied after Digger + corridor widening, in order. */
  steps: string[];
}

/** Notes on how the layout scales across map tiers. */
export interface TierScaling {
  /** T1 (~85x50) notes. */
  t1: string;
  /** T3 (~135x80) notes. */
  t3: string;
  /** T5 (~185x110) notes. */
  t5: string;
}

/** A complete map layout variant. */
export interface MapDesign {
  /** Unique identifier for this layout. */
  id: string;
  /** Display name shown in the map item tooltip. */
  name: string;
  /** One-line thematic concept. */
  concept: string;
  /** Longer description of the layout feel. */
  description: string;
  /** Room shape patterns used in this layout. */
  roomPatterns: RoomPattern[];
  /** Environmental features scattered through the map. */
  environmentalFeatures: EnvironmentalFeature[];
  /** How this layout changes combat flow for different playstyles. */
  combatFlow: {
    /** How Rangers (kiting, pierce lines) interact with this layout. */
    ranger: string;
    /** How Mages (AoE funneling, zone control) interact with this layout. */
    mage: string;
    /** General tactical decisions the layout forces. */
    decisions: string[];
  };
  /** Rules for transforming the Digger output. */
  postProcessing: PostProcessingRules;
  /** Special rooms that appear in this layout. */
  specialRooms: SpecialRoom[];
  /** How the layout scales from T1 to T5. */
  tierScaling: TierScaling;
}

// ---------------------------------------------------------------------------
// Map Designs
// ---------------------------------------------------------------------------

export const MAP_DESIGNS: MapDesign[] = [

  // =========================================================================
  // 1. STANDARD DUNGEON
  // =========================================================================
  {
    id: 'standard_dungeon',
    name: 'The Dungeon',
    concept: 'Classic rooms-and-corridors with balanced combat spaces.',
    description:
      'The baseline layout. Medium-sized rectangular rooms connected by 3-wide corridors. ' +
      'No extreme chokepoints, no massive arenas. Good variety of engagement distances. ' +
      'This is the layout new players learn the game on, and it remains viable at all tiers.',
    roomPatterns: [
      { name: 'Small Chamber', widthRange: [6, 9], heightRange: [6, 8], shape: 'rectangle', weight: 0.4 },
      { name: 'Hall', widthRange: [10, 16], heightRange: [6, 8], shape: 'rectangle', weight: 0.35 },
      { name: 'Large Room', widthRange: [10, 16], heightRange: [9, 12], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      {
        name: 'Stone Pillar',
        tileType: TileType.Pillar,
        placement: 'room-center',
        countPerRoom: [0, 2],
        tacticalNote: 'Blocks enemy movement but not projectiles. Kite around pillars to break melee chase lines.',
      },
    ],
    combatFlow: {
      ranger: 'Corridors create natural pierce lines. Rooms give space to kite. Pillars break line of sight for repositioning.',
      mage: 'Corridor mouths are ideal Arcane Wall placements. Room centers work for Frost Nova when surrounded.',
      decisions: [
        'Fight in the room (more space, enemies from multiple doors) or hold a corridor (funneled enemies, less escape)?',
        'Use pillars to split enemy packs or let them group for AoE payoff?',
      ],
    },
    postProcessing: {
      diggerOverrides: {},
      corridorWidth: 3,
      steps: [
        'Use default Digger output with standard corridor widening.',
        'In rooms larger than 10x8, place 1-2 pillar tiles (TileType.Pillar) at grid-aligned positions avoiding the center 3x3.',
      ],
    },
    specialRooms: [
      {
        name: 'Boss Chamber',
        minWidth: 14,
        minHeight: 10,
        selectionRule: 'farthest-from-spawn',
        modifications: 'Clear all pillars. Ensure at least 2 corridor exits. Place 4 pillars in a diamond pattern at 1/3 room offsets.',
        purpose: 'Open arena for the boss fight with pillars for cover during projectile phases.',
      },
    ],
    tierScaling: {
      t1: 'Compact: 4-6 rooms, short corridors. Fast clear, good for learning.',
      t3: 'Medium: 8-12 rooms, some corridors branch. Multiple paths to the boss.',
      t5: 'Sprawling: 14-18 rooms, long corridors. Navigation matters, backtracking is costly.',
    },
  },

  // =========================================================================
  // 2. ARENA GAUNTLET
  // =========================================================================
  {
    id: 'arena_gauntlet',
    name: 'The Gauntlet',
    concept: 'A chain of large open arenas connected by short, tight corridors.',
    description:
      'Each room is a wide-open arena designed for wave combat. Corridors between arenas are ' +
      'deliberately short and narrow -- just transition tunnels, not fighting spaces. ' +
      'Combat happens almost entirely in the arenas, making positioning within each room the core challenge. ' +
      'Rewards players who clear rooms efficiently before moving on.',
    roomPatterns: [
      { name: 'Arena', widthRange: [14, 16], heightRange: [10, 12], shape: 'rectangle', weight: 0.7 },
      { name: 'Small Connector', widthRange: [6, 8], heightRange: [6, 7], shape: 'rectangle', weight: 0.3 },
    ],
    environmentalFeatures: [
      {
        name: 'Floor Pit',
        tileType: TileType.Pit,
        placement: 'room-center',
        countPerRoom: [0, 1],
        tacticalNote: 'Lethal pit in the center of some arenas. Forces combat around the edges. Enemies can be knocked into it.',
      },
      {
        name: 'Low Wall',
        tileType: TileType.Destructible,
        placement: 'room-edge',
        countPerRoom: [0, 3],
        tacticalNote: 'Breakable barricades along arena edges. Provides temporary cover but crumbles under sustained fire.',
      },
    ],
    combatFlow: {
      ranger: 'Wide arenas give excellent kiting space. Pits create natural enemy splitting -- fire through enemies that path around the pit.',
      mage: 'No corridors to funnel, so Arcane Wall placement in open space is critical. Pits naturally cluster enemies into AoE-friendly groups.',
      decisions: [
        'Circle the pit to keep enemies funneled on one side, or cut across and risk getting trapped?',
        'Destroy barricades for open sightlines or preserve them as escape obstacles?',
        'Rush through connector corridors or clear from the doorway?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [12, 16],
        roomHeight: [9, 12],
        corridorLength: [2, 4],
      },
      corridorWidth: 2,
      steps: [
        'Generate with large room bias and short corridors.',
        'Narrow corridors to 2 tiles wide (tight transition feel).',
        'In arenas (rooms >= 12 wide), 30% chance to stamp a 3x3 pit in the center.',
        'In arenas, stamp 1-3 destructible wall segments (2-3 tiles long) along north or south edges.',
      ],
    },
    specialRooms: [
      {
        name: 'Grand Arena',
        minWidth: 16,
        minHeight: 12,
        selectionRule: 'largest',
        modifications: 'Expand by 2 tiles in each direction if space allows. Place 4 pillar-and-pit obstacles in a symmetric pattern.',
        purpose: 'The final arena. Maximum space for a multi-phase boss with area denial mechanics.',
      },
      {
        name: 'Treasure Alcove',
        minWidth: 6,
        minHeight: 6,
        selectionRule: 'smallest',
        modifications: 'Seal one exit with a destructible wall. Place guaranteed loot drop point in center.',
        purpose: 'Hidden reward room. Player must break through a destructible wall to access it.',
      },
    ],
    tierScaling: {
      t1: '3-4 arenas in a line. Simple left-to-right progression.',
      t3: '6-8 arenas with branching paths. Some arenas connect to 3 corridors.',
      t5: '10-14 arenas. Some corridors loop back, creating tactical retreat options.',
    },
  },

  // =========================================================================
  // 3. THE LABYRINTH
  // =========================================================================
  {
    id: 'labyrinth',
    name: 'The Labyrinth',
    concept: 'Dense maze of corridors with tiny rooms -- claustrophobic and disorienting.',
    description:
      'Corridors are the primary combat space. Rooms are small rest stops between long ' +
      'winding passages. Navigation is the challenge -- the minimap becomes essential. ' +
      'Enemies ambush from side passages and dead ends. Highly favors ranged builds that ' +
      'can clear corridors from a distance.',
    roomPatterns: [
      { name: 'Closet', widthRange: [5, 7], heightRange: [5, 6], shape: 'rectangle', weight: 0.6 },
      { name: 'Junction', widthRange: [7, 9], heightRange: [7, 9], shape: 'cross', weight: 0.3 },
      { name: 'Dead End Chamber', widthRange: [5, 6], heightRange: [5, 6], shape: 'rectangle', weight: 0.1 },
    ],
    environmentalFeatures: [
      {
        name: 'Cracked Floor',
        tileType: TileType.CrackedFloor,
        placement: 'corridor',
        countPerRoom: [1, 4],
        tacticalNote: 'Cosmetic only but signals danger -- cracked floor corridors have higher enemy density spawn weights.',
      },
      {
        name: 'Corridor Pillar',
        tileType: TileType.Pillar,
        placement: 'corridor',
        countPerRoom: [0, 1],
        tacticalNote: 'Placed at corridor intersections. Creates a 1-tile gap on each side, forcing single-file enemy movement.',
      },
    ],
    combatFlow: {
      ranger: 'Pierce builds dominate -- arrows travel the full corridor length. Evasive Roll has limited lateral escape, plan retreat direction carefully.',
      mage: 'Arcane Wall completely seals corridors. Lightning Chain bounces well in tight spaces. Teleport is essential for escaping dead ends.',
      decisions: [
        'Push deeper into an unknown corridor or retreat to a known junction?',
        'Take the side passage (shorter but unknown) or the main corridor (longer but mapped)?',
        'Fight in the corridor (enemies funneled but no escape) or pull enemies back to a junction (more exits)?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [5, 8],
        roomHeight: [5, 7],
        corridorLength: [5, 12],
      },
      corridorWidth: 3,
      steps: [
        'Generate with small rooms and long corridors.',
        'Keep standard 3-wide corridors (feels spacious relative to tiny rooms).',
        'At T-junctions and 4-way intersections, place a single pillar tile in the center.',
        'Mark 20% of corridor tiles as CrackedFloor for visual variety.',
        'Identify dead-end corridors and cap them with a small 4x4 floor area (dead end chamber).',
      ],
    },
    specialRooms: [
      {
        name: 'Trap Corridor',
        minWidth: 3,
        minHeight: 12,
        selectionRule: 'random',
        modifications: 'Select the longest corridor. Place SlowGround tiles on the middle third. Spawn extra enemies at both ends when player enters.',
        purpose: 'Ambush zone. Player is slowed in the middle while enemies close from both directions. Forces cooldown usage.',
      },
      {
        name: 'Map Room',
        minWidth: 8,
        minHeight: 8,
        selectionRule: 'farthest-from-spawn',
        modifications: 'Largest room in the labyrinth. Open space with 4 pillar columns. Boss spawns here.',
        purpose: 'Relief from claustrophobia. The one room where you can maneuver freely -- but that is where the boss waits.',
      },
    ],
    tierScaling: {
      t1: 'Short labyrinth: 5-6 rooms, corridors stay under 8 tiles. Manageable maze.',
      t3: 'Dense labyrinth: 10+ rooms, corridors up to 12 tiles, multiple loops. Getting lost is real.',
      t5: 'Sprawling labyrinth: 15+ rooms, extremely long corridors, many dead ends. The minimap is survival.',
    },
  },

  // =========================================================================
  // 4. CATHEDRAL
  // =========================================================================
  {
    id: 'cathedral',
    name: 'The Cathedral',
    concept: 'One enormous central hall surrounded by small side chapels.',
    description:
      'The map is dominated by a single massive room (30-50% of total floor space) with ' +
      'small rooms branching off it. Most combat happens in the great hall. Side chapels ' +
      'offer brief respite and contain loot. The boss fight takes place in the hall itself, ' +
      'with pillars providing the only cover.',
    roomPatterns: [
      { name: 'Great Hall', widthRange: [20, 30], heightRange: [16, 24], shape: 'rectangle', weight: 0.1 },
      { name: 'Side Chapel', widthRange: [5, 8], heightRange: [5, 7], shape: 'rectangle', weight: 0.65 },
      { name: 'Vestibule', widthRange: [6, 8], heightRange: [6, 8], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      {
        name: 'Column Row',
        tileType: TileType.Pillar,
        placement: 'room-center',
        countPerRoom: [4, 8],
        tacticalNote: 'Two rows of pillars running the length of the great hall. Creates lanes for kiting and breaks up sightlines.',
      },
      {
        name: 'Altar Pit',
        tileType: TileType.Pit,
        placement: 'room-center',
        countPerRoom: [0, 1],
        tacticalNote: 'A sunken area in the center of the great hall. 2x2 pit that enemies path around, splitting groups naturally.',
      },
    ],
    combatFlow: {
      ranger: 'The great hall is a kiting paradise. Pillar rows create natural pierce lines when enemies funnel between columns.',
      mage: 'Pull enemies from side chapels into the great hall for massive AoE payoff. Arcane Wall between pillar rows creates kill zones.',
      decisions: [
        'Clear side chapels first (safer, get loot) or fight in the hall (efficient but chaotic)?',
        'Use pillar rows as cover or stay in the open lanes for maximum kiting room?',
        'Lure the boss between pillars for cover or fight in the open center?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [5, 10],
        roomHeight: [5, 8],
        corridorLength: [2, 5],
      },
      corridorWidth: 3,
      steps: [
        'Generate standard Digger output.',
        'Identify the largest room OR merge 2-3 adjacent rooms by carving walls between them.',
        'If merged room is still under 20x16, expand by carving into surrounding walls (respect map bounds).',
        'Place two parallel rows of pillar tiles running the long axis of the great hall, spaced 4 tiles apart.',
        'Optionally place a 2x2 pit at the hall center.',
        'Side chapels keep default dimensions. Short corridors (2-3 tiles) connect them to the hall.',
      ],
    },
    specialRooms: [
      {
        name: 'The Great Hall',
        minWidth: 20,
        minHeight: 16,
        selectionRule: 'largest',
        modifications: 'Merge adjacent rooms if needed. Two pillar rows. Optional center pit. At least 4 corridor exits to side chapels.',
        purpose: 'Primary combat zone and boss arena. The defining feature of this layout.',
      },
      {
        name: 'Treasure Vault',
        minWidth: 6,
        minHeight: 6,
        selectionRule: 'farthest-from-spawn',
        modifications: 'Single narrow entrance (1 corridor). Extra loot drops. Optional destructible wall hiding the entrance.',
        purpose: 'Reward room tucked behind the great hall. Worth seeking out for guaranteed rare+ drops.',
      },
    ],
    tierScaling: {
      t1: 'Modest hall (~20x16) with 3-4 side chapels. Intimate but still has the pillar rows.',
      t3: 'Grand hall (~28x20) with 6-8 chapels. Enemies spawn from multiple chapel entrances simultaneously.',
      t5: 'Massive hall (~35x24+) with 10+ chapels. The hall alone is a battlefield. Chapels form a ring around it.',
    },
  },

  // =========================================================================
  // 5. CATACOMBS
  // =========================================================================
  {
    id: 'catacombs',
    name: 'The Catacombs',
    concept: 'Circular rooms connected by winding, uneven corridors with pits and slow ground.',
    description:
      'Every room is roughly circular (carved by removing corners from rectangles). ' +
      'Corridors wind unpredictably and are littered with hazardous terrain -- pits that ' +
      'kill on contact and slow ground that punishes careless movement. Navigation requires ' +
      'constant attention. Excellent layout for players who enjoy environmental puzzle combat.',
    roomPatterns: [
      { name: 'Burial Chamber', widthRange: [8, 12], heightRange: [8, 12], shape: 'circular', weight: 0.5 },
      { name: 'Ossuary', widthRange: [6, 8], heightRange: [6, 8], shape: 'circular', weight: 0.35 },
      { name: 'Crypt Alcove', widthRange: [5, 6], heightRange: [5, 6], shape: 'rectangle', weight: 0.15 },
    ],
    environmentalFeatures: [
      {
        name: 'Floor Pit',
        tileType: TileType.Pit,
        placement: 'corridor',
        countPerRoom: [0, 2],
        tacticalNote: 'Pits in corridors create narrow walkways. One wrong step during a retreat is lethal. Enemies can be knocked into pits.',
      },
      {
        name: 'Bone Mire',
        tileType: TileType.SlowGround,
        placement: 'room-edge',
        countPerRoom: [1, 3],
        tacticalNote: 'Patches of slow ground around room edges. Standing in them for kiting is dangerous -- encourages staying in the room center.',
      },
      {
        name: 'Bridge',
        tileType: TileType.Bridge,
        placement: 'corridor',
        countPerRoom: [0, 1],
        tacticalNote: '1-tile-wide bridge over a pit. Forces single-file movement. Perfect ambush point or chokehold.',
      },
    ],
    combatFlow: {
      ranger: 'Circular rooms give 360-degree kiting but slow ground at edges punishes wide orbits. Bridge chokepoints are ideal for Power Shot pierce.',
      mage: 'Pits naturally cluster enemies onto walkable tiles -- free AoE grouping. Teleport ignores slow ground and bridges, giving massive mobility advantage.',
      decisions: [
        'Take the bridge (fast, risky -- one knockback and you fall) or go the long way around?',
        'Kite near slow ground to bait enemies into it, accepting the risk of getting caught yourself?',
        'Fight in circular rooms (predictable but cramped) or pull enemies into corridors (hazardous but funneled)?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [8, 12],
        roomHeight: [8, 12],
        corridorLength: [4, 8],
      },
      corridorWidth: 3,
      steps: [
        'Generate with square-ish room dimensions for circular carving.',
        'For each room, carve corners to approximate a circle: remove corner tiles where distance to room center > half the shorter dimension.',
        'In corridors, randomly place 1x3 or 3x1 pit segments along one side (leaving 2 walkable tiles).',
        'Where pits span the full corridor width, place a 1-tile-wide bridge across.',
        'Stamp SlowGround tiles in a 2-tile ring around the inner edge of circular rooms (30% coverage).',
      ],
    },
    specialRooms: [
      {
        name: 'Central Crypt',
        minWidth: 12,
        minHeight: 12,
        selectionRule: 'largest',
        modifications: 'Large circular room with a raised center platform (floor surrounded by a ring of pit tiles with 4 bridge connections). Boss arena.',
        purpose: 'The boss fights on a platform surrounded by pits. Falling off is instant death. Bridges are the only retreat paths.',
      },
      {
        name: 'Sealed Crypt',
        minWidth: 6,
        minHeight: 6,
        selectionRule: 'random',
        modifications: 'Entrance blocked by 2 destructible wall tiles. Interior has no hazards and a guaranteed chest.',
        purpose: 'Safe treasure room. Reward for exploration.',
      },
    ],
    tierScaling: {
      t1: 'Mild hazards: fewer pits, no bridges. Introduces circular rooms and slow ground gently.',
      t3: 'Full hazard density. Bridges appear. Corridors become genuinely dangerous to retreat through.',
      t5: 'Maximum hazard density. Some corridors are almost impassable without careful navigation or Teleport.',
    },
  },

  // =========================================================================
  // 6. PROVING GROUNDS
  // =========================================================================
  {
    id: 'proving_grounds',
    name: 'The Proving Grounds',
    concept: 'Diamond and cross-shaped rooms with wide-open sightlines and nowhere to hide.',
    description:
      'Rooms are carved into diamond (rotated square) and cross shapes, creating long ' +
      'diagonal sightlines and open centers with pointed corners. Very few pillars or obstacles. ' +
      'This is the layout that tests pure positioning skill -- there is nowhere to hide behind, ' +
      'only space to move through. Corridors are wide, making them viable combat spaces too.',
    roomPatterns: [
      { name: 'Diamond Room', widthRange: [10, 14], heightRange: [10, 14], shape: 'diamond', weight: 0.4 },
      { name: 'Cross Chamber', widthRange: [12, 16], heightRange: [12, 16], shape: 'cross', weight: 0.35 },
      { name: 'Square Hall', widthRange: [8, 12], heightRange: [8, 12], shape: 'rectangle', weight: 0.25 },
    ],
    environmentalFeatures: [
      {
        name: 'Open Ground',
        tileType: TileType.Floor,
        placement: 'room-center',
        countPerRoom: [0, 0],
        tacticalNote: 'Deliberately empty. The lack of cover IS the feature. Every fight is a positioning test.',
      },
      {
        name: 'Cracked Marker',
        tileType: TileType.CrackedFloor,
        placement: 'room-center',
        countPerRoom: [1, 1],
        tacticalNote: 'A cosmetic marker in the exact center of each room. Visual reference point for orienting during chaotic fights.',
      },
    ],
    combatFlow: {
      ranger: 'Heaven for kiting. Diamond rooms give long diagonal runs. Cross rooms let you duck into arms to break chase. Wide corridors support running fights.',
      mage: 'No natural funneling -- must create your own with Arcane Wall. Cross room arms are natural AoE kill zones. Open centers reward well-placed Meteors.',
      decisions: [
        'Use a diamond corner to funnel chasers into a narrow point, or stay center for maximum dodge room?',
        'In cross rooms, fight in the intersection (surrounded) or an arm (funneled but trapped)?',
        'Run-and-gun through wide corridors or hold position in a room?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [10, 16],
        roomHeight: [10, 16],
        corridorLength: [3, 6],
      },
      corridorWidth: 4,
      steps: [
        'Generate with large, square-ish rooms.',
        'Widen corridors to 4 tiles (wider than standard).',
        'For diamond rooms: carve a rotated square by removing triangular corners. Center the diamond within the rectangle bounds.',
        'For cross rooms: start with the rectangle, then fill the 4 corners with wall tiles to create a plus-sign shape.',
        'Do NOT place any pillar or obstacle tiles. Rooms should be completely open.',
        'Place a single CrackedFloor tile at each room center as a visual anchor.',
      ],
    },
    specialRooms: [
      {
        name: 'Grand Diamond',
        minWidth: 16,
        minHeight: 16,
        selectionRule: 'largest',
        modifications: 'Maximum-size diamond room. Boss arena with zero cover. Pure movement skill check.',
        purpose: 'The ultimate test of positioning. Boss + player in an open diamond with nothing between them.',
      },
    ],
    tierScaling: {
      t1: 'Smaller diamonds and crosses. Corridors are still wide. Forgiving sightlines.',
      t3: 'Full-size rooms. The open space becomes intimidating as enemy count increases.',
      t5: 'Enormous rooms with massive open areas. Swarm waves in open space are the true endgame test.',
    },
  },

  // =========================================================================
  // 7. THE WARRENS
  // =========================================================================
  {
    id: 'warrens',
    name: 'The Warrens',
    concept: 'Organic, irregular rooms with many small connecting passages -- a burrow network.',
    description:
      'Rooms have irregular shapes (L-bends, alcoves, uneven walls) and connect through ' +
      'many narrow passages. Every room has 3-5 exits, creating a web of escape routes. ' +
      'No dead ends. The layout rewards aggressive play -- if you get in trouble, there is ' +
      'always another exit. But enemies come from every direction too.',
    roomPatterns: [
      { name: 'L-Bend', widthRange: [8, 12], heightRange: [8, 10], shape: 'L-shaped', weight: 0.35 },
      { name: 'Irregular Cave', widthRange: [7, 11], heightRange: [7, 9], shape: 'irregular', weight: 0.35 },
      { name: 'Burrow', widthRange: [5, 7], heightRange: [5, 6], shape: 'rectangle', weight: 0.3 },
    ],
    environmentalFeatures: [
      {
        name: 'Rubble Pile',
        tileType: TileType.Destructible,
        placement: 'room-corner',
        countPerRoom: [1, 3],
        tacticalNote: 'Destructible rubble in room corners and along walls. Breaks up room shapes further. Can be cleared to open new sightlines.',
      },
      {
        name: 'Mud Patch',
        tileType: TileType.SlowGround,
        placement: 'random',
        countPerRoom: [0, 2],
        tacticalNote: 'Random slow ground patches. Unpredictable placement forces constant terrain awareness.',
      },
    ],
    combatFlow: {
      ranger: 'Irregular walls create unexpected angles for pierce shots. Multiple exits mean you can always find a new kiting lane. L-bends are natural ambush points.',
      mage: 'L-bends funnel enemies around corners perfectly for Frost Nova. Irregular rooms naturally cluster enemies against walls for AoE. Many exits mean Teleport always has a destination.',
      decisions: [
        'Which of the 3-4 exits do you take when retreating? Each leads somewhere different.',
        'Clear rubble to open a shortcut or leave it as a barrier?',
        'Pull enemies from an L-bend (they come in groups around the corner) or push into the room?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [6, 12],
        roomHeight: [6, 10],
        corridorLength: [2, 5],
      },
      corridorWidth: 3,
      steps: [
        'Generate with many rooms and short corridors to maximize connectivity.',
        'For L-shaped rooms: carve one quadrant of the rectangle as floor, leave the opposite quadrant as wall.',
        'For irregular rooms: randomly indent 2-3 wall segments by 1-2 tiles to create alcoves and bumps.',
        'After Digger generation, add extra 2-tile-wide passages between rooms that share a wall (if rooms are within 3 tiles of each other). This creates the dense connectivity.',
        'Place 1-3 destructible tiles in room corners to add texture.',
        'Scatter SlowGround patches randomly (10% of floor tiles in non-corridor areas).',
      ],
    },
    specialRooms: [
      {
        name: 'Den',
        minWidth: 10,
        minHeight: 10,
        selectionRule: 'largest',
        modifications: 'The most-connected room (most exits). Cleared of rubble. Boss spawns here with adds from multiple entrances.',
        purpose: 'Boss arena where enemies pour in from every direction. Managing multiple threat vectors is the challenge.',
      },
      {
        name: 'Stash Nook',
        minWidth: 5,
        minHeight: 5,
        selectionRule: 'random',
        modifications: 'A small room with only 1 exit (exception to the no-dead-ends rule). Contains bonus loot.',
        purpose: 'Rare dead-end with treasure. Finding it in the warren is the reward.',
      },
    ],
    tierScaling: {
      t1: 'Small warren: 5-7 rooms, 2-3 exits per room. Manageable navigation.',
      t3: 'Dense warren: 10-14 rooms, 3-4 exits per room. Enemies appear from unexpected directions.',
      t5: 'Massive warren: 16-20 rooms, 4-5 exits per room. A true web. Every direction leads somewhere.',
    },
  },

  // =========================================================================
  // 8. BRIDGE NETWORK
  // =========================================================================
  {
    id: 'bridge_network',
    name: 'The Abyss Crossing',
    concept: 'Island rooms floating in a void, connected by narrow bridges over lethal pits.',
    description:
      'Rooms are islands surrounded by pit tiles. The only way between rooms is via narrow ' +
      '2-tile-wide bridges. Combat on bridges is terrifying -- knockback means death. ' +
      'Rooms themselves are safe(ish) platforms. The layout creates extreme risk/reward ' +
      'around bridge crossings and rewards builds with strong knockback or pull effects.',
    roomPatterns: [
      { name: 'Island Platform', widthRange: [8, 12], heightRange: [8, 10], shape: 'rectangle', weight: 0.5 },
      { name: 'Small Platform', widthRange: [6, 8], heightRange: [6, 7], shape: 'rectangle', weight: 0.35 },
      { name: 'Large Platform', widthRange: [12, 16], heightRange: [10, 12], shape: 'rectangle', weight: 0.15 },
    ],
    environmentalFeatures: [
      {
        name: 'Void Pit',
        tileType: TileType.Pit,
        placement: 'room-edge',
        countPerRoom: [0, 0],
        tacticalNote: 'The void surrounds every island. Falling in is instant death. The ever-present threat that defines this layout.',
      },
      {
        name: 'Bridge',
        tileType: TileType.Bridge,
        placement: 'corridor',
        countPerRoom: [1, 2],
        tacticalNote: 'Narrow 2-tile bridges are the ONLY path between islands. Fighting on a bridge is high risk. Knockback effects are devastating here.',
      },
      {
        name: 'Guard Pillar',
        tileType: TileType.Pillar,
        placement: 'room-edge',
        countPerRoom: [0, 2],
        tacticalNote: 'Pillars at bridge entrances. Provides a position to fight from without stepping onto the bridge.',
      },
    ],
    combatFlow: {
      ranger: 'Fight from island edges and snipe enemies on bridges. Knockback affixes are god-tier -- knock enemies off bridges into the void. Evasive Roll on a bridge is terrifying.',
      mage: 'Arcane Wall on a bridge entrance completely blocks an attack vector. Teleport between islands skips bridges entirely. Frost Nova at a bridge mouth stops enemies from crossing.',
      decisions: [
        'Cross the bridge now (fast but exposed) or clear enemies on the other side from range first?',
        'Use knockback to push enemies off bridges (instant kills) or save it for self-defense?',
        'Take the direct bridge (one crossing, enemies waiting) or loop around via two shorter bridges?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [6, 14],
        roomHeight: [6, 12],
        corridorLength: [3, 8],
      },
      corridorWidth: 3,
      steps: [
        'Generate standard Digger output.',
        'Convert ALL corridor tiles to pit tiles (TileType.Pit).',
        'For each original corridor, carve a 2-tile-wide bridge path through the pit (TileType.Bridge).',
        'Add a 1-tile border of pit tiles around every room (where adjacent to walls, not corridors).',
        'Fill all remaining wall tiles adjacent to bridges with pit tiles (so bridges visually span a void).',
        'Place pillar tiles at bridge-to-room transition points (the 2 tiles flanking each bridge entrance).',
      ],
    },
    specialRooms: [
      {
        name: 'Central Platform',
        minWidth: 14,
        minHeight: 12,
        selectionRule: 'largest',
        modifications: 'Largest island. 3-4 bridge connections. Boss arena with pillar cover. Bridge entrances can be walled off with Arcane Wall.',
        purpose: 'Boss island. The boss has knockback attacks that can push you toward bridge edges.',
      },
      {
        name: 'Treasure Isle',
        minWidth: 6,
        minHeight: 6,
        selectionRule: 'farthest-from-spawn',
        modifications: 'Small island connected by a single long bridge. Guaranteed rare+ loot.',
        purpose: 'Risk/reward: one long bridge crossing to reach the treasure. Getting ambushed on the bridge back is the danger.',
      },
    ],
    tierScaling: {
      t1: '4-5 islands, short bridges (3-4 tiles). Pits are present but crossings are quick.',
      t3: '7-9 islands, medium bridges (5-8 tiles). Some bridges curve or have a small mid-bridge platform.',
      t5: '11-15 islands, long bridges (up to 12 tiles). Some islands only connect to one bridge -- dead ends over void.',
    },
  },

  // =========================================================================
  // 9. ARENA RING
  // =========================================================================
  {
    id: 'arena_ring',
    name: 'The Crucible',
    concept: 'A circular ring track with a central arena and spoke corridors connecting them.',
    description:
      'The map is organized as a ring of rooms around a large central arena. Spoke corridors ' +
      'connect the ring to the center. Players can circle the ring indefinitely for kiting, ' +
      'or cut through the center for faster traversal (but the center is where the boss lives). ' +
      'Creates a constant choice between the safe outer ring and the dangerous inner shortcut.',
    roomPatterns: [
      { name: 'Ring Segment', widthRange: [8, 12], heightRange: [6, 8], shape: 'rectangle', weight: 0.5 },
      { name: 'Central Arena', widthRange: [18, 24], heightRange: [14, 18], shape: 'circular', weight: 0.05 },
      { name: 'Corner Room', widthRange: [7, 10], heightRange: [7, 10], shape: 'rectangle', weight: 0.45 },
    ],
    environmentalFeatures: [
      {
        name: 'Arena Pillar',
        tileType: TileType.Pillar,
        placement: 'room-center',
        countPerRoom: [2, 6],
        tacticalNote: 'Pillars in the central arena arranged in a circle. Creates a ring of cover within the ring layout.',
      },
      {
        name: 'Speed Lane',
        tileType: TileType.CrackedFloor,
        placement: 'corridor',
        countPerRoom: [0, 0],
        tacticalNote: 'Spoke corridors marked with cracked floor to visually distinguish them from ring connectors.',
      },
    ],
    combatFlow: {
      ranger: 'The ring is a kiting highway -- circle endlessly while firing backward. Spokes let you cut through to shake pursuers. Central arena pillars give cover for precision shots.',
      mage: 'Ring rooms are perfect for chaining AoE as enemies follow in a line. Arcane Wall across a ring segment forces enemies to take the long way around. Central arena for maximum AoE payoff.',
      decisions: [
        'Keep circling the ring (safe, enemies spread out) or cut through the center (fast, dangerous)?',
        'Block a ring segment with Arcane Wall to force enemies into the center, or keep the ring open for retreat?',
        'Clear the ring first (isolate the boss in the center) or go straight for the boss?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [7, 12],
        roomHeight: [6, 10],
        corridorLength: [3, 6],
      },
      corridorWidth: 3,
      steps: [
        'Generate standard Digger output.',
        'Identify the room closest to the map center and expand it significantly (merge neighbors if needed) to create the central arena.',
        'Carve the central arena into a circular shape.',
        'Identify 4-6 rooms roughly equidistant around the central arena for the ring.',
        'Ensure ring rooms are connected to each other in sequence (carve additional corridors if needed).',
        'Ensure each ring room has a spoke corridor to the central arena.',
        'Place pillar tiles in a circular pattern within the central arena.',
        'Any remaining rooms become side alcoves off the ring.',
      ],
    },
    specialRooms: [
      {
        name: 'The Crucible',
        minWidth: 18,
        minHeight: 14,
        selectionRule: 'largest',
        modifications: 'Circular carved central room. Ring of 6 pillars. 4-6 spoke corridors as entrances. Boss arena.',
        purpose: 'The heart of the map. All roads lead here. Boss fight with multiple entry/exit points.',
      },
      {
        name: 'Supply Cache',
        minWidth: 6,
        minHeight: 6,
        selectionRule: 'random',
        modifications: 'A room off the ring with a single entrance. Contains health globe spawner and loot.',
        purpose: 'Pit stop on the ring. Duck in, grab supplies, get back to fighting.',
      },
    ],
    tierScaling: {
      t1: 'Small ring: 4 rooms around a modest central arena. Spokes are short. Fast laps.',
      t3: 'Full ring: 6-8 rooms. Central arena is large. Ring laps take 8-10 seconds of running.',
      t5: 'Grand ring: 8-10 rooms with side alcoves. Central arena is massive. Multiple ring layers possible.',
    },
  },

  // =========================================================================
  // 10. FRACTURED HALLS
  // =========================================================================
  {
    id: 'fractured_halls',
    name: 'The Fractured Halls',
    concept: 'Long rectangular halls bisected by destructible walls, creating a push-through combat experience.',
    description:
      'The map is built from elongated rectangular halls (3:1 aspect ratio) arranged in a ' +
      'roughly linear sequence. Each hall is divided into 2-3 sections by destructible walls. ' +
      'Players must fight through each section to break the wall and advance. Creates a ' +
      'satisfying push-forward tempo where you conquer territory section by section. ' +
      'Retreating means giving up cleared ground.',
    roomPatterns: [
      { name: 'Long Hall', widthRange: [14, 20], heightRange: [6, 8], shape: 'rectangle', weight: 0.5 },
      { name: 'Wide Hall', widthRange: [10, 14], heightRange: [8, 10], shape: 'rectangle', weight: 0.3 },
      { name: 'Antechamber', widthRange: [6, 8], heightRange: [6, 8], shape: 'rectangle', weight: 0.2 },
    ],
    environmentalFeatures: [
      {
        name: 'Section Wall',
        tileType: TileType.Destructible,
        placement: 'room-center',
        countPerRoom: [1, 2],
        tacticalNote: 'Destructible walls dividing halls into sections. Must be broken to advance. Enemies behind the wall are safe until you push through.',
      },
      {
        name: 'Cover Pillar',
        tileType: TileType.Pillar,
        placement: 'room-edge',
        countPerRoom: [1, 2],
        tacticalNote: 'Pillars along hall walls. Provides cover during the push forward.',
      },
      {
        name: 'Rubble',
        tileType: TileType.SlowGround,
        placement: 'room-center',
        countPerRoom: [0, 1],
        tacticalNote: 'Slow ground left behind when destructible walls break. The cleared path remains slightly hazardous.',
      },
    ],
    combatFlow: {
      ranger: 'Long halls are pierce heaven. Section walls create safe positions to fire from. Push forward when the section is clear, set up at the next wall.',
      mage: 'Each section is a contained AoE zone. Break the wall, fire into the fresh enemy group. Arcane Wall behind you prevents retreat ambushes while you push forward.',
      decisions: [
        'Break the section wall immediately (surprise attack but enemies on both sides) or clear your section first?',
        'Push aggressively through a hall or methodically clear each section?',
        'Use the broken section wall rubble (slow ground) defensively or ignore it?',
      ],
    },
    postProcessing: {
      diggerOverrides: {
        roomWidth: [10, 20],
        roomHeight: [6, 10],
        corridorLength: [2, 4],
      },
      corridorWidth: 3,
      steps: [
        'Generate with elongated room dimensions.',
        'For halls longer than 12 tiles: place a line of destructible tiles across the width at the 1/3 and 2/3 points, leaving a 1-tile gap on each end for partial cover.',
        'For halls longer than 16 tiles: place 2 section walls (at 1/3 and 2/3 points).',
        'Place pillar tiles along the long walls every 4-6 tiles.',
        'Short corridors between halls. Antechambers serve as buffer zones between hall sequences.',
        'When a destructible wall breaks, replace center tiles with SlowGround (rubble).',
      ],
    },
    specialRooms: [
      {
        name: 'Throne Hall',
        minWidth: 18,
        minHeight: 10,
        selectionRule: 'farthest-from-spawn',
        modifications: 'The final hall. Three section walls. Boss waits in the last section. Each section has increasing enemy density.',
        purpose: 'Multi-stage boss fight where you push through 3 defensive lines to reach the boss in the back of the hall.',
      },
      {
        name: 'Armory',
        minWidth: 8,
        minHeight: 6,
        selectionRule: 'second-room',
        modifications: 'Side room off the first hall. No section walls. Contains extra destructible walls hiding loot caches.',
        purpose: 'Early reward room to get the player excited about breaking destructibles.',
      },
    ],
    tierScaling: {
      t1: 'Linear: 3-4 halls in sequence, 1 section wall each. Straightforward push.',
      t3: 'Branching: 6-8 halls, some parallel. 2 section walls per long hall. Multiple paths forward.',
      t5: 'Complex: 10+ halls forming an H or grid pattern. 2-3 section walls each. Clearing the map is a campaign.',
    },
  },

];
