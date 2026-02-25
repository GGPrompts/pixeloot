/**
 * Map Post-Processing Pipeline
 *
 * Takes raw DungeonData from the Digger and a MapDesign config, then transforms
 * the layout into a themed variant with room shape carving, corridor width
 * adjustment, environmental features, and special room designation.
 */

import type { DungeonData, DungeonRoom } from './DungeonGenerator';
import {
  TILE_FLOOR, TILE_WALL, TILE_PILLAR, TILE_CRACKED_FLOOR,
  TILE_PIT, TILE_SLOW_GROUND, TILE_DESTRUCTIBLE, TILE_BRIDGE,
} from './TileMap';

// ── Design Types (mirroring designs/maps.ts interfaces at runtime) ──

export interface MapDesignConfig {
  id: string;
  postProcessing: {
    diggerOverrides: {
      roomWidth?: [number, number];
      roomHeight?: [number, number];
      corridorLength?: [number, number];
    };
    corridorWidth: number;
    steps: string[];
  };
  roomPatterns: Array<{
    name: string;
    widthRange: [number, number];
    heightRange: [number, number];
    shape: 'rectangle' | 'circular' | 'cross' | 'L-shaped' | 'diamond' | 'irregular';
    weight: number;
  }>;
  environmentalFeatures: Array<{
    name: string;
    tileType: number;
    placement: string;
    countPerRoom: [number, number];
  }>;
  specialRooms: Array<{
    name: string;
    minWidth: number;
    minHeight: number;
    selectionRule: string;
    modifications: string;
    purpose: string;
  }>;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Apply post-processing transforms to raw dungeon data based on a layout design.
 * Modifies tiles in-place and returns the same DungeonData reference.
 */
export function postProcessDungeon(
  data: DungeonData,
  design: MapDesignConfig,
  tier: number,
): DungeonData {
  const { tiles, width, height, rooms, spawn } = data;

  // Step 1: Corridor width adjustment
  if (design.postProcessing.corridorWidth !== 3) {
    adjustCorridorWidth(tiles, width, height, rooms, design.postProcessing.corridorWidth);
  }

  // Step 2: Room shape stamping
  stampRoomShapes(tiles, width, height, rooms, design.roomPatterns);

  // Step 3: Layout-specific transforms (before environmental features)
  applyLayoutSteps(tiles, width, height, rooms, spawn, design, tier);

  // Step 4: Environmental feature placement
  placeEnvironmentalFeatures(tiles, width, height, rooms, spawn, design, tier);

  // Step 5: Special room processing
  processSpecialRooms(tiles, width, height, rooms, spawn, design);

  return data;
}

// ── Layout-Specific Steps ────────────────────────────────────────────

/**
 * Dispatch layout-specific post-processing steps based on design.postProcessing.steps.
 * Steps are string identifiers that trigger specialized transforms.
 */
function applyLayoutSteps(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  design: MapDesignConfig,
  _tier: number,
): void {
  for (const step of design.postProcessing.steps) {
    switch (step) {
      case 'abyss-corridors-to-pits':
        convertCorridorsToPits(tiles, width, height, rooms, spawn);
        break;
      case 'abyss-room-pit-borders':
        addRoomPitBorders(tiles, width, height, rooms, spawn);
        break;
      case 'catacombs-pit-corridors':
        placePitSegmentsInCorridors(tiles, width, height, rooms, spawn);
        break;
      case 'catacombs-slow-ring':
        placeSlowGroundRing(tiles, rooms, spawn);
        break;
      case 'warrens-extra-connections':
        addExtraConnections(tiles, width, height, rooms);
        break;
      case 'fractured-section-walls':
        placeSectionWalls(tiles, rooms, spawn);
        break;
      case 'crucible-ring-pillars':
        placeCrucibleRingPillars(tiles, rooms, spawn);
        break;
      case 'cathedral-merge-central':
        mergeCentralHall(tiles, width, height, rooms, spawn);
        break;
    }
  }
}

/**
 * Abyss Crossing: convert all corridor floor tiles to pits, then carve
 * 2-tile-wide bridge paths through them.
 */
function convertCorridorsToPits(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  // Identify corridor tiles (floor not in any room)
  const corridorTiles: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_FLOOR) continue;
      if (isInAnyRoom(x, y, rooms)) continue;
      corridorTiles.push({ x, y });
    }
  }

  // For each corridor tile, determine its primary direction (horizontal or vertical)
  // by checking which axis has more continuous floor tiles
  // First pass: mark all corridor tiles as pit
  for (const ct of corridorTiles) {
    if (Math.abs(ct.x - spawn.x) <= 2 && Math.abs(ct.y - spawn.y) <= 2) continue;
    tiles[ct.y][ct.x] = TILE_PIT;
  }

  // Second pass: carve bridge paths. For each corridor segment,
  // find the center line and place bridge tiles
  // Re-scan to find connected pit segments and carve bridges
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_PIT) continue;

      // Check if this pit tile is adjacent to a walkable room tile or bridge
      const adjRoom =
        isWalkableOrRoom(tiles, x - 1, y, rooms) ||
        isWalkableOrRoom(tiles, x + 1, y, rooms) ||
        isWalkableOrRoom(tiles, x, y - 1, rooms) ||
        isWalkableOrRoom(tiles, x, y + 1, rooms);

      if (!adjRoom) continue;

      // BFS from this pit tile to find bridge path to opposite room
      carveBridgePath(tiles, x, y, width, height, rooms);
    }
  }

  // Also convert walls between corridor pits to pits (aesthetic void)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_WALL) continue;
      if (isInAnyRoom(x, y, rooms)) continue;

      // Count adjacent pit/bridge tiles
      let adjPit = 0;
      if (tiles[y - 1]?.[x] === TILE_PIT || tiles[y - 1]?.[x] === TILE_BRIDGE) adjPit++;
      if (tiles[y + 1]?.[x] === TILE_PIT || tiles[y + 1]?.[x] === TILE_BRIDGE) adjPit++;
      if (tiles[y]?.[x - 1] === TILE_PIT || tiles[y]?.[x - 1] === TILE_BRIDGE) adjPit++;
      if (tiles[y]?.[x + 1] === TILE_PIT || tiles[y]?.[x + 1] === TILE_BRIDGE) adjPit++;

      if (adjPit >= 2) {
        tiles[y][x] = TILE_PIT;
      }
    }
  }
}

