/**
 * Environmental Hazard System: places and manages zone-specific ground effects.
 *
 * Each zone can define hazards (burning ground, frost patches, void rifts, etc.)
 * that are placed during map generation and evaluated per-frame for player overlap.
 * Hazards are rendered as colored ground zones on the world layer.
 *
 * Enhanced hazard types:
 * - Task 1: burning ground (Burn DoT), frost patches (Chill), void rifts (projectile deflection),
 *           cryo barriers (destructible ice walls)
 * - Task 2: lightning rods (chain lightning), abyssal darkness (visibility reduction),
 *           chromatic shift (cycling elemental phases), regen spores (enemy heal),
 *           vine snares (hidden root traps), heat vents (periodic flame bursts)
 * - Task 3: glitch tiles (toggling floor/wall), warp pads (paired teleporters),
 *           entropy drain (constant HP loss), null zones (cooldown freeze)
 */

import { Graphics } from 'pixi.js';
import { game } from '../Game';
import { world, type Entity } from '../ecs/world';
import { applyStatus, StatusType } from './StatusEffects';
import { spawnDamageNumber } from '../ui/DamageNumbers';
import { TILE_SIZE, SCREEN_W, SCREEN_H } from './constants';
import type { DungeonData, DungeonRoom } from '../map/DungeonGenerator';
import { invalidateFlowField } from '../map/Pathfinding';

// ── Hazard Effect Types ────────────────────────────────────────────

export type HazardEffectType =
  | 'damage'        // flat %HP damage per second
  | 'slow'          // movement speed reduction
  | 'chill'         // applies Chill status
  | 'burn'          // applies Burn status + %HP damage
  | 'armor_reduce'  // reduces armor effectiveness
  | 'heal_enemy'    // heals enemies inside
  | 'pull'          // pulls player toward center (slow)
  | 'drain'         // constant HP drain (global)
  | 'cd_freeze'     // skill cooldowns do not tick
  | 'lightning_rod' // chain lightning between rods
  | 'darkness'      // reduces visibility radius
  | 'chromatic'     // cycling elemental phases (global)
  | 'vine_snare'    // hidden root traps
  | 'heat_vent'     // periodic flame bursts from walls
  | 'glitch_tile'   // toggles floor/wall
  | 'warp_pad'      // paired teleporters
  | 'cryo_barrier'; // destructible ice wall

// ── Hazard Definition (zone config) ────────────────────────────────

export interface HazardDefinition {
  /** Unique identifier matching the zone design id */
  id: string;
  /** What effect to apply */
  effectType: HazardEffectType;
  /** Damage as fraction of max HP per second (for damage/drain types) */
  damagePercent?: number;
  /** Speed multiplier penalty (0.2 = 20% slow) */
  slowAmount?: number;
  /** Armor reduction fraction (0.3 = 30% less armor) */
  armorReduction?: number;
  /** Enemy heal as fraction of max HP per second */
  enemyHealPercent?: number;
  /** Visual: fill color */
  color: number;
  /** Visual: fill alpha */
  alpha: number;
  /** Visual: pulsing (animated alpha oscillation) */
  pulse?: boolean;
  /** Placement strategy */
  placement: HazardPlacement;
  /** Fraction of floor tiles to cover (0.0-1.0) */
  coverage: number;
  /** Whether coverage scales up with map tier (base + tier * 0.02) */
  coverageScalesWithTier?: boolean;
  /** Radius in tiles for room-center placed hazards */
  radius?: number;
  /** Minimum distance from spawn in tiles */
  minSpawnDistance?: number;
  /** Timer interval for periodic effects (lightning rods, heat vents) */
  interval?: number;
  /** HP for destructible hazards (cryo barriers) */
  hp?: number;
}

export type HazardPlacement =
  | 'random_floor'      // scattered across random floor tiles
  | 'room_center'       // placed at room centers with a radius
  | 'near_walls'        // floor tiles adjacent to walls
  | 'corridors'         // tiles in corridors (not in rooms)
  | 'global';           // affects entire map (no tile placement)

// ── Hazard Instance (runtime) ──────────────────────────────────────

export interface HazardInstance {
  /** Definition this instance was created from */
  def: HazardDefinition;
  /** Tile coordinates that are part of this hazard */
  tiles: Set<string>;  // "x,y" tile keys for fast lookup
  /** Whether hazard is currently active */
  active: boolean;
  /** Timer for periodic effects (damage ticks) */
  tickTimer: number;
  /** Graphics object for rendering */
  gfx: Graphics;
  /** Animation timer for pulsing */
  pulseTimer: number;
}

// ── Lightning Rod Instance ─────────────────────────────────────────

interface LightningRod {
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  dischargeTimer: number;
  gfx: Graphics;
}

// ── Heat Vent Instance ─────────────────────────────────────────────

interface HeatVent {
  tileX: number;
  tileY: number;
  /** Direction vent fires (perpendicular to wall) */
  dirX: number;
  dirY: number;
  /** Cycle timer (0-5s: 0-3.7 idle, 3.7-4.0 telegraph, 4.0-4.3 burst, 4.3-5.0 cooldown) */
  cycleTimer: number;
  /** Offset from other vents to stagger */
  cycleOffset: number;
  gfx: Graphics;
}

// ── Glitch Tile Instance ───────────────────────────────────────────

interface GlitchTile {
  tileX: number;
  tileY: number;
  /** Independent timer for this tile */
  timer: number;
  /** Total interval (8-12s random) */
  interval: number;
  /** Whether currently a wall */
  isWall: boolean;
  /** Telegraph phase (last 1s before toggle) */
  telegraphing: boolean;
}

// ── Warp Pad Pair ──────────────────────────────────────────────────

interface WarpPad {
  tile1: { x: number; y: number };
  tile2: { x: number; y: number };
  /** Per-entity cooldown tracking (entity ref -> remaining cooldown) */
  cooldowns: Map<object, number>;
  gfx: Graphics;
  pulseTimer: number;
}

// ── Vine Snare Instance ────────────────────────────────────────────

interface VineSnare {
  tileX: number;
  tileY: number;
  /** Cooldown before can trigger again */
  cooldown: number;
  /** Whether currently triggered */
  triggered: boolean;
  gfx: Graphics;
}

// ── Cryo Barrier Instance ──────────────────────────────────────────

interface CryoBarrier {
  tileX: number;
  tileY: number;
  hp: number;
  maxHP: number;
  gfx: Graphics;
}

// ── Module State ───────────────────────────────────────────────────

let hazardInstances: HazardInstance[] = [];
let globalHazardDefs: HazardDefinition[] = [];
let hazardTileLookup: Map<string, HazardInstance[]> = new Map();
let currentTier = 1;

// Specialized hazard state
let lightningRods: LightningRod[] = [];
let lightningGfx: Graphics | null = null;
let heatVents: HeatVent[] = [];
let glitchTiles: GlitchTile[] = [];
let glitchGfx: Graphics | null = null;
let warpPads: WarpPad[] = [];
let vineSnares: VineSnare[] = [];
let cryoBarriers: CryoBarrier[] = [];
let cryoBarrierLookup: Map<string, CryoBarrier> = new Map();

// Darkness overlay
let darknessOverlay: Graphics | null = null;
let darknessActive = false;
let darknessRadius = 160; // 5 tiles * 32px

// Chromatic shift state
let chromaticActive = false;
let chromaticTimer = 0;
// Cycle: 0-5 neutral, 5-10 fire, 10-15 neutral, 15-20 ice, 20-25 neutral, 25-30 lightning
let chromaticGfx: Graphics | null = null;

// Vine snare root state
let _playerRootTimer = 0;

// Cached dungeon ref for glitch tile manipulation
let _cachedDungeon: DungeonData | null = null;

// ── Zone Hazard Definitions ────────────────────────────────────────

