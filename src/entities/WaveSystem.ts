import { Text, TextStyle } from 'pixi.js';
import { world } from '../ecs/world';
import { game } from '../Game';
import { Fonts, FontSize } from '../ui/UITheme';
import { spawnRusher, spawnSwarm, spawnTank, spawnSniper, spawnFlanker, spawnSplitter, spawnShielder, spawnBomber, spawnCharger, spawnPulsar, spawnMirror, spawnPhaser, spawnBurrower, spawnWarper, spawnLeech, spawnVortex, spawnHealer, spawnSpawner, spawnLobber, spawnSwooper, spawnTrapper, spawnLinker, spawnMimic, spawnNecromancer, spawnOvercharger } from './Enemy';
import { spawnBoss } from './Boss';
import { getBossForZone } from './BossRegistry';
import { getMonsterLevel } from '../core/MonsterScaling';
import { autoSave } from '../save/SaveManager';
import { hasModifier, getQuantityBonus, isMapActive, getActiveTierBonus } from '../core/MapDevice';
import { getActiveThemeKey } from '../core/ZoneThemes';
import { enterTown, isInTown } from '../core/TownManager';
import { musicPlayer, getZoneTrack } from '../audio/MusicPlayer';
import { WAVE_DESIGNS } from '../../designs/waves';
import type { SpawnAnchor, SpawnGroup, SpawnTiming, WaveDesign, DifficultyTier, EnemyType } from '../../designs/waves';
import { ZONE_DESIGNS } from '../../designs/zones';
import type { EnemySpawnWeight } from '../../designs/zones';

const MIN_PLAYER_DIST = 200;
const SURROUND_DIST = 400;
const STAGGER_DELAY = 0.3; // seconds between staggered spawns
const WAVE_DELAY = 5; // seconds after all enemies dead before next wave
const WAVE_TEXT_DURATION = 2; // seconds the "Wave X" text is visible
const TILE_SIZE = 32;

type EnemySpawnFn = (x: number, y: number, monsterLevel?: number) => void;

type EnemyTypeExtended = EnemyType | 'bomber' | 'charger' | 'pulsar' | 'mirror' | 'phaser' | 'burrower' | 'warper' | 'leech' | 'vortex' | 'healer' | 'spawner' | 'lobber' | 'swooper' | 'trapper' | 'linker' | 'mimic' | 'necromancer' | 'overcharger';

type SpawnEntry = {
  type: EnemyTypeExtended;
  x: number;
  y: number;
};

const SPAWN_FNS: Record<EnemyTypeExtended, EnemySpawnFn> = {
  rusher: spawnRusher,
  swarm: spawnSwarm,
  tank: spawnTank,
  sniper: spawnSniper,
  flanker: spawnFlanker,
  splitter: spawnSplitter,
  shielder: spawnShielder,
  bomber: spawnBomber,
  charger: spawnCharger,
  pulsar: spawnPulsar,
  mirror: spawnMirror,
  phaser: spawnPhaser,
  burrower: spawnBurrower,
  warper: spawnWarper,
  leech: spawnLeech,
  vortex: spawnVortex,
  healer: spawnHealer,
  spawner: spawnSpawner,
  lobber: spawnLobber,
  swooper: spawnSwooper,
  trapper: spawnTrapper,
  linker: spawnLinker,
  mimic: spawnMimic,
  necromancer: spawnNecromancer,
  overcharger: spawnOvercharger,
};

// =========================================================================
// Zone-specific enemy spawn weights
// =========================================================================

/** Build a lookup from zone key to spawn weight array. */
const ZONE_SPAWN_WEIGHTS: Record<string, EnemySpawnWeight[]> = {};
for (const zone of ZONE_DESIGNS) {
  ZONE_SPAWN_WEIGHTS[zone.key] = zone.enemySpawnWeights;
}

/** Default balanced weights used when no zone-specific weights exist. */
const DEFAULT_SPAWN_WEIGHTS: EnemySpawnWeight[] = [
  { type: 'rusher', weight: 20 },
  { type: 'swarm', weight: 20 },
  { type: 'tank', weight: 15 },
  { type: 'sniper', weight: 15 },
  { type: 'flanker', weight: 15 },
  { type: 'splitter', weight: 10 },
  { type: 'shielder', weight: 5 },
];

/** Get spawn weights for the currently active zone, with fallback. */
function getZoneSpawnWeights(): EnemySpawnWeight[] {
  const themeKey = getActiveThemeKey();
  return ZONE_SPAWN_WEIGHTS[themeKey] ?? DEFAULT_SPAWN_WEIGHTS;
}

/**
 * Pick an enemy type using zone-specific weighted random selection.
 * Only covers the 7 base types from zone designs.
 */
function pickWeightedEnemyType(weights: EnemySpawnWeight[]): EnemyType {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.type;
  }
  return weights[weights.length - 1].type;
}

// =========================================================================
// Legacy formation types (backward compat for PREDEFINED_WAVES)
// =========================================================================

type FormationType = 'column' | 'pincer' | 'surround' | 'shieldWall' | 'chaoticSwarm';