function isWalkableOrRoom(
  tiles: number[][],
  x: number,
  y: number,
  rooms: DungeonRoom[],
): boolean {
  if (!tiles[y]?.[x]) return false;
  const t = tiles[y][x];
  if (t === TILE_FLOOR || t === TILE_BRIDGE) {
    return isInAnyRoom(x, y, rooms) || t === TILE_BRIDGE;
  }
  return false;
}

/**
 * BFS from a pit tile adjacent to a room, carving a 1-tile bridge path
 * through pits to reach another room on the other side.
 */
function carveBridgePath(
  tiles: number[][],
  startX: number,
  startY: number,
  width: number,
  height: number,
  rooms: DungeonRoom[],
): void {
  // Simple approach: follow the pit in the dominant direction
  // Determine direction based on adjacent room position
  let dx = 0, dy = 0;

  if (isWalkableOrRoom(tiles, startX - 1, startY, rooms)) dx = 1;
  else if (isWalkableOrRoom(tiles, startX + 1, startY, rooms)) dx = -1;
  else if (isWalkableOrRoom(tiles, startX, startY - 1, rooms)) dy = 1;
  else if (isWalkableOrRoom(tiles, startX, startY + 1, rooms)) dy = -1;
  else return;

  let x = startX, y = startY;
  const maxSteps = 30;
  for (let i = 0; i < maxSteps; i++) {
    if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) break;

    if (tiles[y][x] === TILE_PIT) {
      tiles[y][x] = TILE_BRIDGE;
    }

    const nx = x + dx;
    const ny = y + dy;

    // Reached a room or edge?
    if (tiles[ny]?.[nx] === TILE_FLOOR && isInAnyRoom(nx, ny, rooms)) break;
    if (tiles[ny]?.[nx] === TILE_BRIDGE) break;

    // If next is pit, continue straight
    if (tiles[ny]?.[nx] === TILE_PIT) {
      x = nx;
      y = ny;
      continue;
    }

    // If next is wall, try to turn (follow corridor shape)
    if (dx !== 0) {
      // try turning vertical
      if (tiles[y + 1]?.[x] === TILE_PIT) { dy = 1; dx = 0; y++; }
      else if (tiles[y - 1]?.[x] === TILE_PIT) { dy = -1; dx = 0; y--; }
      else break;
    } else {
      // try turning horizontal
      if (tiles[y]?.[x + 1] === TILE_PIT) { dx = 1; dy = 0; x++; }
      else if (tiles[y]?.[x - 1] === TILE_PIT) { dx = -1; dy = 0; x--; }
      else break;
    }
  }
}

/**
 * Abyss Crossing: add a 1-tile pit border around rooms
 * where adjacent wall tiles can be converted.
 */
function addRoomPitBorders(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    // Skip spawn room
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;

    // Convert walls adjacent to room edges into pits
    for (let x = room.x1 - 1; x <= room.x2 + 1; x++) {
      for (const y of [room.y1 - 1, room.y2 + 1]) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (tiles[y][x] === TILE_WALL) {
          tiles[y][x] = TILE_PIT;
        }
      }
    }
    for (let y = room.y1 - 1; y <= room.y2 + 1; y++) {
      for (const x of [room.x1 - 1, room.x2 + 1]) {
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (tiles[y][x] === TILE_WALL) {
          tiles[y][x] = TILE_PIT;
        }
      }
    }
  }
}

/**
 * Catacombs: place pit segments along one side of corridors,
 * leaving 2 walkable tiles, and adding bridges where pits span full width.
 */
function placePitSegmentsInCorridors(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  // Find corridor stretches and place pit segments
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (tiles[y][x] !== TILE_FLOOR) continue;
      if (isInAnyRoom(x, y, rooms)) continue;
      if (Math.abs(x - spawn.x) <= 3 && Math.abs(y - spawn.y) <= 3) continue;

      // 15% chance per corridor tile to start a pit segment
      if (Math.random() > 0.15) continue;

      // Check if this is a horizontal or vertical corridor
      const horizontal =
        tiles[y][x - 1] === TILE_FLOOR && tiles[y][x + 1] === TILE_FLOOR &&
        !isInAnyRoom(x - 1, y, rooms) && !isInAnyRoom(x + 1, y, rooms);
      const vertical =
        tiles[y - 1][x] === TILE_FLOOR && tiles[y + 1][x] === TILE_FLOOR &&
        !isInAnyRoom(x, y - 1, rooms) && !isInAnyRoom(x, y + 1, rooms);

      if (horizontal) {
        // Place pit on one side (top or bottom edge of corridor)
        const side = Math.random() < 0.5 ? -1 : 1;
        const py = y + side;
        if (tiles[py]?.[x] === TILE_FLOOR && !isInAnyRoom(x, py, rooms)) {
          tiles[py][x] = TILE_PIT;
        }
      } else if (vertical) {
        // Place pit on one side (left or right edge of corridor)
        const side = Math.random() < 0.5 ? -1 : 1;
        const px = x + side;
        if (tiles[y]?.[px] === TILE_FLOOR && !isInAnyRoom(px, y, rooms)) {
          tiles[y][px] = TILE_PIT;
        }
      }
    }
  }
}