const ZONE_HAZARD_DEFS: Record<string, HazardDefinition[]> = {
  the_grid: [],  // no hazards (starter zone)

  neon_wastes: [
    {
      id: 'void_rifts',
      effectType: 'slow',
      slowAmount: 0.2,
      color: 0xff00ff,
      alpha: 0.15,
      pulse: true,
      placement: 'room_center',
      coverage: 0,  // uses radius-based placement
      radius: 3,
      minSpawnDistance: 5,
    },
  ],

  reactor_core: [
    {
      id: 'burning_ground',
      effectType: 'burn',
      damagePercent: 0.03,
      color: 0xff4400,
      alpha: 0.2,
      pulse: true,
      placement: 'random_floor',
      coverage: 0.08,
      coverageScalesWithTier: true,
      minSpawnDistance: 3,
    },
    {
      id: 'heat_vents',
      effectType: 'heat_vent',
      damagePercent: 0.08,
      color: 0xff6600,
      alpha: 0.2,
      pulse: false,
      placement: 'near_walls',
      coverage: 0.04,
      coverageScalesWithTier: true,
      minSpawnDistance: 2,
      interval: 5,
    },
  ],

  frozen_array: [
    {
      id: 'frost_patches',
      effectType: 'chill',
      color: 0x88ccff,
      alpha: 0.18,
      pulse: false,
      placement: 'corridors',
      coverage: 0.15,
      coverageScalesWithTier: true,
      minSpawnDistance: 2,
    },
    {
      id: 'cryo_barriers',
      effectType: 'cryo_barrier',
      color: 0xaaeeff,
      alpha: 0.5,
      pulse: false,
      placement: 'corridors',
      coverage: 0.01,
      coverageScalesWithTier: true,
      minSpawnDistance: 3,
      hp: 50,
    },
  ],

  overgrowth: [
    {
      id: 'regen_spores',
      effectType: 'heal_enemy',
      enemyHealPercent: 0.02,
      color: 0x44dd88,
      alpha: 0.15,
      pulse: true,
      placement: 'room_center',
      coverage: 0,
      radius: 3,
      minSpawnDistance: 3,
    },
    {
      id: 'vine_snares',
      effectType: 'vine_snare',
      color: 0x226644,
      alpha: 0.1,
      pulse: false,
      placement: 'corridors',
      coverage: 0.05,
      coverageScalesWithTier: true,
      minSpawnDistance: 3,
    },
  ],

  storm_network: [
    {
      id: 'conductive_floor',
      effectType: 'damage',
      damagePercent: 0.02,
      color: 0xffdd44,
      alpha: 0.12,
      pulse: true,
      placement: 'room_center',
      coverage: 0,
      radius: 3,
      minSpawnDistance: 2,
    },
    {
      id: 'lightning_rods',
      effectType: 'lightning_rod',
      color: 0xffdd44,
      alpha: 0.3,
      pulse: false,
      placement: 'room_center',
      coverage: 0,
      radius: 0,
      minSpawnDistance: 2,
      interval: 4,
    },
  ],

  the_abyss: [
    {
      id: 'shadow_pools',
      effectType: 'slow',
      slowAmount: 0.15,
      color: 0x220033,
      alpha: 0.25,
      pulse: false,
      placement: 'random_floor',
      coverage: 0.12,
      coverageScalesWithTier: true,
      minSpawnDistance: 3,
    },
    {
      id: 'abyssal_darkness',
      effectType: 'darkness',
      color: 0x000000,
      alpha: 0.0,
      pulse: false,
      placement: 'global',
      coverage: 0,
    },
  ],

  chromatic_rift: [
    {
      id: 'chromatic_shift',
      effectType: 'chromatic',
      color: 0xff44ff,
      alpha: 0.0,
      pulse: false,
      placement: 'global',
      coverage: 0,
    },
  ],

  rust_hollow: [
    {
      id: 'rust_cloud',
      effectType: 'armor_reduce',
      armorReduction: 0.3,
      color: 0xcc8844,
      alpha: 0.15,
      pulse: true,
      placement: 'room_center',
      coverage: 0,
      radius: 3,
      minSpawnDistance: 2,
    },
  ],

  signal_spire: [
    {
      id: 'signal_beam',
      effectType: 'damage',
      damagePercent: 0.03,
      color: 0x6688ff,
      alpha: 0.12,
      pulse: true,
      placement: 'room_center',
      coverage: 0,
      radius: 2,
      minSpawnDistance: 3,
    },
  ],

  memory_leak: [
    {
      id: 'glitch_tiles',
      effectType: 'glitch_tile',
      color: 0xaa44ff,
      alpha: 0.18,
      pulse: true,
      placement: 'random_floor',
      coverage: 0.12,
      coverageScalesWithTier: true,
      minSpawnDistance: 2,
    },
    {
      id: 'warp_pads',
      effectType: 'warp_pad',
      color: 0xaa44ff,
      alpha: 0.3,
      pulse: true,
      placement: 'room_center',
      coverage: 0,
      radius: 1,
      minSpawnDistance: 3,
    },
  ],

  null_sector: [
    {
      id: 'entropy_drain',
      effectType: 'drain',
      damagePercent: 0.01,
      color: 0xff0000,
      alpha: 0.0,  // global, no tile visual
      pulse: false,
      placement: 'global',
      coverage: 0,
    },
    {
      id: 'null_zones',
      effectType: 'cd_freeze',
      color: 0x000000,
      alpha: 0.3,
      pulse: false,
      placement: 'room_center',
      coverage: 0,
      radius: 3,
      minSpawnDistance: 2,
    },
  ],
};

// ── Placement Logic ────────────────────────────────────────────────

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
}

/**
 * Collect all floor tile coordinates from dungeon data.
 */
function getFloorTiles(dungeon: DungeonData): { x: number; y: number }[] {
  const floors: { x: number; y: number }[] = [];
  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x] === 0) {
        floors.push({ x, y });
      }
    }
  }
  return floors;
}

/**
 * Check if a tile is adjacent to a wall.
 */
function isNearWall(dungeon: DungeonData, tx: number, ty: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) return true;
      if (dungeon.tiles[ny][nx] === 1) return true;
    }
  }
  return false;
}

/**
 * Get the direction from a wall-adjacent tile pointing away from the nearest wall.
 */
function getWallNormal(dungeon: DungeonData, tx: number, ty: number): { x: number; y: number } {
  // Find the first adjacent wall and return direction away from it
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const nx = tx + dx;
    const ny = ty + dy;
    if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) {
      return { x: -dx, y: -dy };
    }
    if (dungeon.tiles[ny][nx] === 1) {
      return { x: -dx, y: -dy };
    }
  }
  return { x: 0, y: 1 }; // default downward
}

/**
 * Check if a tile is inside any room (not a corridor).
 */
function isInRoom(dungeon: DungeonData, tx: number, ty: number): boolean {
  for (const room of dungeon.rooms) {
    if (tx >= room.x1 && tx <= room.x2 && ty >= room.y1 && ty <= room.y2) {
      return true;
    }
  }
  return false;
}

/**
 * Measure how wide a corridor is at a given floor tile.
 * Returns the minimum of horizontal and vertical open spans through (tx, ty).
 * A tile in a 3-wide corridor returns 3; a 1-wide chokepoint returns 1.
 */
function corridorWidthAt(dungeon: DungeonData, tx: number, ty: number): number {
  const tiles = dungeon.tiles;
  // Horizontal span
  let hSpan = 1;
  for (let dy = -1; ty + dy >= 0; dy--) {
    if (tiles[ty + dy][tx] !== 0) break;
    hSpan++;
  }
  for (let dy = 1; ty + dy < dungeon.height; dy++) {
    if (tiles[ty + dy][tx] !== 0) break;
    hSpan++;
  }
  // Vertical span
  let vSpan = 1;
  for (let dx = -1; tx + dx >= 0; dx--) {
    if (tiles[ty][tx + dx] !== 0) break;
    vSpan++;
  }
  for (let dx = 1; tx + dx < dungeon.width; dx++) {
    if (tiles[ty][tx + dx] !== 0) break;
    vSpan++;
  }
  return Math.min(hSpan, vSpan);
}

/**
 * Fisher-Yates shuffle (in-place).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Place hazard tiles using the random_floor strategy.
 */
function placeRandomFloor(
  def: HazardDefinition,
  dungeon: DungeonData,
  tier: number,
): Set<string> {
  const tiles = new Set<string>();
  let coverage = def.coverage;
  if (def.coverageScalesWithTier) {
    coverage += (tier - 1) * 0.02;
  }
  // Damaging hazards capped lower so the player can navigate around them
  const maxCoverage = (def.effectType === 'burn' || def.effectType === 'damage') ? 0.2 : 0.4;
  coverage = Math.min(coverage, maxCoverage);

  const floors = shuffle(getFloorTiles(dungeon));
  const minDistSq = (def.minSpawnDistance ?? 0) ** 2;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;
  const targetCount = Math.floor(floors.length * coverage);
  // Glitch tiles toggle to walls — only place in rooms to avoid blocking corridors
  const roomsOnly = def.effectType === 'glitch_tile';

  let placed = 0;
  for (const tile of floors) {
    if (placed >= targetCount) break;
    if (minDistSq > 0 && distSq(tile.x, tile.y, spawnX, spawnY) < minDistSq) continue;
    if (roomsOnly && !isInRoom(dungeon, tile.x, tile.y)) continue;
    tiles.add(tileKey(tile.x, tile.y));
    placed++;
  }
  return tiles;
}

