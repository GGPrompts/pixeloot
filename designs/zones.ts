/**
 * Zone Theme Designs for Pixeloot
 *
 * 12 zone themes with hazards, palettes, enemy compositions, and gameplay modifiers.
 * Each zone is designed to change how the player approaches combat, not just
 * what the map looks like. Intended as a design reference for implementation.
 *
 * Enemy types available: rusher, swarm, tank, sniper, flanker, splitter, shielder
 *
 * Map sizes scale with tier:
 *   T1 ~85x50   T2 ~110x65   T3 ~135x80   T4 ~160x95   T5 ~185x110
 *   (derived from MapDevice: baseW = 60 + tier * 25, baseH proportional)
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface ZonePalette {
  /** PixiJS app background color */
  backgroundColor: number;
  /** Grid line color drawn across floors */
  gridColor: number;
  /** Grid line opacity (0.0 - 1.0) */
  gridAlpha: number;
  /** Solid wall fill color */
  wallColor: number;
  /** Accent color used for UI tints, particle effects, damage numbers */
  accentColor: number;
  /** Secondary accent for dual-tone zones (optional) */
  accentColorAlt?: number;
  /** Multiplier to dim enemy tint in dark zones (0.0 - 1.0, default 1.0) */
  enemyTintMultiplier?: number;
}

export type EnemyType =
  | 'rusher'
  | 'swarm'
  | 'tank'
  | 'sniper'
  | 'flanker'
  | 'splitter'
  | 'shielder';

export interface EnemySpawnWeight {
  type: EnemyType;
  /** Relative spawn weight. Higher = more of this type. */
  weight: number;
}

export interface EnvironmentalHazard {
  /** Short identifier for the hazard (used as a key in systems) */
  id: string;
  /** Human-readable name */
  name: string;
  /** What it does to the player or enemies */
  effect: string;
  /** Gameplay numbers for implementation */
  mechanics: string;
  /** How the hazard is placed on the map */
  placement: string;
  /** Visual description for rendering */
  visual: string;
}

export interface MapSizeHint {
  /** Tile width at tier 1 */
  t1Width: number;
  /** Tile height at tier 1 */
  t1Height: number;
  /** Tile width at tier 5 */
  t5Width: number;
  /** Tile height at tier 5 */
  t5Height: number;
  /** How the dungeon generator should shape this zone */
  layoutNotes: string;
}

export interface ZoneDesign {
  /** Internal key (snake_case, matches ZoneThemes.ts convention) */
  key: string;
  /** Display name */
  name: string;
  /** One-sentence thematic concept */
  concept: string;
  /** Full color palette */
  palette: ZonePalette;
  /** Environmental hazards active in this zone */
  hazards: EnvironmentalHazard[];
  /** Enemy spawn weight distribution */
  enemySpawnWeights: EnemySpawnWeight[];
  /** Description of ambient particle effects */
  ambientParticles: string;
  /** The visual gimmick that makes this zone feel distinct */
  visualGimmick: string;
  /** How the zone changes gameplay beyond cosmetics */
  gameplayImpact: string;
  /** Map generation size and shape hints */
  mapSize: MapSizeHint;
  /** Suggested minimum player level (soft guide for map drops) */
  suggestedMinLevel: number;
}

// ---------------------------------------------------------------------------
// Zone Designs
// ---------------------------------------------------------------------------