/**
 * Catacombs: place a ring of slow ground tiles just inside circular room edges.
 */
function placeSlowGroundRing(
  tiles: number[][],
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;

    const rw = room.x2 - room.x1 + 1;
    const rh = room.y2 - room.y1 + 1;
    if (rw < 7 || rh < 7) continue; // skip tiny rooms

    // Place slow ground in a 1-2 tile ring near room edges
    for (let y = room.y1 + 1; y <= room.y2 - 1; y++) {
      for (let x = room.x1 + 1; x <= room.x2 - 1; x++) {
        if (tiles[y][x] !== TILE_FLOOR) continue;

        const edgeDist = Math.min(
          x - room.x1, room.x2 - x,
          y - room.y1, room.y2 - y,
        );

        // Place slow ground in 1-2 tile ring at edges, ~30% chance
        if (edgeDist <= 2 && Math.random() < 0.3) {
          tiles[y][x] = TILE_SLOW_GROUND;
        }
      }
    }
  }
}

/**
 * Warrens: add extra 2-tile-wide passages between rooms that share
 * a wall (within 3 tiles of each other).
 */
function addExtraConnections(
  tiles: number[][],
  _width: number,
  _height: number,
  rooms: DungeonRoom[],
): void {
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];

      // Check if rooms are close on any axis
      // Horizontal adjacency: rooms share vertical overlap and are within 3 tiles
      const vOverlap = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
      const hGap = Math.min(
        Math.abs(a.x2 - b.x1),
        Math.abs(b.x2 - a.x1),
      );

      if (vOverlap >= 3 && hGap <= 3 && hGap >= 1) {
        // Carve horizontal connection
        const midY = Math.floor((Math.max(a.y1, b.y1) + Math.min(a.y2, b.y2)) / 2);
        const minX = Math.min(a.x2, b.x2);
        const maxX = Math.max(a.x1, b.x1);
        for (let x = minX; x <= maxX; x++) {
          if (tiles[midY]?.[x] === TILE_WALL) tiles[midY][x] = TILE_FLOOR;
          if (tiles[midY + 1]?.[x] === TILE_WALL) tiles[midY + 1][x] = TILE_FLOOR;
        }
        continue;
      }

      // Vertical adjacency
      const hOverlap = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
      const vGap = Math.min(
        Math.abs(a.y2 - b.y1),
        Math.abs(b.y2 - a.y1),
      );

      if (hOverlap >= 3 && vGap <= 3 && vGap >= 1) {
        // Carve vertical connection
        const midX = Math.floor((Math.max(a.x1, b.x1) + Math.min(a.x2, b.x2)) / 2);
        const minY = Math.min(a.y2, b.y2);
        const maxY = Math.max(a.y1, b.y1);
        for (let y = minY; y <= maxY; y++) {
          if (tiles[y]?.[midX] === TILE_WALL) tiles[y][midX] = TILE_FLOOR;
          if (tiles[y]?.[midX + 1] === TILE_WALL) tiles[y][midX + 1] = TILE_FLOOR;
        }
      }
    }
  }
}

/**
 * Fractured Halls: place lines of destructible tiles across the width
 * of long rooms at 1/3 and 2/3 points, leaving a 1-tile gap at each end.
 */
function placeSectionWalls(
  tiles: number[][],
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;

    const rw = room.x2 - room.x1 + 1;
    const rh = room.y2 - room.y1 + 1;

    // Only place section walls in halls longer than 12 tiles
    if (rw < 12 && rh < 12) continue;

    if (rw >= rh) {
      // Horizontal hall: place vertical destructible lines
      const positions: number[] = [];
      if (rw >= 12) positions.push(Math.floor(room.x1 + rw / 3));
      if (rw >= 16) positions.push(Math.floor(room.x1 + (2 * rw) / 3));

      for (const wallX of positions) {
        // Place destructible tiles across the height, leaving 1-tile gap at ends
        for (let y = room.y1 + 1; y <= room.y2 - 1; y++) {
          if (tiles[y][wallX] === TILE_FLOOR) {
            tiles[y][wallX] = TILE_DESTRUCTIBLE;
          }
        }
      }
    } else {
      // Vertical hall: place horizontal destructible lines
      const positions: number[] = [];
      if (rh >= 12) positions.push(Math.floor(room.y1 + rh / 3));
      if (rh >= 16) positions.push(Math.floor(room.y1 + (2 * rh) / 3));

      for (const wallY of positions) {
        for (let x = room.x1 + 1; x <= room.x2 - 1; x++) {
          if (tiles[wallY][x] === TILE_FLOOR) {
            tiles[wallY][x] = TILE_DESTRUCTIBLE;
          }
        }
      }
    }
  }
}

/**
 * Crucible: place pillars in a circular ring pattern inside the central arena
 * (the largest room).
 */
function placeCrucibleRingPillars(
  tiles: number[][],
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  // Find the largest room (central arena)
  let largest: DungeonRoom | null = null;
  let largestArea = 0;
  for (const room of rooms) {
    const area = (room.x2 - room.x1 + 1) * (room.y2 - room.y1 + 1);
    if (area > largestArea) {
      largestArea = area;
      largest = room;
    }
  }
  if (!largest) return;

  const cx = Math.floor((largest.x1 + largest.x2) / 2);
  const cy = Math.floor((largest.y1 + largest.y2) / 2);

  // Skip if this is the spawn room
  if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) return;

  const rw = largest.x2 - largest.x1 + 1;
  const rh = largest.y2 - largest.y1 + 1;

  // Place pillars in a circular pattern at ~60% radius
  const radius = Math.min(rw, rh) * 0.3;
  const pillarCount = Math.max(4, Math.min(8, Math.floor(radius * 1.5)));

  for (let i = 0; i < pillarCount; i++) {
    const angle = (2 * Math.PI * i) / pillarCount;
    const px = Math.round(cx + Math.cos(angle) * radius);
    const py = Math.round(cy + Math.sin(angle) * radius);

    if (px > largest.x1 + 1 && px < largest.x2 - 1 &&
        py > largest.y1 + 1 && py < largest.y2 - 1) {
      if (tiles[py][px] === TILE_FLOOR) {
        tiles[py][px] = TILE_PILLAR;
      }
    }
  }
}