/**
 * Place hazard tiles at room centers with a radius.
 */
function placeRoomCenter(
  def: HazardDefinition,
  dungeon: DungeonData,
): Set<string> {
  const tiles = new Set<string>();
  const radius = def.radius ?? 3;
  const minDistSq = (def.minSpawnDistance ?? 0) ** 2;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;

  for (const room of dungeon.rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);

    // Skip rooms too close to spawn
    if (minDistSq > 0 && distSq(cx, cy, spawnX, spawnY) < minDistSq) continue;

    // Place tiles in a circle around the room center
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = cx + dx;
        const ty = cy + dy;
        if (tx < 0 || ty < 0 || tx >= dungeon.width || ty >= dungeon.height) continue;
        if (dungeon.tiles[ty][tx] !== 0) continue;  // only on floor
        tiles.add(tileKey(tx, ty));
      }
    }
  }
  return tiles;
}

/**
 * Place hazard tiles near walls.
 */
function placeNearWalls(
  def: HazardDefinition,
  dungeon: DungeonData,
  tier: number,
): Set<string> {
  const tiles = new Set<string>();
  let coverage = def.coverage;
  if (def.coverageScalesWithTier) {
    coverage += (tier - 1) * 0.02;
  }
  coverage = Math.min(coverage, 0.4);

  const candidates: { x: number; y: number }[] = [];
  const minDistSq = (def.minSpawnDistance ?? 0) ** 2;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x] !== 0) continue;
      if (!isNearWall(dungeon, x, y)) continue;
      if (minDistSq > 0 && distSq(x, y, spawnX, spawnY) < minDistSq) continue;
      candidates.push({ x, y });
    }
  }

  shuffle(candidates);
  const floors = getFloorTiles(dungeon);
  const targetCount = Math.floor(floors.length * coverage);
  for (let i = 0; i < Math.min(targetCount, candidates.length); i++) {
    tiles.add(tileKey(candidates[i].x, candidates[i].y));
  }
  return tiles;
}

/**
 * Place hazard tiles in corridors (floor tiles not inside rooms).
 */
function placeCorridors(
  def: HazardDefinition,
  dungeon: DungeonData,
  tier: number,
): Set<string> {
  const tiles = new Set<string>();
  let coverage = def.coverage;
  if (def.coverageScalesWithTier) {
    coverage += (tier - 1) * 0.02;
  }
  coverage = Math.min(coverage, 0.4);

  const corridorTiles: { x: number; y: number }[] = [];
  const minDistSq = (def.minSpawnDistance ?? 0) ** 2;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;
  const blocksMovement = def.effectType === 'cryo_barrier';

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x] !== 0) continue;
      if (isInRoom(dungeon, x, y)) continue;
      if (minDistSq > 0 && distSq(x, y, spawnX, spawnY) < minDistSq) continue;
      // Movement-blocking hazards (cryo barriers) need corridors wide enough to walk around
      if (blocksMovement && corridorWidthAt(dungeon, x, y) < 3) continue;
      corridorTiles.push({ x, y });
    }
  }

  shuffle(corridorTiles);
  // Use coverage as fraction of ALL floor tiles, not just corridor tiles
  const allFloors = getFloorTiles(dungeon);
  const targetCount = Math.floor(allFloors.length * coverage);
  for (let i = 0; i < Math.min(targetCount, corridorTiles.length); i++) {
    tiles.add(tileKey(corridorTiles[i].x, corridorTiles[i].y));
  }
  return tiles;
}

// ── Rendering ──────────────────────────────────────────────────────

function renderHazardGraphics(instance: HazardInstance): void {
  const g = instance.gfx;
  g.clear();

  const baseAlpha = instance.def.alpha;
  const pulseAlpha = instance.def.pulse
    ? baseAlpha * (0.7 + 0.3 * Math.sin(instance.pulseTimer * 2))
    : baseAlpha;

  for (const key of instance.tiles) {
    const [sx, sy] = key.split(',').map(Number);
    g.rect(sx * TILE_SIZE, sy * TILE_SIZE, TILE_SIZE, TILE_SIZE)
      .fill({ color: instance.def.color, alpha: pulseAlpha });
  }
}

// ── Specialized Placement ──────────────────────────────────────────

/**
 * Place lightning rods at room centers (one per room, not on spawn room).
 */
function placeLightningRods(dungeon: DungeonData): void {
  const minDistSq = 5 * 5;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;

  for (const room of dungeon.rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (distSq(cx, cy, spawnX, spawnY) < minDistSq) continue;
    if (dungeon.tiles[cy][cx] !== 0) continue;

    const gfx = new Graphics();
    game.entityLayer.addChild(gfx);

    // Draw pylon
    const px = cx * TILE_SIZE;
    const py = cy * TILE_SIZE;
    gfx.rect(px + 10, py + 4, 12, 24).fill({ color: 0xaaaa44, alpha: 0.8 });
    gfx.rect(px + 12, py + 2, 8, 4).fill({ color: 0xffdd44, alpha: 0.9 });

    lightningRods.push({
      tileX: cx,
      tileY: cy,
      worldX: px + TILE_SIZE / 2,
      worldY: py + TILE_SIZE / 2,
      dischargeTimer: Math.random() * 4, // stagger initial timers
      gfx,
    });
  }
}

/**
 * Place heat vents along walls.
 */
function placeHeatVents(dungeon: DungeonData, tier: number): void {
  const candidates: { x: number; y: number; dirX: number; dirY: number }[] = [];
  const minDistSq = 2 * 2;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;

  for (let y = 0; y < dungeon.height; y++) {
    for (let x = 0; x < dungeon.width; x++) {
      if (dungeon.tiles[y][x] !== 0) continue;
      if (!isNearWall(dungeon, x, y)) continue;
      if (distSq(x, y, spawnX, spawnY) < minDistSq) continue;
      const normal = getWallNormal(dungeon, x, y);
      if (normal.x === 0 && normal.y === 0) continue;
      candidates.push({ x, y, dirX: normal.x, dirY: normal.y });
    }
  }

  shuffle(candidates);
  // 2-3 vents per room, estimate rooms * 2.5
  const targetCount = Math.min(candidates.length, Math.floor(dungeon.rooms.length * (2 + tier * 0.5)));

  for (let i = 0; i < targetCount; i++) {
    const c = candidates[i];
    const gfx = new Graphics();
    game.worldLayer.addChild(gfx);

    heatVents.push({
      tileX: c.x,
      tileY: c.y,
      dirX: c.dirX,
      dirY: c.dirY,
      cycleTimer: 0,
      cycleOffset: Math.random() * 5, // stagger timers
      gfx,
    });
  }
}

/**
 * Place glitch tiles from the random_floor set.
 */
function placeGlitchTiles(tiles: Set<string>): void {
  glitchGfx = new Graphics();
  game.worldLayer.addChild(glitchGfx);

  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    glitchTiles.push({
      tileX: x,
      tileY: y,
      timer: Math.random() * 10, // random initial offset
      interval: 8 + Math.random() * 4, // 8-12s
      isWall: false,
      telegraphing: false,
    });
  }
}

/**
 * Place warp pad pairs in different rooms.
 */