interface LegacyWaveDefinition {
  enemies: { type: EnemyTypeExtended; count: number }[];
  formation: FormationType;
}

/** Waves 1-5 use the original simple format, converted at runtime. */
const PREDEFINED_WAVES: LegacyWaveDefinition[] = [
  // Wave 1: tutorial
  { enemies: [{ type: 'rusher', count: 5 }], formation: 'column' },
  // Wave 2
  { enemies: [{ type: 'swarm', count: 8 }], formation: 'chaoticSwarm' },
  // Wave 3: introduce Splitters
  { enemies: [{ type: 'rusher', count: 3 }, { type: 'tank', count: 1 }, { type: 'splitter', count: 2 }], formation: 'shieldWall' },
  // Wave 4: introduce Shielders + Bombers
  { enemies: [{ type: 'rusher', count: 3 }, { type: 'flanker', count: 2 }, { type: 'shielder', count: 1 }, { type: 'bomber', count: 2 }], formation: 'pincer' },
  // Wave 5: introduce Chargers
  { enemies: [{ type: 'swarm', count: 4 }, { type: 'sniper', count: 2 }, { type: 'tank', count: 1 }, { type: 'splitter', count: 1 }, { type: 'charger', count: 1 }], formation: 'surround' },
];

const ALL_FORMATIONS: FormationType[] = ['column', 'pincer', 'surround', 'shieldWall', 'chaoticSwarm'];

// =========================================================================
// Utility functions
// =========================================================================

function getPlayerPos(): { x: number; y: number } | null {
  const players = world.with('player', 'position');
  const p = players.entities[0];
  return p ? { x: p.position.x, y: p.position.y } : null;
}

function findSpawnPosition(px: number, py: number, maxAttempts = 20): { x: number; y: number } | null {
  for (let i = 0; i < maxAttempts; i++) {
    const tile = game.tileMap.getRandomFloorTile();
    const pos = game.tileMap.tileToWorld(tile.x, tile.y);
    const dx = pos.x - px;
    const dy = pos.y - py;
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_PLAYER_DIST) {
      return pos;
    }
  }
  return null;
}

/** Find a floor tile near (targetX, targetY), snapping to nearest floor.
 *  Optionally enforces a minimum distance from (avoidX, avoidY). */
function findNearestFloor(targetX: number, targetY: number, avoidX?: number, avoidY?: number): { x: number; y: number } {
  const tilePosTarget = game.tileMap.worldToTile(targetX, targetY);
  // Search in expanding rings
  for (let radius = 0; radius < 20; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const tx = tilePosTarget.x + dx;
        const ty = tilePosTarget.y + dy;
        if (!game.tileMap.blocksMovement(tx, ty)) {
          const pos = game.tileMap.tileToWorld(tx, ty);
          // Enforce minimum distance from player if specified
          if (avoidX !== undefined && avoidY !== undefined) {
            const adx = pos.x - avoidX;
            const ady = pos.y - avoidY;
            if (Math.sqrt(adx * adx + ady * ady) < MIN_PLAYER_DIST) continue;
          }
          return pos;
        }
      }
    }
  }
  // Fallback: random floor away from player
  return findSpawnPosition(avoidX ?? targetX, avoidY ?? targetY)
    ?? game.tileMap.tileToWorld(...Object.values(game.tileMap.getRandomFloorTile()) as [number, number]);
}

// =========================================================================
// Legacy formation placement generators (used by PREDEFINED_WAVES)
// =========================================================================