/**
 * Cathedral: attempt to merge adjacent rooms near the largest room
 * to create a massive central hall.
 */
function mergeCentralHall(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
): void {
  // Find the largest room
  let largestIdx = 0;
  let largestArea = 0;
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    const area = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
    if (area > largestArea) {
      largestArea = area;
      largestIdx = i;
    }
  }

  const main = rooms[largestIdx];
  const mainCx = Math.floor((main.x1 + main.x2) / 2);
  const mainCy = Math.floor((main.y1 + main.y2) / 2);

  // Skip if spawn room
  if (Math.abs(mainCx - spawn.x) <= 3 && Math.abs(mainCy - spawn.y) <= 3) return;

  // Try to merge 1-2 adjacent rooms by carving walls between them
  let merged = 0;
  for (let i = 0; i < rooms.length && merged < 2; i++) {
    if (i === largestIdx) continue;
    const r = rooms[i];

    // Check if room is close to the main room (within 4 tiles)
    const hDist = Math.min(
      Math.abs(main.x2 - r.x1),
      Math.abs(r.x2 - main.x1),
    );
    const vDist = Math.min(
      Math.abs(main.y2 - r.y1),
      Math.abs(r.y2 - main.y1),
    );

    const hOverlap = Math.min(main.x2, r.x2) - Math.max(main.x1, r.x1);
    const vOverlap = Math.min(main.y2, r.y2) - Math.max(main.y1, r.y1);

    if (hOverlap >= 3 && vDist <= 4 && vDist >= 0) {
      // Rooms vertically adjacent -- carve wall between them
      const minX = Math.max(main.x1, r.x1);
      const maxX = Math.min(main.x2, r.x2);
      const minY = Math.min(main.y2, r.y2);
      const maxY = Math.max(main.y1, r.y1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            if (tiles[y][x] === TILE_WALL) tiles[y][x] = TILE_FLOOR;
          }
        }
      }
      // Expand main room bounds to include merged room
      main.x1 = Math.min(main.x1, r.x1);
      main.y1 = Math.min(main.y1, r.y1);
      main.x2 = Math.max(main.x2, r.x2);
      main.y2 = Math.max(main.y2, r.y2);
      merged++;
    } else if (vOverlap >= 3 && hDist <= 4 && hDist >= 0) {
      // Rooms horizontally adjacent
      const minY = Math.max(main.y1, r.y1);
      const maxY = Math.min(main.y2, r.y2);
      const minX = Math.min(main.x2, r.x2);
      const maxX = Math.max(main.x1, r.x1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (y >= 0 && y < height && x >= 0 && x < width) {
            if (tiles[y][x] === TILE_WALL) tiles[y][x] = TILE_FLOOR;
          }
        }
      }
      main.x1 = Math.min(main.x1, r.x1);
      main.y1 = Math.min(main.y1, r.y1);
      main.x2 = Math.max(main.x2, r.x2);
      main.y2 = Math.max(main.y2, r.y2);
      merged++;
    }
  }

  // Place two parallel rows of pillars along the long axis of the hall
  const rw = main.x2 - main.x1 + 1;
  const rh = main.y2 - main.y1 + 1;

  if (rw >= rh) {
    // Horizontal hall: pillar rows run horizontally
    const rowY1 = Math.floor(main.y1 + rh / 3);
    const rowY2 = Math.floor(main.y2 - rh / 3);
    for (let x = main.x1 + 3; x <= main.x2 - 3; x += 4) {
      if (tiles[rowY1]?.[x] === TILE_FLOOR) tiles[rowY1][x] = TILE_PILLAR;
      if (tiles[rowY2]?.[x] === TILE_FLOOR) tiles[rowY2][x] = TILE_PILLAR;
    }
  } else {
    // Vertical hall: pillar rows run vertically
    const rowX1 = Math.floor(main.x1 + rw / 3);
    const rowX2 = Math.floor(main.x2 - rw / 3);
    for (let y = main.y1 + 3; y <= main.y2 - 3; y += 4) {
      if (tiles[y]?.[rowX1] === TILE_FLOOR) tiles[y][rowX1] = TILE_PILLAR;
      if (tiles[y]?.[rowX2] === TILE_FLOOR) tiles[y][rowX2] = TILE_PILLAR;
    }
  }
}

// ── Step 1: Corridor Width Adjustment ──────────────────────────────

function adjustCorridorWidth(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  targetWidth: number,
): void {
  if (targetWidth < 3) {
    // Narrow corridors: fill corridor-widened tiles back to walls
    // Run multiple passes for very narrow corridors (width 1)
    const passes = targetWidth <= 1 ? 2 : 1;
    for (let p = 0; p < passes; p++) {
      narrowCorridors(tiles, width, height, rooms, targetWidth);
    }
  } else if (targetWidth > 3) {
    // Wider corridors: carve additional tiles alongside corridors
    widenCorridorsMore(tiles, width, height, rooms, targetWidth);
  }
}