function placeWarpPads(dungeon: DungeonData): void {
  const minDistSq = 3 * 3;
  const spawnX = dungeon.spawn.x;
  const spawnY = dungeon.spawn.y;

  // Get eligible rooms (not spawn room)
  const eligibleRooms: DungeonRoom[] = [];
  for (const room of dungeon.rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (distSq(cx, cy, spawnX, spawnY) < minDistSq) continue;
    eligibleRooms.push(room);
  }

  shuffle(eligibleRooms);

  // Create 2-3 pairs (need at least 2 rooms per pair)
  const numPairs = Math.min(3, Math.floor(eligibleRooms.length / 2));

  for (let i = 0; i < numPairs; i++) {
    const room1 = eligibleRooms[i * 2];
    const room2 = eligibleRooms[i * 2 + 1];
    if (!room1 || !room2) break;

    const c1x = Math.floor((room1.x1 + room1.x2) / 2);
    const c1y = Math.floor((room1.y1 + room1.y2) / 2);
    const c2x = Math.floor((room2.x1 + room2.x2) / 2);
    const c2y = Math.floor((room2.y1 + room2.y2) / 2);

    // Ensure both centers are floor
    if (dungeon.tiles[c1y]?.[c1x] !== 0 || dungeon.tiles[c2y]?.[c2x] !== 0) continue;

    const gfx = new Graphics();
    game.worldLayer.addChild(gfx);

    warpPads.push({
      tile1: { x: c1x, y: c1y },
      tile2: { x: c2x, y: c2y },
      cooldowns: new Map(),
      gfx,
      pulseTimer: Math.random() * Math.PI * 2,
    });
  }
}

/**
 * Place vine snares in corridors.
 */
function placeVineSnares(tiles: Set<string>): void {
  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    const gfx = new Graphics();
    game.worldLayer.addChild(gfx);

    vineSnares.push({
      tileX: x,
      tileY: y,
      cooldown: 0,
      triggered: false,
      gfx,
    });
  }
}

/**
 * Place cryo barriers in corridors.
 */
function placeCryoBarriers(tiles: Set<string>, tier: number): void {
  const baseHP = 50 + (tier - 1) * 15;

  for (const key of tiles) {
    const [x, y] = key.split(',').map(Number);
    const gfx = new Graphics();
    game.worldLayer.addChild(gfx);

    const barrier: CryoBarrier = {
      tileX: x,
      tileY: y,
      hp: baseHP,
      maxHP: baseHP,
      gfx,
    };

    cryoBarriers.push(barrier);
    cryoBarrierLookup.set(tileKey(x, y), barrier);
  }
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Place hazards based on the active zone. Called from MapDevice.activateMap()
 * after dungeon generation.
 */
export function placeHazards(dungeon: DungeonData, zoneKey: string, tier: number): void {
  // Clean up any existing hazards first
  clearHazards();

  currentTier = tier;
  _cachedDungeon = dungeon;
  const defs = ZONE_HAZARD_DEFS[zoneKey];
  if (!defs || defs.length === 0) return;

  for (const def of defs) {
    // Handle specialized hazard types
    if (def.effectType === 'lightning_rod') {
      placeLightningRods(dungeon);
      continue;
    }
    if (def.effectType === 'heat_vent') {
      placeHeatVents(dungeon, tier);
      continue;
    }
    if (def.effectType === 'darkness') {
      darknessActive = true;
      darknessRadius = 5 * TILE_SIZE; // 5 tile default visibility
      darknessOverlay = new Graphics();
      game.hudLayer.addChild(darknessOverlay);
      globalHazardDefs.push(def);
      continue;
    }
    if (def.effectType === 'chromatic') {
      chromaticActive = true;
      chromaticTimer = 0;
      chromaticGfx = new Graphics();
      game.hudLayer.addChild(chromaticGfx);
      globalHazardDefs.push(def);
      continue;
    }

    // Global hazards have no tile placement
    if (def.placement === 'global') {
      globalHazardDefs.push(def);
      continue;
    }

    // Determine tiles
    let tiles: Set<string>;
    switch (def.placement) {
      case 'random_floor':
        tiles = placeRandomFloor(def, dungeon, tier);
        break;
      case 'room_center':
        tiles = placeRoomCenter(def, dungeon);
        break;
      case 'near_walls':
        tiles = placeNearWalls(def, dungeon, tier);
        break;
      case 'corridors':
        tiles = placeCorridors(def, dungeon, tier);
        break;
      default:
        tiles = new Set();
    }

    if (tiles.size === 0) continue;

    // Handle specialized tile-based hazards
    if (def.effectType === 'glitch_tile') {
      placeGlitchTiles(tiles);
      continue;
    }
    if (def.effectType === 'warp_pad') {
      placeWarpPads(dungeon);
      continue;
    }
    if (def.effectType === 'vine_snare') {
      placeVineSnares(tiles);
      continue;
    }
    if (def.effectType === 'cryo_barrier') {
      placeCryoBarriers(tiles, tier);
      continue;
    }

    // Create graphics on world layer (rendered below entities)
    const gfx = new Graphics();
    game.worldLayer.addChild(gfx);

    const instance: HazardInstance = {
      def,
      tiles,
      active: true,
      tickTimer: 0,
      gfx,
      pulseTimer: Math.random() * Math.PI * 2,  // random phase offset
    };

    hazardInstances.push(instance);

    // Build tile lookup for fast collision
    for (const key of tiles) {
      if (!hazardTileLookup.has(key)) {
        hazardTileLookup.set(key, []);
      }
      hazardTileLookup.get(key)!.push(instance);
    }

    // Initial render
    renderHazardGraphics(instance);
  }
}

/**
 * Per-frame hazard evaluation. Checks player overlap with hazard tiles and
 * applies effects. Also handles enemy healing for regen spore hazards.
 * Called from Game.ts fixed update.
 */
export function updateHazards(dt: number): void {
  const noHazards = hazardInstances.length === 0 && globalHazardDefs.length === 0
    && lightningRods.length === 0 && heatVents.length === 0
    && glitchTiles.length === 0 && warpPads.length === 0
    && vineSnares.length === 0 && cryoBarriers.length === 0;
  if (noHazards) return;

  const players = world.with('player', 'position', 'health');
  if (players.entities.length === 0) return;
  const player = players.entities[0];
  if (player.dead) return;

  // Get player tile position
  const ptx = Math.floor(player.position.x / TILE_SIZE);
  const pty = Math.floor(player.position.y / TILE_SIZE);
  const playerTileKey = tileKey(ptx, pty);

  // Track which effects are active this frame for the player
  let armorReductionActive = false;
  let armorReductionAmount = 0;
  let cdFreezeActive = false;

  // Check tile-based hazards for player overlap
  const overlapping = hazardTileLookup.get(playerTileKey);
  if (overlapping) {
    for (const instance of overlapping) {
      if (!instance.active) continue;
      const def = instance.def;

      switch (def.effectType) {
        case 'damage': {
          // %HP damage per second
          instance.tickTimer += dt;
          if (instance.tickTimer >= 0.5) {
            instance.tickTimer -= 0.5;
            const dmg = Math.max(1, Math.floor(player.health.max * (def.damagePercent ?? 0.02) * 0.5));
            player.health.current -= dmg;
            if (player.health.current < 1) player.health.current = 1;
            spawnDamageNumber(player.position.x, player.position.y - 10, dmg, def.color);
          }
          break;
        }
        case 'burn': {
          // Apply Burn status + %HP damage
          applyStatus(player, StatusType.Burn);
          instance.tickTimer += dt;
          if (instance.tickTimer >= 0.5) {
            instance.tickTimer -= 0.5;
            const dmg = Math.max(1, Math.floor(player.health.max * (def.damagePercent ?? 0.03) * 0.5));
            player.health.current -= dmg;
            if (player.health.current < 1) player.health.current = 1;
            spawnDamageNumber(player.position.x, player.position.y - 10, dmg, 0xff4400);
          }
          break;
        }
        case 'slow': {
          // Apply Slow status
          applyStatus(player, StatusType.Slow);
          break;
        }
        case 'chill': {
          // Apply Chill status + also chill enemies on the same tiles
          applyStatus(player, StatusType.Chill);
          break;
        }
        case 'armor_reduce': {
          armorReductionActive = true;
          armorReductionAmount = Math.max(armorReductionAmount, def.armorReduction ?? 0.3);
          break;
        }
        case 'cd_freeze': {
          cdFreezeActive = true;
          break;
        }
        case 'pull': {
          applyStatus(player, StatusType.Slow);
          break;
        }
      }
    }
  }

  // Handle frost patches chilling enemies that walk through them
  updateFrostPatchEnemyChill(dt);

  // Handle regen_spore type: heal enemies standing on those tiles
  for (const instance of hazardInstances) {
    if (!instance.active) continue;
    if (instance.def.effectType !== 'heal_enemy') continue;

    const enemies = world.with('enemy', 'position', 'health');
    for (const enemy of enemies.entities) {
      if (enemy.dead) continue;
      const etx = Math.floor(enemy.position.x / TILE_SIZE);
      const ety = Math.floor(enemy.position.y / TILE_SIZE);
      if (instance.tiles.has(tileKey(etx, ety))) {
        const healPerSec = (instance.def.enemyHealPercent ?? 0.02) * enemy.health.max;
        enemy.health.current = Math.min(
          enemy.health.max,
          enemy.health.current + healPerSec * dt,
        );
      }
    }
  }

  // Handle global hazards
  for (const def of globalHazardDefs) {
    if (def.effectType === 'drain') {
      _globalDrainTimer += dt;
      if (_globalDrainTimer >= 0.5) {
        _globalDrainTimer -= 0.5;
        const dmg = Math.max(1, Math.floor(player.health.max * (def.damagePercent ?? 0.01) * 0.5));
        player.health.current -= dmg;
        if (player.health.current < 1) player.health.current = 1;
        spawnDamageNumber(player.position.x, player.position.y - 10, dmg, 0xff0000);
      }
    }
  }

  // Store active debuffs on a module-level for external systems to query
  _activeArmorReduction = armorReductionActive ? armorReductionAmount : 0;
  _activeCdFreeze = cdFreezeActive;

  // Update pulse animations
  for (const instance of hazardInstances) {
    if (instance.def.pulse) {
      instance.pulseTimer += dt;
      renderHazardGraphics(instance);
    }
  }

  // Update specialized hazards
  updateVoidRiftProjectileDeflection(dt);
  updateLightningRods(dt, player);
  updateHeatVents(dt, player);
  updateGlitchTiles(dt, player);
  updateWarpPads(dt, player);
  updateVineSnares(dt, player);
  updateCryoBarriers(dt);
  updateDarknessOverlay(player);
  updateChromaticShift(dt, player);
  updatePlayerRoot(dt, player);
}

// ── Void Rift Projectile Deflection ─────────────────────────────────

function updateVoidRiftProjectileDeflection(_dt: number): void {
  // Find all void rift instances
  const voidRifts = hazardInstances.filter(h => h.def.id === 'void_rifts' && h.active);
  if (voidRifts.length === 0) return;

  // Check player projectiles passing through void rifts
  const projectiles = world.with('projectile', 'position', 'velocity');
  for (const proj of projectiles.entities) {
    const ptx = Math.floor(proj.position.x / TILE_SIZE);
    const pty = Math.floor(proj.position.y / TILE_SIZE);
    const key = tileKey(ptx, pty);

    for (const rift of voidRifts) {
      if (!rift.tiles.has(key)) continue;

      // Find center of this rift for pull direction
      let cx = 0, cy = 0, count = 0;
      for (const tKey of rift.tiles) {
        const [tx, ty] = tKey.split(',').map(Number);
        cx += tx;
        cy += ty;
        count++;
      }
      if (count === 0) continue;
      cx = (cx / count) * TILE_SIZE + TILE_SIZE / 2;
      cy = (cy / count) * TILE_SIZE + TILE_SIZE / 2;

      // Deflect projectile slightly toward rift center
      const dx = cx - proj.position.x;
      const dy = cy - proj.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const pullStrength = 40; // px/s deflection
        proj.velocity.x += (dx / dist) * pullStrength * _dt;
        proj.velocity.y += (dy / dist) * pullStrength * _dt;
      }
      break; // only deflect by one rift per frame
    }
  }
}