function buildColumnSpawns(entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  const angle = Math.random() * Math.PI * 2;
  const startX = px + Math.cos(angle) * SURROUND_DIST;
  const startY = py + Math.sin(angle) * SURROUND_DIST;
  const perpX = -Math.sin(angle) * 32;
  const perpY = Math.cos(angle) * 32;

  return entries.map((type, i) => {
    const pos = findNearestFloor(startX + perpX * (i - entries.length / 2), startY + perpY * (i - entries.length / 2), px, py);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildPincerSpawns(entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  const half = Math.ceil(entries.length / 2);
  const group1 = entries.slice(0, half);
  const group2 = entries.slice(half);
  const angle = Math.random() * Math.PI * 2;

  const result: SpawnEntry[] = [];
  group1.forEach((type, i) => {
    const spread = (i - group1.length / 2) * 32;
    const pos = findNearestFloor(
      px + Math.cos(angle) * SURROUND_DIST + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * SURROUND_DIST + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  group2.forEach((type, i) => {
    const spread = (i - group2.length / 2) * 32;
    const pos = findNearestFloor(
      px + Math.cos(angle + Math.PI) * SURROUND_DIST + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle + Math.PI) * SURROUND_DIST + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  return result;
}

function buildSurroundSpawns(entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  const step = (Math.PI * 2) / entries.length;
  const offset = Math.random() * Math.PI * 2;
  return entries.map((type, i) => {
    const a = offset + step * i;
    const pos = findNearestFloor(px + Math.cos(a) * SURROUND_DIST, py + Math.sin(a) * SURROUND_DIST, px, py);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildShieldWallSpawns(entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  const tanks = entries.filter(t => t === 'tank');
  const others = entries.filter(t => t !== 'tank');

  const angle = Math.random() * Math.PI * 2;
  const result: SpawnEntry[] = [];

  tanks.forEach((type, i) => {
    const spread = (i - tanks.length / 2) * 48;
    const pos = findNearestFloor(
      px + Math.cos(angle) * (SURROUND_DIST - 40) + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * (SURROUND_DIST - 40) + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  others.forEach((type, i) => {
    const spread = (i - others.length / 2) * 40;
    const pos = findNearestFloor(
      px + Math.cos(angle) * (SURROUND_DIST + 40) + Math.cos(angle + Math.PI / 2) * spread,
      py + Math.sin(angle) * (SURROUND_DIST + 40) + Math.sin(angle + Math.PI / 2) * spread,
      px, py,
    );
    result.push({ type, x: pos.x, y: pos.y });
  });
  return result;
}

function buildChaoticSwarmSpawns(entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  return entries.map(type => {
    const pos = findSpawnPosition(px, py) ?? findNearestFloor(px + (Math.random() - 0.5) * 600, py + (Math.random() - 0.5) * 600);
    return { type, x: pos.x, y: pos.y };
  });
}

function buildLegacySpawns(formation: FormationType, entries: EnemyTypeExtended[], px: number, py: number): SpawnEntry[] {
  switch (formation) {
    case 'column': return buildColumnSpawns(entries, px, py);
    case 'pincer': return buildPincerSpawns(entries, px, py);
    case 'surround': return buildSurroundSpawns(entries, px, py);
    case 'shieldWall': return buildShieldWallSpawns(entries, px, py);
    case 'chaoticSwarm': return buildChaoticSwarmSpawns(entries, px, py);
  }
}

// =========================================================================
// New data-driven spawn anchor resolution
// =========================================================================

/** Find the room the player is currently in, or the closest room. */
function getPlayerRoom(px: number, py: number): { x1: number; y1: number; x2: number; y2: number } {
  const rooms = game.tileMap.rooms;
  const ptx = Math.floor(px / TILE_SIZE);
  const pty = Math.floor(py / TILE_SIZE);

  // Check if player is inside a room
  for (const room of rooms) {
    if (ptx >= room.x1 && ptx <= room.x2 && pty >= room.y1 && pty <= room.y2) {
      return room;
    }
  }

  // Find closest room center
  let best = rooms[0];
  let bestDist = Infinity;
  for (const room of rooms) {
    const cx = (room.x1 + room.x2) / 2;
    const cy = (room.y1 + room.y2) / 2;
    const d = (cx - ptx) ** 2 + (cy - pty) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = room;
    }
  }
  return best;
}

/** Resolve a SpawnAnchor to a world-space (x, y) coordinate. */
function resolveAnchor(
  anchor: SpawnAnchor,
  px: number,
  py: number,
  baseAngle: number,
): { x: number; y: number } {
  if (anchor.kind === 'relative_to_player') {
    // Apply the design angle offset plus a random base rotation
    const angle = baseAngle + anchor.angle;
    const worldX = px + Math.cos(angle) * anchor.distance;
    const worldY = py + Math.sin(angle) * anchor.distance;
    return findNearestFloor(worldX, worldY, px, py);
  }

  // room_geometry: use the player's current room
  const room = getPlayerRoom(px, py);
  const roomCx = ((room.x1 + room.x2) / 2) * TILE_SIZE + TILE_SIZE / 2;
  const roomCy = ((room.y1 + room.y2) / 2) * TILE_SIZE + TILE_SIZE / 2;

  switch (anchor.location) {
    case 'center':
      return findNearestFloor(roomCx, roomCy, px, py);

    case 'entrance': {
      // Use the room edge closest to the dungeon spawn point
      const spawnWorld = game.tileMap.tileToWorld(game.tileMap.spawn.x, game.tileMap.spawn.y);
      const dx = spawnWorld.x - roomCx;
      const dy = spawnWorld.y - roomCy;
      const angle = Math.atan2(dy, dx);
      const edgeX = roomCx + Math.cos(angle) * ((room.x2 - room.x1) / 2) * TILE_SIZE;
      const edgeY = roomCy + Math.sin(angle) * ((room.y2 - room.y1) / 2) * TILE_SIZE;
      return findNearestFloor(edgeX, edgeY, px, py);
    }

    case 'exit': {
      // Opposite of entrance: edge away from dungeon spawn
      const spawnWorld = game.tileMap.tileToWorld(game.tileMap.spawn.x, game.tileMap.spawn.y);
      const dx = spawnWorld.x - roomCx;
      const dy = spawnWorld.y - roomCy;
      const angle = Math.atan2(dy, dx) + Math.PI;
      const edgeX = roomCx + Math.cos(angle) * ((room.x2 - room.x1) / 2) * TILE_SIZE;
      const edgeY = roomCy + Math.sin(angle) * ((room.y2 - room.y1) / 2) * TILE_SIZE;
      return findNearestFloor(edgeX, edgeY, px, py);
    }

    case 'corners': {
      // Pick a random corner of the room
      const corners = [
        { x: room.x1, y: room.y1 },
        { x: room.x2, y: room.y1 },
        { x: room.x1, y: room.y2 },
        { x: room.x2, y: room.y2 },
      ];
      const corner = corners[Math.floor(Math.random() * corners.length)];
      return findNearestFloor(
        corner.x * TILE_SIZE + TILE_SIZE / 2,
        corner.y * TILE_SIZE + TILE_SIZE / 2,
        px, py,
      );
    }

    case 'corridors': {
      // Find a floor tile that is outside any room (i.e., corridor)
      for (let attempt = 0; attempt < 40; attempt++) {
        const tile = game.tileMap.getRandomFloorTile();
        let inRoom = false;
        for (const r of game.tileMap.rooms) {
          if (tile.x >= r.x1 && tile.x <= r.x2 && tile.y >= r.y1 && tile.y <= r.y2) {
            inRoom = true;
            break;
          }
        }
        if (!inRoom) {
          const pos = game.tileMap.tileToWorld(tile.x, tile.y);
          const adx = pos.x - px;
          const ady = pos.y - py;
          if (Math.sqrt(adx * adx + ady * ady) >= MIN_PLAYER_DIST) {
            return pos;
          }
        }
      }
      // Fallback: any floor tile away from player
      return findSpawnPosition(px, py) ?? findNearestFloor(px + SURROUND_DIST, py);
    }
  }
}

/** Arrange enemies around an anchor point using a spread pattern. */
function arrangeGroup(
  types: EnemyTypeExtended[],
  anchorPos: { x: number; y: number },
  spread: SpawnGroup['spread'],
  px: number,
  py: number,
): SpawnEntry[] {
  const count = types.length;
  if (count === 0) return [];
  if (count === 1) {
    return [{ type: types[0], x: anchorPos.x, y: anchorPos.y }];
  }

  const SPREAD_RADIUS = 40; // base spread between enemies

  switch (spread) {
    case 'cluster': {
      return types.map((type) => {
        const ox = (Math.random() - 0.5) * SPREAD_RADIUS * 2;
        const oy = (Math.random() - 0.5) * SPREAD_RADIUS * 2;
        const pos = findNearestFloor(anchorPos.x + ox, anchorPos.y + oy);
        return { type, x: pos.x, y: pos.y };
      });
    }

    case 'line': {
      const angle = Math.atan2(anchorPos.y - py, anchorPos.x - px) + Math.PI / 2;
      return types.map((type, i) => {
        const offset = (i - (count - 1) / 2) * SPREAD_RADIUS;
        const pos = findNearestFloor(
          anchorPos.x + Math.cos(angle) * offset,
          anchorPos.y + Math.sin(angle) * offset,
        );
        return { type, x: pos.x, y: pos.y };
      });
    }

    case 'arc': {
      const baseAngle = Math.atan2(py - anchorPos.y, px - anchorPos.x);
      const arcSpan = Math.min(Math.PI, count * 0.3);
      return types.map((type, i) => {
        const a = baseAngle - arcSpan / 2 + (arcSpan / Math.max(1, count - 1)) * i;
        const pos = findNearestFloor(
          anchorPos.x + Math.cos(a) * SPREAD_RADIUS * 2,
          anchorPos.y + Math.sin(a) * SPREAD_RADIUS * 2,
        );
        return { type, x: pos.x, y: pos.y };
      });
    }

    case 'ring': {
      const step = (Math.PI * 2) / count;
      const offset = Math.random() * Math.PI * 2;
      return types.map((type, i) => {
        const a = offset + step * i;
        const pos = findNearestFloor(
          anchorPos.x + Math.cos(a) * SPREAD_RADIUS * 2.5,
          anchorPos.y + Math.sin(a) * SPREAD_RADIUS * 2.5,
        );
        return { type, x: pos.x, y: pos.y };
      });
    }

    case 'scattered': {
      return types.map((type) => {
        const a = Math.random() * Math.PI * 2;
        const r = SPREAD_RADIUS + Math.random() * SPREAD_RADIUS * 3;
        const pos = findNearestFloor(anchorPos.x + Math.cos(a) * r, anchorPos.y + Math.sin(a) * r);
        return { type, x: pos.x, y: pos.y };
      });
    }
  }
}

// =========================================================================
// Runtime group state for multi-group wave management
// =========================================================================

interface ActiveGroup {
  groupDef: SpawnGroup;
  /** Enemies queued for staggered spawning within this group. */
  pendingSpawns: SpawnEntry[];
  /** Timer for staggered individual spawn delay. */
  spawnTimer: number;
  /** Whether this group has been activated (spawning started). */
  activated: boolean;
  /** Timer tracking how long since wave started (for time_elapsed triggers). */
  elapsedSinceActivation: number;
  /** IDs of entities spawned by this group (for health_threshold tracking). */
  spawnedEntityIds: number[];
}

// =========================================================================
// Wave selection and generation
// =========================================================================

/** Map wave number to expected difficulty tier for WaveDesign selection.
 *  Waves 1-5 use legacy predefined waves, so this is primarily for wave 6+.
 *  Waves 6-8: early-tier designed formations
 *  Waves 9, 11-14: mid-tier (wave 10 is boss, intercepted separately)
 *  Waves 16-19, 21-24...: late-tier
 *  Every 5th wave: boss (intercepted by spawnBossWave before reaching here)
 */
function getDifficultyTier(waveNum: number): DifficultyTier {
  if (waveNum % 5 === 0) return 'boss';
  if (waveNum <= 8) return 'early';
  if (waveNum <= 14) return 'mid';
  return 'late';
}

/** Select a WaveDesign from the pool matching the given tier. */
function selectWaveDesign(waveNum: number): WaveDesign | null {
  const tier = getDifficultyTier(waveNum);
  const candidates = WAVE_DESIGNS.filter(d => d.difficulty === tier);
  if (candidates.length === 0) return null;
  // Use wave number as seed-like index so the same wave always picks the same design
  // but still cycles through all available designs
  return candidates[waveNum % candidates.length];
}

/** Dynamically generate a WaveDesign for waves beyond what the design pool covers. */
function generateDynamicWave(waveNum: number): WaveDesign {
  const scaleFactor = Math.pow(1.2, waveNum - 5);
  const baseCount = 7;
  const totalEnemies = Math.round(baseCount * scaleFactor);

  // Extended enemy types unlocked at later waves (sprinkled in alongside zone-weighted base types)
  const extendedTypes: EnemyTypeExtended[] = ['bomber', 'charger', 'pulsar', 'mirror', 'phaser', 'burrower', 'warper', 'leech', 'vortex', 'healer', 'spawner', 'lobber', 'swooper', 'trapper', 'linker', 'mimic', 'necromancer', 'overcharger'];
  const zoneWeights = getZoneSpawnWeights();
  const enemies: { type: EnemyType; count: number }[] = [];

  let remaining = totalEnemies;
  if (waveNum >= 7) {
    const tankCount = Math.min(Math.floor((waveNum - 5) / 2), 3);
    enemies.push({ type: 'tank', count: tankCount });
    remaining -= tankCount;
  }

  while (remaining > 0) {
    // ~20% chance to pick an extended enemy type for variety (wave 8+)
    let type: EnemyTypeExtended;
    if (waveNum >= 8 && Math.random() < 0.2) {
      type = extendedTypes[Math.floor(Math.random() * extendedTypes.length)];
    } else {
      // Use zone-specific weighted selection for the 7 base types
      type = pickWeightedEnemyType(zoneWeights);
    }
    const count = Math.min(remaining, 1 + Math.floor(Math.random() * 3));
    const existing = enemies.find(e => e.type === type);
    if (existing) {
      existing.count += count;
    } else {
      enemies.push({ type: type as EnemyType, count });
    }
    remaining -= count;
  }

  const spreads: SpawnGroup['spread'][] = ['cluster', 'line', 'arc', 'ring', 'scattered'];
  const spread = spreads[Math.floor(Math.random() * spreads.length)];

  return {
    name: `Dynamic Wave ${waveNum}`,
    difficulty: getDifficultyTier(waveNum),
    totalEnemies,
    groups: [{
      id: 'main',
      enemies,
      anchor: { kind: 'relative_to_player', angle: 0, distance: SURROUND_DIST },
      spread,
      timing: { kind: 'immediate' },
    }],
    tacticalChallenge: '',
    rangerStrategy: '',
    mageStrategy: '',
  };
}

/** Apply map modifiers and zone theme adjustments to enemy counts. */
function applyModifiers(enemies: { type: EnemyType; count: number }[]): { type: EnemyType; count: number }[] {
  const modified = enemies.map(e => ({ ...e }));

  // Extra swarm modifier: +50% swarm enemies
  if (hasModifier('extra_swarm')) {
    for (const entry of modified) {
      if (entry.type === 'swarm') {
        entry.count = Math.round(entry.count * 1.5);
      }
    }
  }

  // Quantity bonus: spawn more enemies overall
  const qtyBonus = getQuantityBonus();
  if (qtyBonus > 0) {
    for (const entry of modified) {
      entry.count = Math.round(entry.count * (1 + qtyBonus / 100));
    }
  }

  // Zone-specific spawn weight adjustments: boost types with above-average weight,
  // slightly reduce types with below-average weight in this zone.
  const zoneWeights = getZoneSpawnWeights();
  const avgWeight = zoneWeights.reduce((s, w) => s + w.weight, 0) / zoneWeights.length;
  for (const entry of modified) {
    const zw = zoneWeights.find(w => w.type === entry.type);
    if (zw) {
      // Scale count by how far this type's weight deviates from the average.
      // A type with 30 weight in a zone averaging 14.3 gets ~1.2x multiplier.
      // A type with 5 weight gets ~0.9x multiplier. Clamped to [0.8, 1.3].
      const ratio = Math.max(0.8, Math.min(1.3, 0.9 + (zw.weight / avgWeight) * 0.2));
      entry.count = Math.max(1, Math.round(entry.count * ratio));
    }
  }

  return modified;
}

/** Flatten enemy list from {type, count}[] to an array of types. */
function flattenEnemies(enemies: { type: EnemyType; count: number }[]): EnemyTypeExtended[] {
  const result: EnemyTypeExtended[] = [];
  for (const entry of enemies) {
    for (let i = 0; i < entry.count; i++) {
      result.push(entry.type);
    }
  }
  return result;
}

// =========================================================================
// WaveSystem class
// =========================================================================

export class WaveSystem {
  public currentWave = 0;

  private state: 'idle' | 'spawning' | 'active' | 'cooldown' = 'idle';
  private cooldownTimer = 0;
  private currentMonsterLevel = 1;

  // Legacy spawning (waves 1-5)
  private pendingSpawns: SpawnEntry[] = [];
  private spawnTimer = 0;

  // Data-driven multi-group spawning
  private activeGroups: ActiveGroup[] = [];
  private waveElapsedTime = 0;
  private waveKillCount = 0;
  private lastLivingCount = 0;
  private usingDesignedWave = false;

  // HUD text
  private waveText: Text | null = null;
  private waveTextTimer = 0;

  /** Begin the wave sequence (call once after class select). */
  start(): void {
    this.state = 'cooldown';
    this.cooldownTimer = 1; // short initial delay before wave 1
  }

  /** Stop the wave system (used when entering town). */
  stop(): void {
    this.state = 'idle';
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.cooldownTimer = 0;
    this.activeGroups = [];
    this.waveElapsedTime = 0;
    this.waveKillCount = 0;
    this.usingDesignedWave = false;
  }

  /** Main update -- call from fixedUpdate. */
  update(dt: number): void {
    this.updateWaveText(dt);

    // Don't run waves while in town
    if (isInTown()) return;

    switch (this.state) {
      case 'idle':
        break;

      case 'cooldown':
        this.cooldownTimer -= dt;
        if (this.cooldownTimer <= 0) {
          this.beginNextWave();
        }
        break;

      case 'spawning':
        if (this.usingDesignedWave) {
          this.updateDesignedWave(dt);
        } else {
          this.updateLegacySpawning(dt);
        }
        break;

      case 'active':
        if (this.usingDesignedWave) {
          this.updateDesignedWave(dt);
        }
        this.checkWaveComplete();
        break;
    }
  }

  // -- Legacy spawning (waves 1-5) ----------------------------------------

  private updateLegacySpawning(dt: number): void {
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.pendingSpawns.length > 0) {
      const entry = this.pendingSpawns.shift()!;
      SPAWN_FNS[entry.type](entry.x, entry.y, this.currentMonsterLevel);
      this.spawnTimer = STAGGER_DELAY;
    }
    if (this.pendingSpawns.length === 0) {
      this.state = 'active';
    }
  }

  // -- Data-driven wave update --------------------------------------------

  private updateDesignedWave(dt: number): void {
    this.waveElapsedTime += dt;

    // Track kill count by comparing living enemy count
    const currentLiving = this.livingEnemyCount();
    if (currentLiving < this.lastLivingCount) {
      this.waveKillCount += this.lastLivingCount - currentLiving;
    }
    this.lastLivingCount = currentLiving;

    const pPos = getPlayerPos();
    if (!pPos) return;

    let allGroupsDone = true;

    for (const ag of this.activeGroups) {
      // Check if this group should activate
      if (!ag.activated) {
        if (this.shouldActivateGroup(ag)) {
          // Resolve spawn positions now (at activation time, using current player pos)
          const baseAngle = Math.random() * Math.PI * 2;
          const modifiedEnemies = applyModifiers(ag.groupDef.enemies);
          const typeList = flattenEnemies(modifiedEnemies);
          const anchorPos = resolveAnchor(ag.groupDef.anchor, pPos.x, pPos.y, baseAngle);
          ag.pendingSpawns = arrangeGroup(typeList, anchorPos, ag.groupDef.spread, pPos.x, pPos.y);
          ag.activated = true;
          ag.spawnTimer = 0;
        } else {
          allGroupsDone = false;
          continue;
        }
      }

      // Spawn pending enemies with stagger delay
      if (ag.pendingSpawns.length > 0) {
        ag.spawnTimer -= dt;
        if (ag.spawnTimer <= 0) {
          const entry = ag.pendingSpawns.shift()!;
          SPAWN_FNS[entry.type](entry.x, entry.y, this.currentMonsterLevel);
          ag.spawnTimer = STAGGER_DELAY;
          // Update living count after spawning
          this.lastLivingCount = this.livingEnemyCount();
        }
        allGroupsDone = false;
      }
    }

    // Transition to active once all immediate/staggered groups have finished spawning
    // (triggered groups may still be waiting)
    if (this.state === 'spawning') {
      const immediateAndStaggeredDone = this.activeGroups
        .filter(ag => ag.activated)
        .every(ag => ag.pendingSpawns.length === 0);
      if (immediateAndStaggeredDone && this.activeGroups.some(ag => ag.activated)) {
        this.state = 'active';
      }
    }

    // If all groups are done spawning and no pending triggers remain
    if (allGroupsDone) {
      // No more groups to process; wave completion is checked in checkWaveComplete
    }
  }

  private shouldActivateGroup(ag: ActiveGroup): boolean {
    const timing = ag.groupDef.timing;

    switch (timing.kind) {
      case 'immediate':
        return true;

      case 'staggered':
        // Staggered groups activate after their delay from wave start
        return this.waveElapsedTime >= timing.delaySeconds;

      case 'triggered': {
        const trigger = timing.trigger;
        switch (trigger.type) {
          case 'time_elapsed':
            return this.waveElapsedTime >= trigger.seconds;

          case 'enemies_remaining':
            return this.livingEnemyCount() <= trigger.count && this.livingEnemyCount() > 0;

          case 'enemies_killed':
            return this.waveKillCount >= trigger.count;

          case 'health_threshold': {
            // Check if any enemy in the target group is below the HP threshold
            const targetGroup = this.activeGroups.find(
              g => g.groupDef.id === trigger.targetGroup,
            );
            if (!targetGroup || !targetGroup.activated) return false;
            // Look at spawned entities from that group
            const enemies = world.with('enemy', 'health');
            for (const entity of enemies) {
              if (entity.dead) continue;
              // Check if this entity's health is below threshold
              // We approximate by checking all living enemies (since we can't
              // reliably track entity IDs through the spawn function return types)
              const hpPercent = (entity.health.current / entity.health.max) * 100;
              if (hpPercent <= trigger.percent) {
                return true;
              }
            }
            return false;
          }
        }
        return false;
      }
    }
  }

  // -- Common logic -------------------------------------------------------

  private checkWaveComplete(): void {
    const livingCount = this.livingEnemyCount();

    // For designed waves, also check if there are still pending groups
    if (this.usingDesignedWave) {
      const hasPendingGroups = this.activeGroups.some(
        ag => !ag.activated || ag.pendingSpawns.length > 0,
      );
      // Don't complete the wave if there are pending triggered groups
      // (unless all enemies are dead AND no more triggers can fire)
      if (hasPendingGroups && livingCount === 0) {
        // Check if remaining groups can still trigger
        const canStillTrigger = this.activeGroups.some(ag => {
          if (ag.activated) return ag.pendingSpawns.length > 0;
          const timing = ag.groupDef.timing;
          if (timing.kind === 'immediate') return true;
          if (timing.kind === 'staggered') return this.waveElapsedTime < timing.delaySeconds;
          if (timing.kind === 'triggered') {
            const trigger = timing.trigger;
            // Time-based triggers can still fire
            if (trigger.type === 'time_elapsed') return this.waveElapsedTime < trigger.seconds;
            // Kill/remaining triggers with 0 living enemies -- check if already satisfied
            if (trigger.type === 'enemies_killed') return this.waveKillCount >= trigger.count;
            // enemies_remaining with count > 0 cannot trigger when 0 alive
            if (trigger.type === 'enemies_remaining') return false;
            if (trigger.type === 'health_threshold') return false;
          }
          return false;
        });
        if (canStillTrigger) return; // Wait for more groups
      }
      if (hasPendingGroups && livingCount > 0) return; // Still fighting
    }

    if (livingCount === 0) {
      // After a boss wave (every 5th), return to town
      if (this.currentWave > 0 && this.currentWave % 5 === 0 && isMapActive()) {
        musicPlayer.crossfade('town', 1000);
        enterTown();
        return;
      }
      if (this.currentWave % 5 === 0) {
        musicPlayer.play('victory');
      } else {
        musicPlayer.play(getZoneTrack(getActiveThemeKey()));
      }
      this.state = 'cooldown';
      this.cooldownTimer = WAVE_DELAY;
      autoSave().catch((err) => console.warn('Auto-save failed:', err));
    }
  }

  private livingEnemyCount(): number {
    const enemies = world.with('enemy');
    let count = 0;
    for (const e of enemies) {
      if (!e.dead) count++;
    }
    return count;
  }

  private beginNextWave(): void {
    this.currentWave++;

    const pPos = getPlayerPos();
    if (!pPos) return;

    // Compute monster level from current player level
    const playerQuery = world.with('player', 'level');
    const playerLevel = playerQuery.entities[0]?.level ?? 1;
    this.currentMonsterLevel = getMonsterLevel(playerLevel, {
      mapBaseLevel: 1,
      mapTierBonus: getActiveTierBonus(),
    });

    // Boss wave every 5 waves (5, 10, 15, ...)
    if (this.currentWave % 5 === 0) {
      this.spawnBossWave(pPos);
      return;
    }

    // Waves 1-5: use legacy predefined waves for tutorial progression
    if (this.currentWave <= PREDEFINED_WAVES.length) {
      this.beginLegacyWave(pPos);
      return;
    }

    // Wave 6+: use data-driven WaveDesign system
    this.beginDesignedWave(pPos);
  }

  private beginLegacyWave(pPos: { x: number; y: number }): void {
    this.usingDesignedWave = false;
    const waveDef = PREDEFINED_WAVES[this.currentWave - 1];

    const modifiedEnemies = applyModifiers(
      waveDef.enemies as { type: EnemyType; count: number }[],
    );
    const typeList = flattenEnemies(modifiedEnemies);

    this.pendingSpawns = buildLegacySpawns(waveDef.formation, typeList, pPos.x, pPos.y);
    this.spawnTimer = 0;
    this.state = 'spawning';

    this.showWaveText();
  }

  private beginDesignedWave(pPos: { x: number; y: number }): void {
    this.usingDesignedWave = true;
    this.waveElapsedTime = 0;
    this.waveKillCount = 0;
    this.lastLivingCount = this.livingEnemyCount();

    // Try to select a designed wave, fallback to dynamic generation
    const design = selectWaveDesign(this.currentWave) ?? generateDynamicWave(this.currentWave);

    // Build active groups from the design
    const baseAngle = Math.random() * Math.PI * 2;
    this.activeGroups = design.groups.map(groupDef => {
      const ag: ActiveGroup = {
        groupDef,
        pendingSpawns: [],
        spawnTimer: 0,
        activated: false,
        elapsedSinceActivation: 0,
        spawnedEntityIds: [],
      };

      // Immediate groups get their spawns resolved now
      if (groupDef.timing.kind === 'immediate') {
        const modifiedEnemies = applyModifiers(groupDef.enemies);
        const typeList = flattenEnemies(modifiedEnemies);
        const anchorPos = resolveAnchor(groupDef.anchor, pPos.x, pPos.y, baseAngle);
        ag.pendingSpawns = arrangeGroup(typeList, anchorPos, groupDef.spread, pPos.x, pPos.y);
        ag.activated = true;
        ag.spawnTimer = 0;
      }

      return ag;
    });

    this.state = 'spawning';
    this.showWaveText();
  }

  /** Spawn a boss wave using boss-tier WaveDesign for add groups. */
  private spawnBossWave(pPos: { x: number; y: number }): void {
    // Spawn the actual boss entity at a safe distance from the player
    const bossPos = findSpawnPosition(pPos.x, pPos.y)
      ?? findNearestFloor(pPos.x + SURROUND_DIST, pPos.y);
    const bossType = getBossForZone(getActiveThemeKey());
    spawnBoss(bossPos.x, bossPos.y, this.currentMonsterLevel, bossType);

    musicPlayer.crossfade('boss', 800);

    // Try to select a boss-tier WaveDesign for add groups and reinforcements.
    // The first group in each boss design represents the boss itself (already
    // spawned above via spawnBoss), so we skip it and use the remaining groups
    // for adds, reinforcements, and triggered phases.
    const bossCandidates = WAVE_DESIGNS.filter(d => d.difficulty === 'boss');
    if (bossCandidates.length > 0) {
      const design = bossCandidates[this.currentWave % bossCandidates.length];
      const addGroups = design.groups.slice(1); // skip the "boss" group

      if (addGroups.length > 0) {
        this.usingDesignedWave = true;
        this.waveElapsedTime = 0;
        this.waveKillCount = 0;
        this.lastLivingCount = this.livingEnemyCount();

        const baseAngle = Math.random() * Math.PI * 2;
        this.activeGroups = addGroups.map(groupDef => {
          const ag: ActiveGroup = {
            groupDef,
            pendingSpawns: [],
            spawnTimer: 0,
            activated: false,
            elapsedSinceActivation: 0,
            spawnedEntityIds: [],
          };

          if (groupDef.timing.kind === 'immediate') {
            const modifiedEnemies = applyModifiers(groupDef.enemies);
            const typeList = flattenEnemies(modifiedEnemies);
            const anchorPos = resolveAnchor(groupDef.anchor, pPos.x, pPos.y, baseAngle);
            ag.pendingSpawns = arrangeGroup(typeList, anchorPos, groupDef.spread, pPos.x, pPos.y);
            ag.activated = true;
            ag.spawnTimer = 0;
          }

          return ag;
        });

        this.state = 'spawning';
        this.showWaveText();
        return;
      }
    }

    // Fallback: boss-only wave (no add groups available)
    this.usingDesignedWave = false;
    this.pendingSpawns = [];
    this.state = 'active';

    this.showWaveText();
  }

  // -- HUD ----------------------------------------------------------------

  private showWaveText(): void {
    if (this.waveText) {
      game.hudLayer.removeChild(this.waveText);
      this.waveText.destroy();
    }

    this.waveText = new Text({
      text: `Wave ${this.currentWave}`,
      style: new TextStyle({
        fill: 0xffffff,
        fontSize: FontSize['3xl'],
        fontFamily: Fonts.display,
        stroke: { color: 0x000000, width: 4 },
      }),
    });
    this.waveText.anchor.set(0.5, 0.5);
    this.waveText.position.set(640, 200); // top-center of 1280x720
    game.hudLayer.addChild(this.waveText);
    this.waveTextTimer = WAVE_TEXT_DURATION;
  }

  private updateWaveText(dt: number): void {
    if (!this.waveText) return;
    this.waveTextTimer -= dt;

    if (this.waveTextTimer <= 0) {
      game.hudLayer.removeChild(this.waveText);
      this.waveText.destroy();
      this.waveText = null;
    } else if (this.waveTextTimer < 0.5) {
      // Fade out in last 0.5s
      this.waveText.alpha = this.waveTextTimer / 0.5;
    }
  }
}