function narrowCorridors(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  targetWidth: number,
): void {
  // Identify corridor tiles (floor tiles not inside any room)
  // Fill edge corridor tiles that have 2+ wall neighbors
  const toFill: Array<{ x: number; y: number }> = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_FLOOR) continue;
      if (isInAnyRoom(x, y, rooms)) continue;

      // Count wall neighbors in cardinal directions
      let wallCount = 0;
      if (tiles[y - 1][x] === TILE_WALL) wallCount++;
      if (tiles[y + 1][x] === TILE_WALL) wallCount++;
      if (tiles[y][x - 1] === TILE_WALL) wallCount++;
      if (tiles[y][x + 1] === TILE_WALL) wallCount++;

      // Edge corridor tiles have 2+ wall neighbors and are part of the widened area
      if (wallCount >= 2) {
        toFill.push({ x, y });
      }
    }
  }

  // For width 1: aggressively fill ~80% of candidates
  // For width 2: fill ~40% of candidates
  const fraction = targetWidth <= 1 ? 0.8 : 0.4;
  shuffle(toFill);
  const limit = Math.floor(toFill.length * fraction);
  for (let i = 0; i < limit; i++) {
    // Before filling, verify the tile still has enough floor neighbors
    // to maintain connectivity (at least 2 floor neighbors in a line)
    const { x, y } = toFill[i];
    const hFloor =
      (tiles[y]?.[x - 1] === TILE_FLOOR ? 1 : 0) +
      (tiles[y]?.[x + 1] === TILE_FLOOR ? 1 : 0);
    const vFloor =
      (tiles[y - 1]?.[x] === TILE_FLOOR ? 1 : 0) +
      (tiles[y + 1]?.[x] === TILE_FLOOR ? 1 : 0);

    // Only fill if corridor remains connected (at least one axis still has passage)
    if (hFloor >= 2 || vFloor >= 2 || (hFloor >= 1 && vFloor >= 1)) {
      tiles[y][x] = TILE_WALL;
    }
  }
}

function widenCorridorsMore(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  targetWidth: number,
): void {
  // Carve extra tiles along corridor edges
  const extraPasses = Math.floor((targetWidth - 3) / 2);
  for (let pass = 0; pass < extraPasses; pass++) {
    const toCarve: Array<{ x: number; y: number }> = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (tiles[y][x] !== TILE_WALL) continue;
        if (isInAnyRoom(x, y, rooms)) continue;

        // Check if adjacent to a corridor floor tile
        const adjFloor =
          (tiles[y - 1]?.[x] === TILE_FLOOR && !isInAnyRoom(x, y - 1, rooms)) ||
          (tiles[y + 1]?.[x] === TILE_FLOOR && !isInAnyRoom(x, y + 1, rooms)) ||
          (tiles[y]?.[x - 1] === TILE_FLOOR && !isInAnyRoom(x - 1, y, rooms)) ||
          (tiles[y]?.[x + 1] === TILE_FLOOR && !isInAnyRoom(x + 1, y, rooms));

        if (adjFloor && x > 1 && x < width - 2 && y > 1 && y < height - 2) {
          toCarve.push({ x, y });
        }
      }
    }
    for (const pos of toCarve) {
      tiles[pos.y][pos.x] = TILE_FLOOR;
    }
  }
}

// ── Step 2: Room Shape Stamping ─────────────────────────────────────

function stampRoomShapes(
  tiles: number[][],
  _width: number,
  _height: number,
  rooms: DungeonRoom[],
  patterns: MapDesignConfig['roomPatterns'],
): void {
  // Build weighted shape list
  const shapeWeights: Array<{ shape: string; weight: number }> = [];
  for (const p of patterns) {
    if (p.shape !== 'rectangle') {
      shapeWeights.push({ shape: p.shape, weight: p.weight });
    }
  }
  if (shapeWeights.length === 0) return;

  for (const room of rooms) {
    const rw = room.x2 - room.x1 + 1;
    const rh = room.y2 - room.y1 + 1;
    const cx = (room.x1 + room.x2) / 2;
    const cy = (room.y1 + room.y2) / 2;

    // Pick shape by weighted random
    const shape = pickWeightedShape(shapeWeights);
    if (!shape) continue;

    switch (shape) {
      case 'circular':
        carveCircular(tiles, room, cx, cy, rw, rh);
        break;
      case 'diamond':
        carveDiamond(tiles, room, cx, cy, rw, rh);
        break;
      case 'cross':
        carveCross(tiles, room, rw, rh);
        break;
      case 'L-shaped':
        carveLShaped(tiles, room, rw, rh);
        break;
      case 'irregular':
        carveIrregular(tiles, room, rw, rh);
        break;
    }
  }
}

function carveCircular(
  tiles: number[][],
  room: DungeonRoom,
  cx: number,
  cy: number,
  rw: number,
  rh: number,
): void {
  const rx = rw / 2;
  const ry = rh / 2;
  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1.0) {
        tiles[y][x] = TILE_WALL;
      }
    }
  }
}

function carveDiamond(
  tiles: number[][],
  room: DungeonRoom,
  cx: number,
  cy: number,
  rw: number,
  rh: number,
): void {
  const rx = rw / 2;
  const ry = rh / 2;
  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      const dx = Math.abs(x - cx) / rx;
      const dy = Math.abs(y - cy) / ry;
      if (dx + dy > 1.0) {
        tiles[y][x] = TILE_WALL;
      }
    }
  }
}

function carveCross(
  tiles: number[][],
  room: DungeonRoom,
  rw: number,
  rh: number,
): void {
  // Fill corners with walls to create a plus-sign shape
  const armW = Math.max(2, Math.floor(rw / 3));
  const armH = Math.max(2, Math.floor(rh / 3));

  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      const lx = x - room.x1;
      const ly = y - room.y1;
      // Check if in horizontal arm or vertical arm
      const inHArm = ly >= armH && ly < rh - armH;
      const inVArm = lx >= armW && lx < rw - armW;
      if (!inHArm && !inVArm) {
        tiles[y][x] = TILE_WALL;
      }
    }
  }
}