// ── Frost Patch Enemy Chill ─────────────────────────────────────────

function updateFrostPatchEnemyChill(_dt: number): void {
  // Find frost patch instances
  const frostPatches = hazardInstances.filter(h => h.def.id === 'frost_patches' && h.active);
  if (frostPatches.length === 0) return;

  const enemies = world.with('enemy', 'position', 'health');
  for (const enemy of enemies.entities) {
    if (enemy.dead) continue;
    const etx = Math.floor(enemy.position.x / TILE_SIZE);
    const ety = Math.floor(enemy.position.y / TILE_SIZE);
    const eKey = tileKey(etx, ety);

    for (const patch of frostPatches) {
      if (patch.tiles.has(eKey)) {
        applyStatus(enemy, StatusType.Chill);
        break;
      }
    }
  }
}

// ── Lightning Rods ──────────────────────────────────────────────────

function updateLightningRods(dt: number, player: Entity): void {
  if (lightningRods.length === 0) return;

  // Lazy-create lightning arc graphics
  if (!lightningGfx) {
    lightningGfx = new Graphics();
    game.effectLayer.addChild(lightningGfx);
  }
  lightningGfx.clear();

  for (const rod of lightningRods) {
    rod.dischargeTimer += dt;
    if (rod.dischargeTimer < 4) continue; // discharge every 4s
    rod.dischargeTimer -= 4;

    // Chain lightning: find nearest entity within 5 tiles (160px)
    const maxRange = 5 * TILE_SIZE;
    const maxRangeSq = maxRange * maxRange;
    const chainRange = 3 * TILE_SIZE;
    const chainRangeSq = chainRange * chainRange;

    // Gather all hittable entities (player + enemies)
    const allTargets: { entity: Entity; x: number; y: number }[] = [];
    if (player.position && player.health && !player.dead) {
      allTargets.push({ entity: player, x: player.position.x, y: player.position.y });
    }
    const enemies = world.with('enemy', 'position', 'health');
    for (const e of enemies.entities) {
      if (e.dead) continue;
      allTargets.push({ entity: e, x: e.position.x, y: e.position.y });
    }

    // Find first target (closest to rod within 5 tiles)
    let firstTarget: { entity: Entity; x: number; y: number } | null = null;
    let bestDist = maxRangeSq;
    for (const t of allTargets) {
      const d = distSq(rod.worldX, rod.worldY, t.x, t.y);
      if (d < bestDist) {
        bestDist = d;
        firstTarget = t;
      }
    }
    if (!firstTarget) continue;

    // Chain up to 3 bounces
    const hitTargets: { entity: Entity; x: number; y: number }[] = [firstTarget];
    const hitSet = new Set<Entity>([firstTarget.entity]);
    let lastPos = { x: firstTarget.x, y: firstTarget.y };

    for (let bounce = 0; bounce < 2; bounce++) {
      let nextTarget: { entity: Entity; x: number; y: number } | null = null;
      let nextDist = chainRangeSq;
      for (const t of allTargets) {
        if (hitSet.has(t.entity)) continue;
        const d = distSq(lastPos.x, lastPos.y, t.x, t.y);
        if (d < nextDist) {
          nextDist = d;
          nextTarget = t;
        }
      }
      if (!nextTarget) break;
      hitTargets.push(nextTarget);
      hitSet.add(nextTarget.entity);
      lastPos = { x: nextTarget.x, y: nextTarget.y };
    }

    // Apply damage and draw arcs
    let prevX = rod.worldX;
    let prevY = rod.worldY;

    for (const target of hitTargets) {
      if (target.entity.health) {
        const dmg = Math.max(1, Math.floor(target.entity.health.max * 0.05));
        target.entity.health.current -= dmg;
        if (target.entity.health.current < 1 && target.entity.player) {
          target.entity.health.current = 1;
        }
        spawnDamageNumber(target.x, target.y - 10, dmg, 0xffdd44);
      }

      // Draw jagged lightning arc
      drawLightningArc(lightningGfx!, prevX, prevY, target.x, target.y);
      prevX = target.x;
      prevY = target.y;
    }
  }
}

function drawLightningArc(g: Graphics, x1: number, y1: number, x2: number, y2: number): void {
  const segments = 5;
  const jitter = 8;
  let px = x1;
  let py = y1;

  g.moveTo(x1, y1);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    let nx = x1 + (x2 - x1) * t;
    let ny = y1 + (y2 - y1) * t;
    if (i < segments) {
      nx += (Math.random() - 0.5) * jitter * 2;
      ny += (Math.random() - 0.5) * jitter * 2;
    }
    g.lineTo(nx, ny);
    px = nx;
    py = ny;
  }
  g.stroke({ width: 2, color: 0xffff44, alpha: 0.9 });

  // Glow pass
  g.moveTo(x1, y1);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * jitter;
    const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * jitter;
    g.lineTo(i === segments ? x2 : nx, i === segments ? y2 : ny);
  }
  g.stroke({ width: 4, color: 0xffdd44, alpha: 0.3 });
}

// ── Heat Vents ──────────────────────────────────────────────────────