export const ZONE_DESIGNS: ZoneDesign[] = [
  // =========================================================================
  // 1. THE GRID (tutorial / starter zone)
  // =========================================================================
  {
    key: 'the_grid',
    name: 'The Grid',
    concept:
      'A clean digital training ground -- the first zone new players see, with balanced enemy composition and no hazards.',
    palette: {
      backgroundColor: 0x1a1a2e,
      gridColor: 0x00ffff,
      gridAlpha: 0.06,
      wallColor: 0x0d0d1a,
      accentColor: 0x00ffff,
    },
    hazards: [],
    enemySpawnWeights: [
      { type: 'rusher', weight: 30 },
      { type: 'swarm', weight: 25 },
      { type: 'tank', weight: 10 },
      { type: 'sniper', weight: 10 },
      { type: 'flanker', weight: 10 },
      { type: 'splitter', weight: 10 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Sparse floating cyan dots drifting slowly upward. Low density, small size (1-2px). Gives a subtle "data in the air" feel without obscuring gameplay.',
    visualGimmick:
      'Grid lines pulse faintly in a radial wave outward from the player every few seconds, like sonar pings on a radar.',
    gameplayImpact:
      'No hazards, no spawn bias. This is the baseline zone. Balanced enemy mix teaches players all enemy types. Good room sizes and corridor widths -- nothing punishing.',
    mapSize: {
      t1Width: 85,
      t1Height: 50,
      t5Width: 185,
      t5Height: 110,
      layoutNotes:
        'Standard rot-js Digger output. Medium rooms (6-16 wide, 6-12 tall), corridors widened to 3 tiles. No special generation rules.',
    },
    suggestedMinLevel: 1,
  },

  // =========================================================================
  // 2. NEON WASTES
  // =========================================================================
  {
    key: 'neon_wastes',
    name: 'Neon Wastes',
    concept:
      'A corrupted purple void swarming with fast enemies. Overwhelming numbers force constant movement and AoE usage.',
    palette: {
      backgroundColor: 0x1a0a2e,
      gridColor: 0xff00ff,
      gridAlpha: 0.06,
      wallColor: 0x150a20,
      accentColor: 0xff00ff,
    },
    hazards: [
      {
        id: 'void_rifts',
        name: 'Void Rifts',
        effect:
          'Swirling magenta tears in the floor that pull enemies and projectiles toward them. Player is slowed 20% while inside.',
        mechanics:
          'Placed in 2-3 rooms. 3-tile radius. Player receives -20% move speed while overlapping. Enemy pathfinding ignores rifts (they walk through). Player projectiles passing through are deflected slightly toward the rift center.',
        placement:
          'Centered in medium-to-large rooms. Never placed in corridors or within 5 tiles of the spawn room.',
        visual:
          'Rotating magenta spiral particles converging inward. Dark purple floor tint in the affected radius. Subtle screen-space distortion at edges.',
      },
    ],
    enemySpawnWeights: [
      { type: 'swarm', weight: 35 },
      { type: 'flanker', weight: 25 },
      { type: 'rusher', weight: 20 },
      { type: 'sniper', weight: 5 },
      { type: 'tank', weight: 5 },
      { type: 'splitter', weight: 5 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Dense field of tiny magenta and purple motes drifting in random directions. Higher density than The Grid. Occasional bright flash particles that pop in and fade quickly.',
    visualGimmick:
      'Walls have a faint magenta inner glow that pulses with a slow breathing rhythm. The grid lines flicker randomly in small patches, like a corrupted display.',
    gameplayImpact:
      'High swarm/flanker density means the player is constantly pressured from multiple angles. Void rifts create "safe zones" that enemies path through freely but slow the player -- standing still is punished. Rewards AoE skills (Fireball, Multi Shot) and movement skills. Rangers benefit from pierce since enemies line up while chasing. Mages benefit from herding swarms into AoE payoff zones.',
    mapSize: {
      t1Width: 90,
      t1Height: 55,
      t5Width: 190,
      t5Height: 115,
      layoutNotes:
        'Slightly wider maps than standard. Favor larger rooms with multiple entrances. Corridors should be normal width (3 tiles). More rooms overall to spread out the swarm spawns.',
    },
    suggestedMinLevel: 3,
  },

  // =========================================================================
  // 3. REACTOR CORE
  // =========================================================================
  {
    key: 'reactor_core',
    name: 'Reactor Core',
    concept:
      'A superheated industrial zone with burning ground patches that deal damage over time. Fire resistance matters here.',
    palette: {
      backgroundColor: 0x2e1a0a,
      gridColor: 0xff6600,
      gridAlpha: 0.06,
      wallColor: 0x201005,
      accentColor: 0xff6600,
      accentColorAlt: 0xff2200,
    },
    hazards: [
      {
        id: 'burning_ground',
        name: 'Burning Ground',
        effect:
          'Patches of floor that deal fire damage over time to the player. Enemies are immune.',
        mechanics:
          'Deals 3% max HP per second as fire damage (reduced by fire resistance). Patches are 2-4 tiles in size. 15-25% of floor tiles are burning ground. Refreshes a 1s Burn status effect while standing on it.',
        placement:
          'Scattered across rooms and corridors. Guaranteed in at least half of all rooms. Never covers the spawn tile. At higher tiers, coverage increases (T1: 15%, T5: 25%).',
        visual:
          'Orange-red glow pulsing on affected tiles. Small flame particles rising from the surface. Distinct from normal floor so the player can path around it.',
      },
      {
        id: 'heat_vents',
        name: 'Heat Vents',
        effect:
          'Periodic bursts of flame from wall-adjacent tiles. Telegraphed with a 1-second warning glow.',
        mechanics:
          'Activates every 5 seconds. 1-second telegraph (tiles glow bright orange). Burst deals 8% max HP as fire damage in a 2-tile line perpendicular to the wall. Enemies caught in it take half damage.',
        placement:
          'Along walls in corridors and room edges. 2-3 vents per room. Stagger activation timers so they do not all fire simultaneously.',
        visual:
          'Warning phase: tiles pulse bright orange with upward arrow particles. Burst phase: column of flame particles shooting outward from wall for 0.3 seconds.',
      },
    ],
    enemySpawnWeights: [
      { type: 'rusher', weight: 30 },
      { type: 'swarm', weight: 20 },
      { type: 'tank', weight: 15 },
      { type: 'flanker', weight: 10 },
      { type: 'sniper', weight: 10 },
      { type: 'splitter', weight: 10 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Slow-rising orange ember particles across the entire map. Dense near burning ground, sparse elsewhere. Occasional bright sparks that arc upward and fade.',
    visualGimmick:
      'Walls have a subtle red-to-orange gradient glow along their inner edges, as if radiating heat. The grid lines are drawn in a warm orange that slowly shifts between orange and deep red.',
    gameplayImpact:
      'Burning ground restricts safe floor space, forcing players to plan paths through rooms carefully. Corridor fights become dangerous because burning ground narrows the safe lane. Heat vents punish players who hug walls for safety. Fire resistance gear becomes valuable. Rushers are boosted here, creating aggressive pressure that combines with terrain damage. Players must balance dodging enemies and dodging ground hazards simultaneously.',
    mapSize: {
      t1Width: 80,
      t1Height: 50,
      t5Width: 175,
      t5Height: 105,
      layoutNotes:
        'Slightly smaller and more compact than standard. Rooms should be medium-sized with 2-3 exits. Corridors are standard width but often L-shaped, creating corners where heat vents are placed.',
    },
    suggestedMinLevel: 5,
  },

  // =========================================================================
  // 4. FROZEN ARRAY
  // =========================================================================
  {
    key: 'frozen_array',
    name: 'Frozen Array',
    concept:
      'An icy digital plane with slow zones and slippery corridors. Defensive and methodical -- rewards patience and positioning.',
    palette: {
      backgroundColor: 0x0a1a2e,
      gridColor: 0x88ccff,
      gridAlpha: 0.06,
      wallColor: 0x051020,
      accentColor: 0x88ccff,
      accentColorAlt: 0xaaeeff,
    },
    hazards: [
      {
        id: 'frost_patches',
        name: 'Frost Patches',
        effect:
          'Icy floor zones that apply Chill to the player: -20% movement speed, -15% attack speed for 3 seconds.',
        mechanics:
          'Chill refreshes while standing on the patch. 10-20% of floor tiles are frost patches. Cold resistance reduces the movement slow (but not attack speed penalty). Enemies crossing frost patches are also slowed by 15%.',
        placement:
          'Concentrated in corridors and room entrances (chokepoints). Some rooms are entirely frosted. The spawn room is always clear.',
        visual:
          'Light blue translucent overlay on affected tiles with subtle crystalline particle shimmer. Ice crack patterns drawn on the tile surface.',
      },
      {
        id: 'ice_walls',
        name: 'Cryo Barriers',
        effect:
          'Destructible ice walls that block movement but not projectiles. Break after taking a threshold of damage.',
        mechanics:
          'Each ice wall tile has 50 HP (scaled by tier). Player and enemy projectiles both damage them. Blocking movement for both player and enemies. Destroyed ice walls leave frost patch tiles for 10 seconds.',
        placement:
          'Placed across corridor intersections and room doorways. 1-3 per map at T1, up to 6-8 at T5. Never fully seal a room (always leave at least one open path).',
        visual:
          'Semi-transparent blue-white blocks with internal crystal refraction lines. Crack visual as HP decreases. Shatter particle burst on destruction.',
      },
    ],
    enemySpawnWeights: [
      { type: 'tank', weight: 25 },
      { type: 'sniper', weight: 25 },
      { type: 'shielder', weight: 15 },
      { type: 'rusher', weight: 15 },
      { type: 'swarm', weight: 10 },
      { type: 'flanker', weight: 5 },
      { type: 'splitter', weight: 5 },
    ],
    ambientParticles:
      'Slow-falling tiny white snowflake particles. Very sparse. Occasional glinting ice crystal that catches light and flashes briefly.',
    visualGimmick:
      'Walls have a crystalline ice texture effect -- sharp angular highlights along wall edges. The grid has a faint blue shimmer that propagates outward from frost patches in slow waves.',
    gameplayImpact:
      'Frost patches in corridors force players to decide: take the fast route through ice (chilled, vulnerable) or the long way around. Cryo barriers create temporary cover and chokepoints that both sides can exploit. Heavy tank/sniper spawns mean slow, tanky fights where positioning behind cryo barriers matters. Snipers behind ice walls can shoot through but the player cannot reach them without breaking the wall first. Cold resistance gear is valuable but not mandatory. Rangers benefit from long-range pierce through cryo barriers. Mages benefit from AoE that can clear both ice walls and grouped enemies.',
    mapSize: {
      t1Width: 85,
      t1Height: 55,
      t5Width: 185,
      t5Height: 115,
      layoutNotes:
        'Standard room sizes but with extra corridor length. Long winding corridors between rooms create kiting lanes. Room shapes favor rectangles over squares (long firing lanes for snipers).',
    },
    suggestedMinLevel: 5,
  },

  // =========================================================================
  // 5. OVERGROWTH
  // =========================================================================
  {
    key: 'overgrowth',
    name: 'Overgrowth',
    concept:
      'A corrupted organic network where enemies multiply and regenerate. Splitters and tanks thrive in dense, cluttered rooms.',
    palette: {
      backgroundColor: 0x0a1f0a,
      gridColor: 0x44dd88,
      gridAlpha: 0.06,
      wallColor: 0x2d6b2d,
      accentColor: 0x44dd88,
      accentColorAlt: 0x22aa44,
    },
    hazards: [
      {
        id: 'regen_spores',
        name: 'Regen Spores',
        effect:
          'Pulsing green zones that heal enemies standing inside them by 2% max HP per second. Players gain no benefit.',
        mechanics:
          'Each spore zone is 3-4 tiles in radius. Enemies inside regenerate 2% max HP/sec. Player receives no healing. Spore zones can be destroyed by dealing 100 damage to the center tile (tier-scaled). Destroyed spores leave harmless ground for 30 seconds, then regrow.',
        placement:
          'Placed in the center or corners of medium-to-large rooms. 1-2 per room. Never in corridors. The spawn room has none.',
        visual:
          'Soft green glow on affected tiles with slowly rising spore particles (small green circles floating up). Center tile has a pulsing mushroom-like graphic.',
      },
      {
        id: 'vine_snare',
        name: 'Vine Snares',
        effect:
          'Hidden floor traps that root the player in place for 1 second when triggered. Visible only at close range.',
        mechanics:
          'Invisible beyond 4 tiles of player distance, then fade in as the player approaches. Triggers on player contact: root for 1 second (cannot move, can still attack and use skills). 3-second cooldown before the same snare can trigger again. Does not affect enemies.',
        placement:
          'Scattered in corridors and near room entrances. 5-10 per map at T1, up to 15-20 at T5. Never placed within 3 tiles of the spawn point.',
        visual:
          'When revealed: dark green vine tendrils on the floor tile. When triggered: vines wrap upward around the player position with a brief green flash. Idle snares have a subtle pulse.',
      },
    ],
    enemySpawnWeights: [
      { type: 'splitter', weight: 30 },
      { type: 'tank', weight: 25 },
      { type: 'swarm', weight: 20 },
      { type: 'rusher', weight: 10 },
      { type: 'flanker', weight: 5 },
      { type: 'sniper', weight: 5 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Floating green spore particles that drift lazily in random directions. Slightly larger than other zones (2-3px). Occasional leaf-like particle that spirals downward.',
    visualGimmick:
      'Walls have organic, uneven edges -- instead of clean pixel blocks, wall tiles have vine-like tendrils extending 2-4 pixels into the floor space (cosmetic only, does not affect collision). The grid lines are drawn with slight waviness instead of perfectly straight.',
    gameplayImpact:
      'Splitter-heavy spawns mean enemy count escalates rapidly during fights. Regen spores force the player to prioritize destroying heal zones before fighting tanky enemies nearby, adding a target-priority layer. Vine snares punish reckless rushing through corridors -- players who move cautiously and lead with projectiles are rewarded. Getting snared in a room full of splitters is dangerous. Mages excel here (AoE clears split minions efficiently). Rangers need careful pierce alignment to maximize kills before splits happen.',
    mapSize: {
      t1Width: 80,
      t1Height: 50,
      t5Width: 180,
      t5Height: 110,
      layoutNotes:
        'Dense room layout with many small-to-medium rooms connected by short corridors. Rooms are cluttered (smaller floor area relative to walls). Room shapes should be irregular where possible -- not clean rectangles.',
    },
    suggestedMinLevel: 8,
  },

  // =========================================================================
  // 6. STORM NETWORK
  // =========================================================================
  {
    key: 'storm_network',
    name: 'Storm Network',
    concept:
      'An electrified zone where lightning arcs chain between enemies and hazards. Tight groups are punished -- spread positioning is key.',
    palette: {
      backgroundColor: 0x1a1a0a,
      gridColor: 0xffdd44,
      gridAlpha: 0.06,
      wallColor: 0x5a5a2a,
      accentColor: 0xffdd44,
      accentColorAlt: 0xffff88,
    },
    hazards: [
      {
        id: 'lightning_rods',
        name: 'Lightning Rods',
        effect:
          'Metal pylons that periodically discharge chain lightning. The arc jumps between nearby entities (player and enemies) within range.',
        mechanics:
          'Each rod discharges every 4 seconds. Lightning arc hits the nearest entity within 5 tiles, then chains to the next nearest within 3 tiles (up to 3 bounces). Each hit deals 5% max HP as lightning damage (reduced by lightning resistance). Both player and enemies can be hit. Standing far from rods and other entities avoids chains.',
        placement:
          'Placed in the centers of rooms and at corridor intersections. 1-2 per room. Rods are indestructible terrain features (tile type 2 or similar).',
        visual:
          'Yellow metallic pylon graphic on the tile. Before discharge: crackling yellow spark particles at the top. During discharge: bright yellow lightning bolt lines drawn between the rod and each hit entity. Brief white flash on hit.',
      },
      {
        id: 'conductive_floor',
        name: 'Conductive Floor',
        effect:
          'Metallic floor tiles that amplify lightning damage taken by 25% while standing on them.',
        mechanics:
          'Passive damage amplification -- 25% more lightning damage taken while standing on these tiles. Affects both player and enemies. 20-30% of floor tiles are conductive.',
        placement:
          'Concentrated around lightning rods in a 3-tile radius. Also found in some corridors. The spawn room has minimal coverage.',
        visual:
          'Shiny metallic yellow-gray tint on floor tiles. Subtle electrical crackle particle along tile edges.',
      },
    ],
    enemySpawnWeights: [
      { type: 'sniper', weight: 25 },
      { type: 'flanker', weight: 20 },
      { type: 'rusher', weight: 20 },
      { type: 'shielder', weight: 15 },
      { type: 'swarm', weight: 10 },
      { type: 'tank', weight: 5 },
      { type: 'splitter', weight: 5 },
    ],
    ambientParticles:
      'Erratic yellow spark particles that zip quickly across short distances (3-5px travel) then vanish. Occasional bright yellow flash near walls. Higher particle speed than other zones.',
    visualGimmick:
      'Grid lines have a jittery, unstable quality -- they shift 1px randomly each frame within a small range, creating an electrical interference look. Lightning rod discharge causes a brief screen-wide yellow tint flash.',
    gameplayImpact:
      'Lightning rods punish clustering. The player must stay spread from enemies to avoid chain damage, but enemies naturally converge on the player. This creates a constant tension: kill enemies before they group up near you near a rod. Conductive floor tiles around rods mean the highest-damage spots are also the most dangerous to stand on. Sniper/flanker heavy composition keeps the player moving and spread out. Swarm enemies are rare here but devastating when they cluster near rods (chain lightning bounces freely). Lightning resistance gear becomes very valuable. Mage Lightning Chain skill is thematically fitting but mechanically risky (it triggers near rods).',
    mapSize: {
      t1Width: 90,
      t1Height: 55,
      t5Width: 190,
      t5Height: 115,
      layoutNotes:
        'Open room layouts with large rooms (10-16 tile wide). Fewer but bigger rooms with wide connecting corridors. Rooms should be spacious enough that the player can stay spread from rods and enemies. Minimal dead ends.',
    },
    suggestedMinLevel: 10,
  },

  // =========================================================================
  // 7. THE ABYSS
  // =========================================================================
  {
    key: 'the_abyss',
    name: 'The Abyss',
    concept:
      'Near-total darkness. Enemies are barely visible until close range. A visibility challenge that rewards cautious play and light radius gear.',
    palette: {
      backgroundColor: 0x050508,
      gridColor: 0x4444aa,
      gridAlpha: 0.04,
      wallColor: 0x101018,
      accentColor: 0x4444aa,
      enemyTintMultiplier: 0.3,
    },
    hazards: [
      {
        id: 'darkness',
        name: 'Abyssal Darkness',
        effect:
          'Extreme fog of war. Entities beyond the player light radius are invisible. Light radius gear directly increases safe visibility.',
        mechanics:
          'Default visibility radius is 5 tiles (160px). Light radius gear affixes increase this (each +10% light radius adds ~0.5 tiles). Enemies outside the visibility circle are fully invisible (alpha 0) and fade in as they enter the edge. Enemy projectiles are also invisible until they enter the light radius. The minimap only shows explored tiles.',
        placement: 'Global effect -- applies to the entire map.',
        visual:
          'Radial gradient darkness emanating from screen edges toward the player. Only the area around the player is lit. The "lit" area has a faint indigo tinge. Edge of visibility has a soft falloff over 2 tiles.',
      },
      {
        id: 'shadow_pools',
        name: 'Shadow Pools',
        effect:
          'Patches of deeper darkness that reduce the player light radius by 50% while standing inside.',
        mechanics:
          'Halves the effective light radius while the player overlaps. Enemies inside shadow pools gain +20% movement speed (they are "at home" in the dark). 10-15% of floor tiles are shadow pools.',
        placement:
          'Placed in room centers and along corridors. The spawn room has a small shadow-free zone. Larger rooms may have multiple pools.',
        visual:
          'Even darker floor with faint purple-black swirl particles. The edges of shadow pools have a wispy smoke effect.',
      },
    ],
    enemySpawnWeights: [
      { type: 'flanker', weight: 30 },
      { type: 'rusher', weight: 25 },
      { type: 'sniper', weight: 15 },
      { type: 'splitter', weight: 10 },
      { type: 'swarm', weight: 10 },
      { type: 'tank', weight: 5 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Almost none. Extremely sparse, tiny dark-indigo motes that are barely visible. Occasional faint purple wisp that drifts through the light radius and vanishes. The absence of particles IS the effect.',
    visualGimmick:
      'Enemy glow is heavily reduced (enemyTintMultiplier 0.3) so they blend with the dark background. Enemies briefly flash at full brightness when they take damage, revealing their position. The player character has a visible glow aura that serves as the light source.',
    gameplayImpact:
      'Fundamentally changes combat from reaction-based to anticipation-based. Players cannot see incoming threats until close range, making flankers and rushers feel much more dangerous. Snipers firing from outside visibility are terrifying -- the player sees the projectile appear from darkness. Shadow pools create "blind spots" where the player is most vulnerable. Light radius affixes on gear (normally a low-priority utility stat) become survival-critical. Movement skills are essential for escaping ambushes. The minimap becomes a critical navigation tool since the player cannot see the full room layout. Forces slower, more careful play.',
    mapSize: {
      t1Width: 75,
      t1Height: 45,
      t5Width: 170,
      t5Height: 100,
      layoutNotes:
        'Slightly smaller maps to keep clear-time reasonable despite slow exploration pace. Mix of small and medium rooms. Corridors should have frequent turns and bends so the player cannot see far ahead even with good light radius. Some dead-end alcoves where enemies lurk.',
    },
    suggestedMinLevel: 12,
  },

  // =========================================================================
  // 8. CHROMATIC RIFT
  // =========================================================================
  {
    key: 'chromatic_rift',
    name: 'Chromatic Rift',
    concept:
      'A chaotic multi-element zone where all enemy types appear in equal measure and the floor shifts between elemental states. The hardest standard zone.',
    palette: {
      backgroundColor: 0x1a0a1a,
      gridColor: 0xff44ff,
      gridAlpha: 0.06,
      wallColor: 0x3a2a3a,
      accentColor: 0xff44ff,
      accentColorAlt: 0x44ffff,
    },
    hazards: [
      {
        id: 'chromatic_shift',
        name: 'Chromatic Shift',
        effect:
          'The entire map cycles between elemental states every 15 seconds: Fire (burn damage on floor), Ice (global chill), Lightning (random chain arcs). Each state lasts 5 seconds with a 5-second neutral gap.',
        mechanics:
          'Fire phase: all floor tiles deal 2% max HP/sec fire damage. Ice phase: all entities (player and enemies) are Chilled (-20% move, -15% attack speed). Lightning phase: random lightning arcs strike 3-5 positions on the map every second, dealing 6% max HP to anything hit. Neutral phase: no elemental effects. Cycle: neutral -> fire -> neutral -> ice -> neutral -> lightning -> repeat. Total cycle is 30 seconds.',
        placement: 'Global effect -- entire map.',
        visual:
          'During fire phase: floor tints red-orange, ember particles rise. During ice phase: floor tints blue-white, frost particles fall. During lightning phase: floor tints yellow, spark particles zip around. Transition between phases has a brief chromatic sweep effect across the screen. A UI indicator shows current/upcoming phase.',
      },
    ],
    enemySpawnWeights: [
      { type: 'rusher', weight: 15 },
      { type: 'swarm', weight: 15 },
      { type: 'tank', weight: 15 },
      { type: 'sniper', weight: 15 },
      { type: 'flanker', weight: 15 },
      { type: 'splitter', weight: 15 },
      { type: 'shielder', weight: 10 },
    ],
    ambientParticles:
      'Multi-colored particles that shift hue over time. Medium density. Each particle cycles through magenta, cyan, and yellow over its lifetime. Creates a "living rainbow" background noise.',
    visualGimmick:
      'Grid lines cycle through all accent colors from other zones over a 10-second period. Wall color shifts hue subtly. The entire zone has a chromatic aberration effect at screen edges -- red/green/blue channels slightly offset.',
    gameplayImpact:
      'The elemental cycle forces players to adapt their play style every few seconds. During fire phase: keep moving to minimize burn exposure. During ice phase: reposition carefully since everything is slowed (good time to line up big damage). During lightning phase: spread out and avoid standing still (random strikes are less likely to hit moving targets). Players who build all three resistances are rewarded. The balanced enemy composition means no single strategy dominates -- players face every enemy behavior simultaneously. This is the "final exam" zone that tests mastery of all mechanics.',
    mapSize: {
      t1Width: 90,
      t1Height: 55,
      t5Width: 195,
      t5Height: 120,
      layoutNotes:
        'Large maps with a mix of room sizes. Wide corridors. The map should feel spacious to give players room to react to phase changes. Include a few very large arena-like rooms (16x12+) for climactic fights.',
    },
    suggestedMinLevel: 15,
  },

  // =========================================================================
  // 9. RUST HOLLOW
  // =========================================================================
  {
    key: 'rust_hollow',
    name: 'Rust Hollow',
    concept:
      'A decaying mechanical graveyard with narrow corridors and tight rooms. Favors AoE builds that can clear chokepoints.',
    palette: {
      backgroundColor: 0x1a1210,
      gridColor: 0xcc8844,
      gridAlpha: 0.05,
      wallColor: 0x3a2a1a,
      accentColor: 0xcc8844,
      accentColorAlt: 0x886633,
    },
    hazards: [
      {
        id: 'collapsing_corridors',
        name: 'Collapsing Corridors',
        effect:
          'Some corridors collapse after the player passes through, sealing them with rubble. Prevents backtracking and forces forward commitment.',
        mechanics:
          'Corridor segments (3-6 tiles long) are flagged as collapsible. When the player exits a collapsible corridor (crosses a threshold tile), it collapses after a 2-second delay. Collapsed tiles become walls. Enemies inside are killed instantly. Enemies on the other side are stranded (removed after 10 seconds if no path to player). 2-4 collapsible corridors per map.',
        placement:
          'Only in corridors connecting rooms, never inside rooms. Marked with subtle visual cues (cracked ceiling tiles, dust particles). Never blocks the only path to the exit.',
        visual:
          'Cracked/damaged ceiling tiles above the corridor. When collapsing: falling debris particles, screen shake, tiles transition from floor to wall with a brown dust cloud.',
      },
      {
        id: 'rust_cloud',
        name: 'Rust Clouds',
        effect:
          'Stationary clouds of corroded metal particles that reduce armor effectiveness by 30% while standing inside.',
        mechanics:
          'Player armor stat is reduced by 30% while overlapping a rust cloud. Does not affect enemy stats. Clouds are 3-tile radius. 2-3 per map.',
        placement:
          'Placed in larger rooms, often near room centers where fights happen. Never in corridors.',
        visual:
          'Brown-orange haze of slowly swirling particles. Visible at a distance but not opaque -- the player can see through it. Faint metallic glint particles mixed in.',
      },
    ],
    enemySpawnWeights: [
      { type: 'rusher', weight: 25 },
      { type: 'tank', weight: 20 },
      { type: 'shielder', weight: 20 },
      { type: 'swarm', weight: 15 },
      { type: 'sniper', weight: 10 },
      { type: 'flanker', weight: 5 },
      { type: 'splitter', weight: 5 },
    ],
    ambientParticles:
      'Falling rust flake particles (tiny brown-orange rectangles) drifting downward slowly. Occasional metallic glint spark. Low-to-medium density.',
    visualGimmick:
      'Walls have a corroded, pitted texture with irregular darker patches. Some wall tiles have visible rivets or bolts drawn as small circles. The grid lines are drawn with a rough, uneven stroke weight that varies tile-to-tile.',
    gameplayImpact:
      'Tight corridors funnel enemies into lines, making pierce and AoE extremely effective. Collapsing corridors create "one-way" commitment -- once the player enters a new area, they cannot retreat. This forces aggressive play and prevents safe kiting loops. Rust clouds in fight rooms reduce the player armor, making them take more damage if they stand and fight in the center (push toward room edges). Tank and shielder-heavy spawns create wall-like formations in narrow corridors that must be broken through. Rangers benefit enormously from pierce in corridors. Mages benefit from AoE in the tight rooms.',
    mapSize: {
      t1Width: 70,
      t1Height: 45,
      t5Width: 160,
      t5Height: 95,
      layoutNotes:
        'Small, claustrophobic maps. Many small rooms (6-8 tile wide) connected by long, narrow corridors. Corridors should be the standard 3-tile width but longer than usual. Dead ends are acceptable and add tension. Room doors should be single-width where possible to create chokepoints.',
    },
    suggestedMinLevel: 8,
  },

  // =========================================================================
  // 10. SIGNAL SPIRE
  // =========================================================================
  {
    key: 'signal_spire',
    name: 'Signal Spire',
    concept:
      'A vertical transmission tower with wide-open arenas connected by catwalks. Long sightlines favor ranged combat and kiting.',
    palette: {
      backgroundColor: 0x0a0a20,
      gridColor: 0x6688ff,
      gridAlpha: 0.07,
      wallColor: 0x1a1a40,
      accentColor: 0x6688ff,
      accentColorAlt: 0x44aaff,
    },
    hazards: [
      {
        id: 'signal_beam',
        name: 'Signal Beams',
        effect:
          'Horizontal and vertical energy beams that sweep across rooms on a fixed pattern. Pass through walls but are blocked by entities.',
        mechanics:
          'Each beam sweeps across a room in one direction over 3 seconds. Beam width is 1 tile. Contact deals 10% max HP as lightning damage. Beams telegraph their path 1.5 seconds before sweeping (faint guideline appears). Beams repeat every 8 seconds. Shielders block beams for anything behind them.',
        placement:
          'Placed in large arena rooms only. 1-2 beams per large room, oriented horizontally or vertically. Never in corridors or small rooms.',
        visual:
          'Telegraph: faint blue dashed line across the room. Active beam: bright blue-white energy line with glow, scrolling texture effect along its length. Brief flash on entities hit.',
      },
      {
        id: 'amplifier_nodes',
        name: 'Amplifier Nodes',
        effect:
          'Pillars in arena rooms that boost player projectile damage by 15% when projectiles pass through them. Also boosts enemy projectiles.',
        mechanics:
          'Any projectile (player or enemy) passing through an amplifier node gains +15% damage. Multiple nodes stack. Nodes are indestructible. 1-2 per large room.',
        placement:
          'Centered in large arena rooms or at corridor entrances into arenas.',
        visual:
          'Blue glowing pillar graphic (2x2 tile footprint, passable for entities but acts as a buff zone for projectiles). Pulsing blue ring particle effect around the base.',
      },
    ],
    enemySpawnWeights: [
      { type: 'sniper', weight: 30 },
      { type: 'flanker', weight: 20 },
      { type: 'rusher', weight: 15 },
      { type: 'shielder', weight: 15 },
      { type: 'swarm', weight: 10 },
      { type: 'tank', weight: 5 },
      { type: 'splitter', weight: 5 },
    ],
    ambientParticles:
      'Horizontal streaks of blue light particles moving quickly across the screen (like data streams). Medium density. Occasional vertical pulse of light traveling upward.',
    visualGimmick:
      'The grid pattern uses thicker lines at regular intervals (every 8 tiles) creating a "structural beam" pattern. Walls have a metallic blue-gray sheen with visible panel seams. The background has faint vertical scan lines scrolling upward.',
    gameplayImpact:
      'Large open arenas with long sightlines mean snipers are extremely dangerous and effective. The player must use amplifier nodes to boost their own damage while being aware enemies benefit too. Signal beams force periodic repositioning during fights -- the player cannot camp one spot. Shielders blocking beams creates interesting tactical decisions (stand behind a shielder to avoid a beam, but then you cannot damage it). Sniper-heavy spawns demand aggressive flanking or superior range. The open rooms with minimal cover make this a "glass cannon" zone where damage output wins.',
    mapSize: {
      t1Width: 95,
      t1Height: 50,
      t5Width: 200,
      t5Height: 110,
      layoutNotes:
        'Wide, horizontally-oriented maps. A few very large arena rooms (16-20 tiles wide, 10-14 tall) connected by straight, wide catwalks (4-5 tile wide corridors). Minimal room count but large room size. Open floor plans with very few internal walls.',
    },
    suggestedMinLevel: 12,
  },

  // =========================================================================
  // 11. MEMORY LEAK
  // =========================================================================
  {
    key: 'memory_leak',
    name: 'Memory Leak',
    concept:
      'A glitching digital space where the map itself is unstable. Rooms shift, tiles flicker, and enemies can teleport. Chaos and adaptation.',
    palette: {
      backgroundColor: 0x0f0a1a,
      gridColor: 0xaa44ff,
      gridAlpha: 0.05,
      wallColor: 0x201830,
      accentColor: 0xaa44ff,
      accentColorAlt: 0xff4488,
    },
    hazards: [
      {
        id: 'glitch_tiles',
        name: 'Glitch Tiles',
        effect:
          'Floor tiles that randomly toggle between floor and wall every 8-12 seconds. Creates a constantly shifting maze.',
        mechanics:
          'Each glitch tile has an independent timer (8-12 second random interval). When it toggles to wall, any entity standing on it is pushed to the nearest valid floor tile. Glitch tiles are distributed across 10-15% of floor tiles. They telegraph 1 second before toggling (rapid flickering visual).',
        placement:
          'Scattered throughout rooms and corridors. Never placed on the spawn tile or within 2 tiles of it. Denser in later rooms (further from spawn).',
        visual:
          'Glitch tiles have a noisy, static-y appearance -- pixel noise overlaid on the normal floor color. They shift between purple and pink hues rapidly. Toggle telegraph: tile flickers between floor and wall appearance at 10Hz for 1 second.',
      },
      {
        id: 'warp_pads',
        name: 'Warp Pads',
        effect:
          'Paired teleportation tiles. Stepping on one instantly moves the entity to the linked pad. Both player and enemies can use them.',
        mechanics:
          'Each warp pad is linked to exactly one other pad. Teleportation is instant with a 2-second cooldown per entity (prevents infinite loops). 2-4 linked pairs per map. Enemies can pathfind through warp pads if it shortens their path to the player.',
        placement:
          'Linked pads are placed in different rooms (never in the same room). One pad in a room entrance, the linked pad in a distant room. Creates shortcuts but also allows enemies to ambush from unexpected directions.',
        visual:
          'Glowing purple circle on the floor (2-tile diameter) with swirling particle vortex. Linked pads pulse in sync. Teleportation creates a brief purple flash and afterimage at the departure point.',
      },
    ],
    enemySpawnWeights: [
      { type: 'flanker', weight: 25 },
      { type: 'splitter', weight: 20 },
      { type: 'swarm', weight: 20 },
      { type: 'rusher', weight: 15 },
      { type: 'sniper', weight: 10 },
      { type: 'tank', weight: 5 },
      { type: 'shielder', weight: 5 },
    ],
    ambientParticles:
      'Glitchy particles that teleport short distances (appear, vanish, reappear 3-5 tiles away). Mixed purple and pink. Medium density. Occasional horizontal "scan line" particle that sweeps across the screen.',
    visualGimmick:
      'The entire visual presentation has intentional glitch effects: occasional horizontal pixel-shift on random tile rows, brief color inversions on individual tiles, and the grid lines have random gaps and double-draws as if the rendering is corrupted.',
    gameplayImpact:
      'Glitch tiles make the map layout unpredictable -- a safe corridor might seal up, and a wall might open a new path. Players must constantly re-evaluate their escape routes. Warp pads create non-linear navigation where enemies can appear from unexpected directions. The player can also use warp pads strategically to escape or reposition across the map. Flanker and splitter heavy spawns compound the chaos. This zone rewards adaptive, improvisational play over planned strategies. Every run through the zone feels different because the layout keeps shifting.',
    mapSize: {
      t1Width: 85,
      t1Height: 50,
      t5Width: 185,
      t5Height: 110,
      layoutNotes:
        'Standard room and corridor sizes. The "instability" comes from glitch tiles, not map shape. Medium rooms with 2-3 exits each. Corridors should have some width variance (some 3-tile, some 4-5 tile) to create interesting glitch tile interactions.',
    },
    suggestedMinLevel: 15,
  },

  // =========================================================================
  // 12. NULL SECTOR
  // =========================================================================
  {
    key: 'null_sector',
    name: 'Null Sector',
    concept:
      'The endgame zone. A featureless void where the rules break down. Enemies hit harder, spawn faster, and the player has fewer resources. Pure skill test.',
    palette: {
      backgroundColor: 0x020202,
      gridColor: 0x333333,
      gridAlpha: 0.03,
      wallColor: 0x0a0a0a,
      accentColor: 0xffffff,
      accentColorAlt: 0x888888,
      enemyTintMultiplier: 0.8,
    },
    hazards: [
      {
        id: 'entropy_drain',
        name: 'Entropy Drain',
        effect:
          'Passive resource pressure: the player loses 1% max HP per second as a constant drain. Health regeneration and potions still work but must outpace the drain.',
        mechanics:
          'Flat 1% max HP per second drain, applied as a tick every 0.5 seconds. Cannot kill the player (stops at 1 HP). Not reduced by resistances. Health regen and potion HoT work normally against it. Forces a time pressure -- the player cannot idle or explore slowly.',
        placement: 'Global effect -- entire map.',
        visual:
          'Subtle red vignette at screen edges that pulses with each drain tick. The player health bar has a faint red decay animation at the edge showing the drain rate.',
      },
      {
        id: 'null_zones',
        name: 'Null Zones',
        effect:
          'Zones where skill cooldowns do not tick. Skills on cooldown freeze their timer while the player is inside a null zone.',
        mechanics:
          'Skill cooldown reduction pauses entirely inside null zones. Active skill effects (like Rain of Arrows already in the air) still resolve. Affects all 4 skill slots. 15-20% of floor tiles are null zones.',
        placement:
          'Placed in room centers and key corridor junctions. Often overlapping with where enemies spawn. The spawn room has a small null-zone-free area.',
        visual:
          'Floor tiles are completely black (even darker than the background). No grid lines visible. A faint static noise overlay on affected tiles. The boundary has a hard edge, no gradient.',
      },
    ],
    enemySpawnWeights: [
      { type: 'rusher', weight: 20 },
      { type: 'flanker', weight: 20 },
      { type: 'sniper', weight: 15 },
      { type: 'shielder', weight: 15 },
      { type: 'tank', weight: 10 },
      { type: 'splitter', weight: 10 },
      { type: 'swarm', weight: 10 },
    ],
    ambientParticles:
      'Almost none. Rare single white pixel particles that appear and vanish instantly, like dead pixels on a screen. The emptiness is the aesthetic.',
    visualGimmick:
      'The zone is intentionally barren and monochrome. No color except what the player and enemies bring. Enemy shapes are rendered in stark white outlines against the void. The grid is barely visible. The effect is minimalist and oppressive -- a digital wasteland where all decoration has been stripped away.',
    gameplayImpact:
      'Entropy drain creates urgency -- the player must keep killing and keep moving. Standing still to regenerate does not work because the drain outpaces natural regen. Null zones disable cooldowns, meaning the player must fight with basic attacks in those areas or avoid them. This creates a risk-reward dynamic: null zones are where enemies tend to cluster (enemies spawn in rooms, rooms have null zones), so the player must engage without skills or pull enemies out. Balanced enemy composition with a lean toward aggressive types (rushers, flankers, snipers) means constant pressure. This is the ultimate test zone for endgame players who have mastered all other zones. High Vitality and health regen become essential to offset the drain.',
    mapSize: {
      t1Width: 85,
      t1Height: 50,
      t5Width: 185,
      t5Height: 110,
      layoutNotes:
        'Standard map dimensions. Clean, geometric room shapes (rectangles and squares). Wide corridors. The simplicity of the layout is intentional -- there is nothing to hide behind, no clever terrain to exploit. The difficulty comes from the mechanics, not the geometry.',
    },
    suggestedMinLevel: 20,
  },
];