function carveLShaped(
  tiles: number[][],
  room: DungeonRoom,
  rw: number,
  rh: number,
): void {
  // Fill one quadrant with walls to create an L shape
  const halfW = Math.floor(rw / 2);
  const halfH = Math.floor(rh / 2);
  // Randomly pick which quadrant to fill
  const quadrant = Math.floor(Math.random() * 4);

  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      const lx = x - room.x1;
      const ly = y - room.y1;
      let fill = false;
      switch (quadrant) {
        case 0: fill = lx >= halfW && ly < halfH; break;       // top-right
        case 1: fill = lx < halfW && ly < halfH; break;        // top-left
        case 2: fill = lx < halfW && ly >= halfH; break;       // bottom-left
        case 3: fill = lx >= halfW && ly >= halfH; break;      // bottom-right
      }
      if (fill) tiles[y][x] = TILE_WALL;
    }
  }
}

function carveIrregular(
  tiles: number[][],
  room: DungeonRoom,
  _rw: number,
  _rh: number,
): void {
  // Randomly indent 2-3 wall segments by 1-2 tiles to create alcoves
  const indentCount = 2 + Math.floor(Math.random() * 2);
  for (let i = 0; i < indentCount; i++) {
    const side = Math.floor(Math.random() * 4); // 0=top, 1=bottom, 2=left, 3=right
    const depth = 1 + Math.floor(Math.random() * 2);

    switch (side) {
      case 0: // top indent
        for (let d = 0; d < depth; d++) {
          const y = room.y1 + d;
          const startX = room.x1 + 1 + Math.floor(Math.random() * ((room.x2 - room.x1) / 2));
          const len = 2 + Math.floor(Math.random() * 3);
          for (let x = startX; x < Math.min(startX + len, room.x2); x++) {
            tiles[y][x] = TILE_WALL;
          }
        }
        break;
      case 1: // bottom indent
        for (let d = 0; d < depth; d++) {
          const y = room.y2 - d;
          const startX = room.x1 + 1 + Math.floor(Math.random() * ((room.x2 - room.x1) / 2));
          const len = 2 + Math.floor(Math.random() * 3);
          for (let x = startX; x < Math.min(startX + len, room.x2); x++) {
            tiles[y][x] = TILE_WALL;
          }
        }
        break;
      case 2: // left indent
        for (let d = 0; d < depth; d++) {
          const x = room.x1 + d;
          const startY = room.y1 + 1 + Math.floor(Math.random() * ((room.y2 - room.y1) / 2));
          const len = 2 + Math.floor(Math.random() * 3);
          for (let y = startY; y < Math.min(startY + len, room.y2); y++) {
            tiles[y][x] = TILE_WALL;
          }
        }
        break;
      case 3: // right indent
        for (let d = 0; d < depth; d++) {
          const x = room.x2 - d;
          const startY = room.y1 + 1 + Math.floor(Math.random() * ((room.y2 - room.y1) / 2));
          const len = 2 + Math.floor(Math.random() * 3);
          for (let y = startY; y < Math.min(startY + len, room.y2); y++) {
            tiles[y][x] = TILE_WALL;
          }
        }
        break;
    }
  }
}

// ── Step 3: Environmental Feature Placement ────────────────────────

function placeEnvironmentalFeatures(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  design: MapDesignConfig,
  tier: number,
): void {
  for (const feature of design.environmentalFeatures) {
    if (feature.tileType === TILE_FLOOR) continue; // skip "open ground" features

    const [minCount, maxCount] = feature.countPerRoom;
    if (maxCount === 0) continue;

    switch (feature.placement) {
      case 'room-center':
        placeInRoomCenters(tiles, width, height, rooms, spawn, feature, tier);
        break;
      case 'room-edge':
        placeAtRoomEdges(tiles, rooms, spawn, feature, tier);
        break;
      case 'room-corner':
        placeInRoomCorners(tiles, rooms, spawn, feature);
        break;
      case 'corridor':
        placeInCorridors(tiles, width, height, rooms, spawn, feature, tier);
        break;
      case 'random':
        placeRandom(tiles, width, height, rooms, spawn, feature, tier);
        break;
    }
  }
}

function placeInRoomCenters(
  tiles: number[][],
  _width: number,
  _height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  feature: MapDesignConfig['environmentalFeatures'][0],
  _tier: number,
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    const rw = room.x2 - room.x1 + 1;
    const rh = room.y2 - room.y1 + 1;

    // Skip spawn room
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;
    // Skip small rooms
    if (rw < 8 || rh < 8) continue;

    const count = randRange(feature.countPerRoom[0], feature.countPerRoom[1]);
    let placed = 0;

    if (feature.tileType === TILE_PILLAR) {
      // Place pillars at grid-aligned positions avoiding the center 3x3
      const positions = getPillarPositions(room, cx, cy);
      shuffle(positions);
      for (const pos of positions) {
        if (placed >= count) break;
        if (tiles[pos.y][pos.x] === TILE_FLOOR) {
          tiles[pos.y][pos.x] = feature.tileType;
          placed++;
        }
      }
    } else if (feature.tileType === TILE_PIT) {
      // Stamp a small pit cluster in the center
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = cx + dx;
          const py = cy + dy;
          if (tiles[py]?.[px] === TILE_FLOOR) {
            tiles[py][px] = TILE_PIT;
          }
        }
      }
    } else {
      // Generic center placement
      if (tiles[cy][cx] === TILE_FLOOR) {
        tiles[cy][cx] = feature.tileType;
      }
    }
  }
}