function updateHeatVents(dt: number, player: Entity): void {
  if (heatVents.length === 0) return;

  for (const vent of heatVents) {
    const t = (vent.cycleTimer + vent.cycleOffset) % 5;
    vent.cycleTimer += dt;

    const px = vent.tileX * TILE_SIZE;
    const py = vent.tileY * TILE_SIZE;
    vent.gfx.clear();

    if (t >= 3.7 && t < 4.0) {
      // Telegraph phase: bright orange glow
      vent.gfx.rect(px, py, TILE_SIZE, TILE_SIZE)
        .fill({ color: 0xff8800, alpha: 0.4 + 0.3 * Math.sin(t * 20) });

      // Also show the 2-tile line
      for (let step = 1; step <= 2; step++) {
        const lx = vent.tileX + vent.dirX * step;
        const ly = vent.tileY + vent.dirY * step;
        vent.gfx.rect(lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          .fill({ color: 0xff6600, alpha: 0.2 + 0.1 * Math.sin(t * 20) });
      }
    } else if (t >= 4.0 && t < 4.3) {
      // Burst phase: flame damage in 2-tile line
      vent.gfx.rect(px, py, TILE_SIZE, TILE_SIZE)
        .fill({ color: 0xff4400, alpha: 0.6 });

      for (let step = 1; step <= 2; step++) {
        const lx = vent.tileX + vent.dirX * step;
        const ly = vent.tileY + vent.dirY * step;
        vent.gfx.rect(lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          .fill({ color: 0xff2200, alpha: 0.5 });
      }

      // Check player overlap (the vent tile + 2 tiles in direction)
      if (player.position && player.health) {
        for (let step = 0; step <= 2; step++) {
          const checkX = vent.tileX + vent.dirX * step;
          const checkY = vent.tileY + vent.dirY * step;
          const pTileX = Math.floor(player.position.x / TILE_SIZE);
          const pTileY = Math.floor(player.position.y / TILE_SIZE);
          if (pTileX === checkX && pTileY === checkY) {
            // Only damage once per burst (use a flag via tickTimer-like approach)
            // We use the burst phase window (0.3s) but only on frame entry
            if (t < 4.0 + dt * 2) {
              const dmg = Math.max(1, Math.floor(player.health.max * 0.08));
              player.health.current -= dmg;
              if (player.health.current < 1) player.health.current = 1;
              spawnDamageNumber(player.position.x, player.position.y - 10, dmg, 0xff4400);
              applyStatus(player, StatusType.Burn);
            }
            break;
          }
        }

        // Also damage enemies at half rate
        const enemies = world.with('enemy', 'position', 'health');
        if (t < 4.0 + dt * 2) {
          for (const enemy of enemies.entities) {
            if (enemy.dead) continue;
            for (let step = 0; step <= 2; step++) {
              const checkX = vent.tileX + vent.dirX * step;
              const checkY = vent.tileY + vent.dirY * step;
              const eTileX = Math.floor(enemy.position.x / TILE_SIZE);
              const eTileY = Math.floor(enemy.position.y / TILE_SIZE);
              if (eTileX === checkX && eTileY === checkY) {
                const dmg = Math.max(1, Math.floor(enemy.health.max * 0.04));
                enemy.health.current -= dmg;
                spawnDamageNumber(enemy.position.x, enemy.position.y - 10, dmg, 0xff4400);
                break;
              }
            }
          }
        }
      }
    } else {
      // Idle: subtle vent marker
      vent.gfx.rect(px + 8, py + 8, 16, 16)
        .fill({ color: 0xff6600, alpha: 0.15 });
    }
  }
}

// ── Glitch Tiles ────────────────────────────────────────────────────

function updateGlitchTiles(dt: number, player: Entity): void {
  if (glitchTiles.length === 0 || !_cachedDungeon || !glitchGfx) return;

  let needsPathfindingRebuild = false;
  let needsMapRerender = false;

  glitchGfx.clear();

  for (const gt of glitchTiles) {
    gt.timer += dt;

    const timeUntilToggle = gt.interval - (gt.timer % gt.interval);
    gt.telegraphing = timeUntilToggle < 1.0;

    if (gt.timer >= gt.interval) {
      gt.timer -= gt.interval;
      gt.interval = 8 + Math.random() * 4; // re-randomize

      // Toggle floor/wall
      const wantWall = !gt.isWall;

      // Safety: don't toggle to wall if it would create a chokepoint
      // (check that at least 2 adjacent tiles remain walkable)
      if (wantWall && _cachedDungeon.tiles[gt.tileY]) {
        let adjFloor = 0;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
        for (const [dx, dy] of dirs) {
          const nx = gt.tileX + dx;
          const ny = gt.tileY + dy;
          if (ny >= 0 && ny < _cachedDungeon.height && nx >= 0 && nx < _cachedDungeon.width
            && _cachedDungeon.tiles[ny][nx] === 0) {
            adjFloor++;
          }
        }
        if (adjFloor < 3) {
          // Skip toggle — would create a potential blockage
          gt.timer = 0;
          continue;
        }
      }

      gt.isWall = wantWall;
      const newTile = gt.isWall ? 1 : 0;

      if (_cachedDungeon.tiles[gt.tileY] && _cachedDungeon.tiles[gt.tileY][gt.tileX] !== undefined) {
        _cachedDungeon.tiles[gt.tileY][gt.tileX] = newTile;
        game.tileMap.tiles[gt.tileY][gt.tileX] = newTile;
        needsPathfindingRebuild = true;
        needsMapRerender = true;
      }

      // If entity is standing on a tile that just became a wall, push them out
      if (gt.isWall) {
        pushEntitiesOffTile(gt.tileX, gt.tileY);
      }
    }

    // Render glitch tile overlay
    const px = gt.tileX * TILE_SIZE;
    const py = gt.tileY * TILE_SIZE;

    if (gt.telegraphing) {
      // Flickering telegraph
      const flicker = Math.sin(gt.timer * 30) > 0;
      const color = gt.isWall ? 0x000000 : 0xaa44ff;
      glitchGfx.rect(px, py, TILE_SIZE, TILE_SIZE)
        .fill({ color, alpha: flicker ? 0.4 : 0.1 });
    } else if (!gt.isWall) {
      // Normal glitch floor overlay
      const noise = 0.1 + 0.08 * Math.sin(gt.timer * 3 + gt.tileX * 7 + gt.tileY * 13);
      glitchGfx.rect(px, py, TILE_SIZE, TILE_SIZE)
        .fill({ color: 0xaa44ff, alpha: noise });
    }
  }

  if (needsMapRerender) {
    // Re-render the tilemap
    game.tileMap.render(game.worldLayer);
  }

  if (needsPathfindingRebuild) {
    // Invalidate flow field cache so it rebuilds next frame with new tile data
    invalidateFlowField();
  }
}

function pushEntitiesOffTile(tileX: number, tileY: number): void {
  const worldCX = tileX * TILE_SIZE + TILE_SIZE / 2;
  const worldCY = tileY * TILE_SIZE + TILE_SIZE / 2;

  const movers = world.with('position', 'velocity');
  for (const entity of movers.entities) {
    if (entity.projectile || entity.enemyProjectile) continue;
    const etx = Math.floor(entity.position.x / TILE_SIZE);
    const ety = Math.floor(entity.position.y / TILE_SIZE);
    if (etx !== tileX || ety !== tileY) continue;

    // Push to nearest adjacent floor tile
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const nx = tileX + dx;
      const ny = tileY + dy;
      if (_cachedDungeon && _cachedDungeon.tiles[ny]?.[nx] === 0) {
        entity.position.x = nx * TILE_SIZE + TILE_SIZE / 2;
        entity.position.y = ny * TILE_SIZE + TILE_SIZE / 2;
        break;
      }
    }
  }
}

// ── Warp Pads ───────────────────────────────────────────────────────

function updateWarpPads(dt: number, player: Entity): void {
  if (warpPads.length === 0) return;

  for (const pad of warpPads) {
    pad.pulseTimer += dt;

    // Tick cooldowns
    for (const [entity, cd] of pad.cooldowns.entries()) {
      const newCd = cd - dt;
      if (newCd <= 0) {
        pad.cooldowns.delete(entity);
      } else {
        pad.cooldowns.set(entity, newCd);
      }
    }

    // Check player teleportation
    if (player.position && !pad.cooldowns.has(player as object)) {
      const ptx = Math.floor(player.position.x / TILE_SIZE);
      const pty = Math.floor(player.position.y / TILE_SIZE);

      if (ptx === pad.tile1.x && pty === pad.tile1.y) {
        player.position.x = pad.tile2.x * TILE_SIZE + TILE_SIZE / 2;
        player.position.y = pad.tile2.y * TILE_SIZE + TILE_SIZE / 2;
        pad.cooldowns.set(player as object, 2);
      } else if (ptx === pad.tile2.x && pty === pad.tile2.y) {
        player.position.x = pad.tile1.x * TILE_SIZE + TILE_SIZE / 2;
        player.position.y = pad.tile1.y * TILE_SIZE + TILE_SIZE / 2;
        pad.cooldowns.set(player as object, 2);
      }
    }

    // Check enemy teleportation
    const enemies = world.with('enemy', 'position');
    for (const enemy of enemies.entities) {
      if (pad.cooldowns.has(enemy as object)) continue;
      const etx = Math.floor(enemy.position.x / TILE_SIZE);
      const ety = Math.floor(enemy.position.y / TILE_SIZE);

      if (etx === pad.tile1.x && ety === pad.tile1.y) {
        enemy.position.x = pad.tile2.x * TILE_SIZE + TILE_SIZE / 2;
        enemy.position.y = pad.tile2.y * TILE_SIZE + TILE_SIZE / 2;
        pad.cooldowns.set(enemy as object, 2);
      } else if (etx === pad.tile2.x && ety === pad.tile2.y) {
        enemy.position.x = pad.tile1.x * TILE_SIZE + TILE_SIZE / 2;
        enemy.position.y = pad.tile1.y * TILE_SIZE + TILE_SIZE / 2;
        pad.cooldowns.set(enemy as object, 2);
      }
    }

    // Render warp pads
    pad.gfx.clear();
    const pulseAlpha = 0.2 + 0.1 * Math.sin(pad.pulseTimer * 2);

    for (const tile of [pad.tile1, pad.tile2]) {
      const px = tile.x * TILE_SIZE;
      const py = tile.y * TILE_SIZE;
      // Purple glowing circle
      const cx = px + TILE_SIZE / 2;
      const cy = py + TILE_SIZE / 2;
      pad.gfx.circle(cx, cy, TILE_SIZE * 0.7)
        .fill({ color: 0xaa44ff, alpha: pulseAlpha });
      pad.gfx.circle(cx, cy, TILE_SIZE * 0.4)
        .fill({ color: 0xff44ff, alpha: pulseAlpha * 1.5 });
    }
  }
}

// ── Vine Snares ─────────────────────────────────────────────────────

function updateVineSnares(dt: number, player: Entity): void {
  if (vineSnares.length === 0) return;

  for (const snare of vineSnares) {
    // Tick cooldown
    if (snare.cooldown > 0) {
      snare.cooldown -= dt;
      if (snare.cooldown < 0) snare.cooldown = 0;
    }

    // Clear triggered state after cooldown
    if (snare.triggered && snare.cooldown <= 0) {
      snare.triggered = false;
    }

    const px = snare.tileX * TILE_SIZE;
    const py = snare.tileY * TILE_SIZE;
    snare.gfx.clear();

    if (!player.position) continue;

    // Calculate distance to player for visibility
    const distToPlayer = Math.sqrt(
      distSq(
        snare.tileX * TILE_SIZE + TILE_SIZE / 2,
        snare.tileY * TILE_SIZE + TILE_SIZE / 2,
        player.position.x,
        player.position.y,
      ),
    );

    // Only visible within 4 tiles (128px)
    const revealDist = 4 * TILE_SIZE;
    const fadeAlpha = distToPlayer < revealDist
      ? 0.3 * (1 - distToPlayer / revealDist)
      : 0;

    if (snare.triggered) {
      // Triggered visual: bright green
      snare.gfx.rect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8)
        .fill({ color: 0x22ff44, alpha: 0.4 });
    } else if (fadeAlpha > 0.01) {
      // Hidden but near player: show vine tendrils
      snare.gfx.rect(px + 6, py + 6, TILE_SIZE - 12, TILE_SIZE - 12)
        .fill({ color: 0x226644, alpha: fadeAlpha });
    }

    // Check trigger
    if (snare.cooldown <= 0 && !snare.triggered && player.position) {
      const ptx = Math.floor(player.position.x / TILE_SIZE);
      const pty = Math.floor(player.position.y / TILE_SIZE);
      if (ptx === snare.tileX && pty === snare.tileY) {
        snare.triggered = true;
        snare.cooldown = 3; // 3s cooldown before can trigger again
        _playerRootTimer = 1.0; // Root player for 1 second
        spawnDamageNumber(player.position.x, player.position.y - 10, 0, 0x22ff44);
      }
    }
  }
}

// ── Player Root (from vine snares) ──────────────────────────────────

function updatePlayerRoot(dt: number, player: Entity): void {
  if (_playerRootTimer <= 0) return;

  _playerRootTimer -= dt;

  // Zero out velocity to prevent movement (but skills still work)
  if (player.velocity) {
    player.velocity.x = 0;
    player.velocity.y = 0;
  }
}

// ── Cryo Barriers ───────────────────────────────────────────────────

function updateCryoBarriers(_dt: number): void {
  if (cryoBarriers.length === 0) return;

  for (const barrier of cryoBarriers) {
    if (barrier.hp <= 0) continue;

    const px = barrier.tileX * TILE_SIZE;
    const py = barrier.tileY * TILE_SIZE;
    barrier.gfx.clear();

    // Draw ice wall
    const hpFrac = barrier.hp / barrier.maxHP;
    const alpha = 0.4 + 0.3 * hpFrac;
    barrier.gfx.rect(px, py, TILE_SIZE, TILE_SIZE)
      .fill({ color: 0xaaeeff, alpha });

    // Crack lines as HP decreases
    if (hpFrac < 0.7) {
      barrier.gfx
        .moveTo(px + 6, py + 4).lineTo(px + 16, py + 16)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
    }
    if (hpFrac < 0.4) {
      barrier.gfx
        .moveTo(px + 16, py + 16).lineTo(px + 26, py + 28)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.5 });
      barrier.gfx
        .moveTo(px + 20, py + 8).lineTo(px + 10, py + 24)
        .stroke({ width: 1, color: 0xffffff, alpha: 0.3 });
    }
  }
}

// ── Darkness Overlay ────────────────────────────────────────────────

function updateDarknessOverlay(player: Entity): void {
  if (!darknessActive || !darknessOverlay || !player.position) return;

  darknessOverlay.clear();

  // Convert player world position to screen position
  // The hudLayer is in screen space, so we need to account for camera offset
  const camX = game.worldLayer.x;
  const camY = game.worldLayer.y;
  const screenPX = player.position.x + camX;
  const screenPY = player.position.y + camY;

  // Draw full screen dark overlay with a radial cutout
  // We draw a large dark rect and then punch a hole with a lighter center
  // Since PixiJS Graphics doesn't do gradient masks easily, we approximate
  // with concentric rings from dark to transparent
  const radius = darknessRadius;
  const steps = 12;

  // Full dark background
  darknessOverlay.rect(-200, -200, SCREEN_W + 400, SCREEN_H + 400)
    .fill({ color: 0x000000, alpha: 0.92 });

  // Cut out visibility circle with concentric rings (lighter toward center)
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = radius * (0.7 + 0.5 * t); // outer falloff ring
    const alpha = 0.92 * t;
    darknessOverlay.circle(screenPX, screenPY, r)
      .fill({ color: 0x000000, alpha: Math.max(0, 0.92 - alpha) });
  }

  // Clear center (bright area)
  darknessOverlay.circle(screenPX, screenPY, radius * 0.6)
    .fill({ color: 0x000000, alpha: 0 });
}

// ── Chromatic Shift ─────────────────────────────────────────────────

type ChromaticPhase = 'neutral' | 'fire' | 'ice' | 'lightning';

function getChromaticPhase(timer: number): ChromaticPhase {
  const cycle = timer % 30;
  if (cycle < 5) return 'neutral';
  if (cycle < 10) return 'fire';
  if (cycle < 15) return 'neutral';
  if (cycle < 20) return 'ice';
  if (cycle < 25) return 'neutral';
  return 'lightning';
}

let _chromaticDmgTimer = 0;