function placeAtRoomEdges(
  tiles: number[][],
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  feature: MapDesignConfig['environmentalFeatures'][0],
  _tier: number,
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;

    const count = randRange(feature.countPerRoom[0], feature.countPerRoom[1]);
    const edgeTiles = getEdgeTiles(room, tiles);
    shuffle(edgeTiles);

    let placed = 0;
    for (const pos of edgeTiles) {
      if (placed >= count) break;
      if (tiles[pos.y][pos.x] === TILE_FLOOR) {
        tiles[pos.y][pos.x] = feature.tileType;
        placed++;
      }
    }
  }
}

function placeInRoomCorners(
  tiles: number[][],
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  feature: MapDesignConfig['environmentalFeatures'][0],
): void {
  for (const room of rooms) {
    const cx = Math.floor((room.x1 + room.x2) / 2);
    const cy = Math.floor((room.y1 + room.y2) / 2);
    if (Math.abs(cx - spawn.x) <= 3 && Math.abs(cy - spawn.y) <= 3) continue;

    const count = randRange(feature.countPerRoom[0], feature.countPerRoom[1]);
    const corners = [
      { x: room.x1 + 1, y: room.y1 + 1 },
      { x: room.x2 - 1, y: room.y1 + 1 },
      { x: room.x1 + 1, y: room.y2 - 1 },
      { x: room.x2 - 1, y: room.y2 - 1 },
    ];
    shuffle(corners);

    let placed = 0;
    for (const pos of corners) {
      if (placed >= count) break;
      if (tiles[pos.y]?.[pos.x] === TILE_FLOOR) {
        tiles[pos.y][pos.x] = feature.tileType;
        placed++;
      }
    }
  }
}

function placeInCorridors(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  feature: MapDesignConfig['environmentalFeatures'][0],
  _tier: number,
): void {
  const corridorTiles: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_FLOOR) continue;
      if (isInAnyRoom(x, y, rooms)) continue;
      if (Math.abs(x - spawn.x) <= 2 && Math.abs(y - spawn.y) <= 2) continue;
      corridorTiles.push({ x, y });
    }
  }
  shuffle(corridorTiles);

  // For corridor features, place a fraction of corridor tiles
  const fraction = feature.tileType === TILE_CRACKED_FLOOR ? 0.2 : 0.1;
  const targetCount = Math.max(1, Math.floor(corridorTiles.length * fraction));
  for (let i = 0; i < Math.min(targetCount, corridorTiles.length); i++) {
    tiles[corridorTiles[i].y][corridorTiles[i].x] = feature.tileType;
  }
}

function placeRandom(
  tiles: number[][],
  width: number,
  height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  feature: MapDesignConfig['environmentalFeatures'][0],
  _tier: number,
): void {
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== TILE_FLOOR) continue;
      if (Math.abs(x - spawn.x) <= 3 && Math.abs(y - spawn.y) <= 3) continue;
      // Prefer non-corridor tiles for random placement
      if (!isInAnyRoom(x, y, rooms) && Math.random() > 0.3) continue;
      candidates.push({ x, y });
    }
  }
  shuffle(candidates);

  // Place ~10% coverage
  const targetCount = Math.max(1, Math.floor(candidates.length * 0.1));
  for (let i = 0; i < Math.min(targetCount, candidates.length); i++) {
    tiles[candidates[i].y][candidates[i].x] = feature.tileType;
  }
}

// ── Step 4: Special Room Processing ─────────────────────────────────

function processSpecialRooms(
  tiles: number[][],
  _width: number,
  _height: number,
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  design: MapDesignConfig,
): void {
  for (const special of design.specialRooms) {
    const room = selectSpecialRoom(rooms, spawn, special);
    if (!room) continue;

    // Apply modifications based on room purpose
    if (special.name.toLowerCase().includes('boss') ||
        special.name.toLowerCase().includes('arena') ||
        special.name.toLowerCase().includes('hall') ||
        special.name.toLowerCase().includes('crucible') ||
        special.name.toLowerCase().includes('crypt') ||
        special.name.toLowerCase().includes('den') ||
        special.name.toLowerCase().includes('diamond') ||
        special.name.toLowerCase().includes('platform')) {
      // Boss rooms: clear and place diamond pillar pattern
      clearRoomFeatures(tiles, room);
      placeBossPillars(tiles, room);
    }

    if (special.name.toLowerCase().includes('treasure') ||
        special.name.toLowerCase().includes('vault') ||
        special.name.toLowerCase().includes('stash') ||
        special.name.toLowerCase().includes('armory') ||
        special.name.toLowerCase().includes('cache') ||
        special.name.toLowerCase().includes('alcove')) {
      // Treasure rooms: seal one exit with destructible
      sealWithDestructible(tiles, room);
    }
  }
}

function selectSpecialRoom(
  rooms: DungeonRoom[],
  spawn: { x: number; y: number },
  special: MapDesignConfig['specialRooms'][0],
): DungeonRoom | null {
  // Filter by minimum size
  const candidates = rooms.filter((r) => {
    const w = r.x2 - r.x1 + 1;
    const h = r.y2 - r.y1 + 1;
    return w >= special.minWidth && h >= special.minHeight;
  });

  if (candidates.length === 0) {
    // Fallback: use any room
    return rooms.length > 1 ? rooms[rooms.length - 1] : null;
  }

  switch (special.selectionRule) {
    case 'largest':
      return candidates.reduce((best, r) => {
        const area = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
        const bestArea = (best.x2 - best.x1 + 1) * (best.y2 - best.y1 + 1);
        return area > bestArea ? r : best;
      });
    case 'smallest':
      return candidates.reduce((best, r) => {
        const area = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1);
        const bestArea = (best.x2 - best.x1 + 1) * (best.y2 - best.y1 + 1);
        return area < bestArea ? r : best;
      });
    case 'farthest-from-spawn':
      return candidates.reduce((best, r) => {
        const cx = (r.x1 + r.x2) / 2;
        const cy = (r.y1 + r.y2) / 2;
        const dist = (cx - spawn.x) ** 2 + (cy - spawn.y) ** 2;
        const bcx = (best.x1 + best.x2) / 2;
        const bcy = (best.y1 + best.y2) / 2;
        const bdist = (bcx - spawn.x) ** 2 + (bcy - spawn.y) ** 2;
        return dist > bdist ? r : best;
      });
    case 'second-room':
      return candidates.length > 1 ? candidates[1] : candidates[0];
    case 'random':
    default:
      return candidates[Math.floor(Math.random() * candidates.length)];
  }
}