function updateChromaticShift(dt: number, player: Entity): void {
  if (!chromaticActive) return;

  chromaticTimer += dt;
  const phase = getChromaticPhase(chromaticTimer);

  // Apply phase effects
  if (phase === 'fire') {
    // 2% max HP/sec fire damage
    _chromaticDmgTimer += dt;
    if (_chromaticDmgTimer >= 0.5 && player.health && player.position) {
      _chromaticDmgTimer -= 0.5;
      const dmg = Math.max(1, Math.floor(player.health.max * 0.02 * 0.5));
      player.health.current -= dmg;
      if (player.health.current < 1) player.health.current = 1;
      spawnDamageNumber(player.position.x, player.position.y - 10, dmg, 0xff4400);
      applyStatus(player, StatusType.Burn);
    }
  } else if (phase === 'ice') {
    // Global chill to all entities
    applyStatus(player, StatusType.Chill);
    const enemies = world.with('enemy', 'position', 'health');
    for (const enemy of enemies.entities) {
      if (!enemy.dead) applyStatus(enemy, StatusType.Chill);
    }
    _chromaticDmgTimer = 0;
  } else if (phase === 'lightning') {
    // Random lightning arcs every second
    _chromaticDmgTimer += dt;
    if (_chromaticDmgTimer >= 0.33 && player.health && player.position) {
      _chromaticDmgTimer -= 0.33;

      // Pick a random spot near player or enemy
      const targets: { x: number; y: number; entity: Entity }[] = [];
      if (player.position) {
        targets.push({ x: player.position.x, y: player.position.y, entity: player });
      }
      const enemies = world.with('enemy', 'position', 'health');
      for (const e of enemies.entities) {
        if (!e.dead) targets.push({ x: e.position.x, y: e.position.y, entity: e });
      }

      if (targets.length > 0 && Math.random() < 0.5) {
        const target = targets[Math.floor(Math.random() * targets.length)];
        if (target.entity.health) {
          const dmg = Math.max(1, Math.floor(target.entity.health.max * 0.06));
          target.entity.health.current -= dmg;
          if (target.entity.health.current < 1 && target.entity.player) {
            target.entity.health.current = 1;
          }
          spawnDamageNumber(target.x, target.y - 10, dmg, 0xffff44);
        }
      }
    }
  } else {
    _chromaticDmgTimer = 0;
  }

  // Render phase indicator overlay
  if (chromaticGfx) {
    chromaticGfx.clear();
    let overlayColor = 0x000000;
    let overlayAlpha = 0;

    if (phase === 'fire') {
      overlayColor = 0xff4400;
      overlayAlpha = 0.05;
    } else if (phase === 'ice') {
      overlayColor = 0x88ccff;
      overlayAlpha = 0.05;
    } else if (phase === 'lightning') {
      overlayColor = 0xffff44;
      overlayAlpha = 0.04;
    }

    if (overlayAlpha > 0) {
      chromaticGfx.rect(0, 0, SCREEN_W, SCREEN_H)
        .fill({ color: overlayColor, alpha: overlayAlpha });
    }
  }
}

// ── External Query API ─────────────────────────────────────────────

let _activeArmorReduction = 0;
let _activeCdFreeze = false;
let _globalDrainTimer = 0;

/**
 * Returns the current armor reduction fraction (0-1) from hazard overlap.
 * Used by ComputedStats to reduce effective armor.
 */
export function getHazardArmorReduction(): number {
  return _activeArmorReduction;
}

/**
 * Returns true if the player is standing on a cooldown-freeze hazard tile.
 * Used by SkillSystem to pause cooldown ticking.
 */
export function isHazardCdFrozen(): boolean {
  return _activeCdFreeze;
}

/**
 * Returns true if any hazards are currently placed on the map.
 */
export function hasActiveHazards(): boolean {
  return hazardInstances.length > 0 || globalHazardDefs.length > 0
    || lightningRods.length > 0 || heatVents.length > 0
    || glitchTiles.length > 0 || warpPads.length > 0
    || vineSnares.length > 0 || cryoBarriers.length > 0;
}

/**
 * Returns true if the player is currently rooted by a vine snare.
 * Used by MovementSystem to zero velocity while still allowing skills.
 */
export function isPlayerRooted(): boolean {
  return _playerRootTimer > 0;
}

/**
 * Get the current chromatic shift phase for UI display.
 */
export function getChromaticPhaseInfo(): { active: boolean; phase: string; timer: number } {
  if (!chromaticActive) return { active: false, phase: 'none', timer: 0 };
  const phase = getChromaticPhase(chromaticTimer);
  const cycle = chromaticTimer % 30;
  const phaseStart = phase === 'neutral'
    ? (cycle < 5 ? 0 : cycle < 15 ? 10 : 20)
    : (phase === 'fire' ? 5 : phase === 'ice' ? 15 : 25);
  const remaining = phaseStart + 5 - cycle;
  return { active: true, phase, timer: remaining };
}

/**
 * Hit a cryo barrier at the given tile. Returns true if it was destroyed.
 * Called from CollisionSystem when projectiles hit barrier tiles.
 */
export function hitCryoBarrier(tileX: number, tileY: number, damage: number): boolean {
  const key = tileKey(tileX, tileY);
  const barrier = cryoBarrierLookup.get(key);
  if (!barrier || barrier.hp <= 0) return false;

  barrier.hp -= damage;
  if (barrier.hp <= 0) {
    barrier.hp = 0;
    barrier.gfx.clear();
    // The barrier no longer blocks movement since it's just a graphics overlay.
    // Spawn a small frost patch effect where it was
    spawnDamageNumber(
      tileX * TILE_SIZE + TILE_SIZE / 2,
      tileY * TILE_SIZE + TILE_SIZE / 2,
      0,
      0xaaeeff,
    );
    cryoBarrierLookup.delete(key);
    return true;
  }
  return false;
}

/**
 * Check if a tile has an active cryo barrier (blocks movement).
 */
export function hasCryoBarrier(tileX: number, tileY: number): boolean {
  const key = tileKey(tileX, tileY);
  const barrier = cryoBarrierLookup.get(key);
  return barrier !== undefined && barrier.hp > 0;
}

/**
 * Remove all hazard instances and clean up graphics. Called on map exit
 * (enterTown) or before placing new hazards.
 */
export function clearHazards(): void {
  for (const instance of hazardInstances) {
    instance.gfx.removeFromParent();
    instance.gfx.destroy();
  }
  hazardInstances = [];
  globalHazardDefs = [];
  hazardTileLookup = new Map();
  _activeArmorReduction = 0;
  _activeCdFreeze = false;
  _globalDrainTimer = 0;
  currentTier = 1;
  _playerRootTimer = 0;
  _chromaticDmgTimer = 0;

  // Clean up lightning rods
  for (const rod of lightningRods) {
    rod.gfx.removeFromParent();
    rod.gfx.destroy();
  }
  lightningRods = [];
  if (lightningGfx) {
    lightningGfx.removeFromParent();
    lightningGfx.destroy();
    lightningGfx = null;
  }

  // Clean up heat vents
  for (const vent of heatVents) {
    vent.gfx.removeFromParent();
    vent.gfx.destroy();
  }
  heatVents = [];

  // Clean up glitch tiles
  glitchTiles = [];
  if (glitchGfx) {
    glitchGfx.removeFromParent();
    glitchGfx.destroy();
    glitchGfx = null;
  }

  // Clean up warp pads
  for (const pad of warpPads) {
    pad.gfx.removeFromParent();
    pad.gfx.destroy();
  }
  warpPads = [];

  // Clean up vine snares
  for (const snare of vineSnares) {
    snare.gfx.removeFromParent();
    snare.gfx.destroy();
  }
  vineSnares = [];

  // Clean up cryo barriers
  for (const barrier of cryoBarriers) {
    barrier.gfx.removeFromParent();
    barrier.gfx.destroy();
  }
  cryoBarriers = [];
  cryoBarrierLookup = new Map();

  // Clean up darkness
  if (darknessOverlay) {
    darknessOverlay.removeFromParent();
    darknessOverlay.destroy();
    darknessOverlay = null;
  }
  darknessActive = false;

  // Clean up chromatic
  chromaticActive = false;
  chromaticTimer = 0;
  if (chromaticGfx) {
    chromaticGfx.removeFromParent();
    chromaticGfx.destroy();
    chromaticGfx = null;
  }

  _cachedDungeon = null;
}