function clearRoomFeatures(tiles: number[][], room: DungeonRoom): void {
  for (let y = room.y1; y <= room.y2; y++) {
    for (let x = room.x1; x <= room.x2; x++) {
      const t = tiles[y][x];
      if (t === TILE_PILLAR || t === TILE_CRACKED_FLOOR ||
          t === TILE_SLOW_GROUND || t === TILE_DESTRUCTIBLE) {
        tiles[y][x] = TILE_FLOOR;
      }
    }
  }
}

function placeBossPillars(tiles: number[][], room: DungeonRoom): void {
  const cx = Math.floor((room.x1 + room.x2) / 2);
  const cy = Math.floor((room.y1 + room.y2) / 2);
  const rw = room.x2 - room.x1 + 1;
  const rh = room.y2 - room.y1 + 1;

  // Place 4 pillars in a diamond pattern at 1/3 room offsets
  const offX = Math.max(2, Math.floor(rw / 3));
  const offY = Math.max(2, Math.floor(rh / 3));
  const positions = [
    { x: cx, y: cy - offY },
    { x: cx + offX, y: cy },
    { x: cx, y: cy + offY },
    { x: cx - offX, y: cy },
  ];

  for (const pos of positions) {
    if (pos.x > room.x1 && pos.x < room.x2 && pos.y > room.y1 && pos.y < room.y2) {
      if (tiles[pos.y][pos.x] === TILE_FLOOR) {
        tiles[pos.y][pos.x] = TILE_PILLAR;
      }
    }
  }
}

function sealWithDestructible(tiles: number[][], room: DungeonRoom): void {
  // Find a corridor exit and place a destructible wall
  const exits = findRoomExits(tiles, room);
  if (exits.length > 1) {
    // Seal one random exit (not all of them)
    const exit = exits[Math.floor(Math.random() * exits.length)];
    tiles[exit.y][exit.x] = TILE_DESTRUCTIBLE;
  }
}

// ── Helper Functions ──────────────────────────────────────────────

function isInAnyRoom(x: number, y: number, rooms: DungeonRoom[]): boolean {
  for (const r of rooms) {
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) return true;
  }
  return false;
}

function getPillarPositions(
  room: DungeonRoom,
  cx: number,
  cy: number,
): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  // Grid-aligned positions spaced 3-4 tiles apart, avoiding center 3x3
  for (let y = room.y1 + 2; y <= room.y2 - 2; y += 3) {
    for (let x = room.x1 + 2; x <= room.x2 - 2; x += 3) {
      if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) continue; // avoid center
      positions.push({ x, y });
    }
  }
  return positions;
}

function getEdgeTiles(
  room: DungeonRoom,
  tiles: number[][],
): Array<{ x: number; y: number }> {
  const edge: Array<{ x: number; y: number }> = [];
  for (let x = room.x1 + 1; x <= room.x2 - 1; x++) {
    if (tiles[room.y1 + 1]?.[x] === TILE_FLOOR) edge.push({ x, y: room.y1 + 1 });
    if (tiles[room.y2 - 1]?.[x] === TILE_FLOOR) edge.push({ x, y: room.y2 - 1 });
  }
  for (let y = room.y1 + 1; y <= room.y2 - 1; y++) {
    if (tiles[y]?.[room.x1 + 1] === TILE_FLOOR) edge.push({ x: room.x1 + 1, y });
    if (tiles[y]?.[room.x2 - 1] === TILE_FLOOR) edge.push({ x: room.x2 - 1, y });
  }
  return edge;
}

function findRoomExits(
  tiles: number[][],
  room: DungeonRoom,
): Array<{ x: number; y: number }> {
  const exits: Array<{ x: number; y: number }> = [];
  // Check border tiles for floor tiles adjacent to outside floor tiles
  // Top and bottom edges
  for (let x = room.x1; x <= room.x2; x++) {
    if (room.y1 > 0 && tiles[room.y1 - 1]?.[x] === TILE_FLOOR && tiles[room.y1][x] === TILE_FLOOR) {
      exits.push({ x, y: room.y1 });
    }
    if (tiles[room.y2 + 1]?.[x] === TILE_FLOOR && tiles[room.y2][x] === TILE_FLOOR) {
      exits.push({ x, y: room.y2 });
    }
  }
  // Left and right edges
  for (let y = room.y1; y <= room.y2; y++) {
    if (room.x1 > 0 && tiles[y]?.[room.x1 - 1] === TILE_FLOOR && tiles[y][room.x1] === TILE_FLOOR) {
      exits.push({ x: room.x1, y });
    }
    if (tiles[y]?.[room.x2 + 1] === TILE_FLOOR && tiles[y][room.x2] === TILE_FLOOR) {
      exits.push({ x: room.x2, y });
    }
  }
  return exits;
}

function pickWeightedShape(
  weights: Array<{ shape: string; weight: number }>,
): string | null {
  const total = weights.reduce((s, w) => s + w.weight, 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const w of weights) {
    r -= w.weight;
    if (r <= 0) return w.shape;
  }
  return weights[weights.length - 1].shape;
}

function randRange(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
