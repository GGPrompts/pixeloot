/**
 * Flow-field pathfinding: BFS from the player's tile to produce a direction
 * grid that all enemies can query cheaply.
 */

import type { TileMap } from './TileMap';

interface Vec2 {
  x: number;
  y: number;
}

const TILE_SIZE = 32;

// 4-directional neighbors (up, down, left, right)
const DIRS: Vec2[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

// The flow field: each cell stores a normalized direction toward the player,
// or null for walls / unreachable tiles.
let flowField: (Vec2 | null)[][] = [];
let fieldWidth = 0;
let fieldHeight = 0;

// Cache the last player tile so we skip rebuilding when the player hasn't moved
let lastPlayerTileX = -1;
let lastPlayerTileY = -1;

/**
 * Rebuild the flow field if the player has moved to a different tile.
 * Call this once per frame (at the top of aiSystem). It short-circuits
 * if the player tile hasn't changed.
 */
export function updateFlowField(
  playerWorldX: number,
  playerWorldY: number,
  tileMap: TileMap,
): void {
  const ptx = Math.floor(playerWorldX / TILE_SIZE);
  const pty = Math.floor(playerWorldY / TILE_SIZE);

  if (ptx === lastPlayerTileX && pty === lastPlayerTileY && fieldWidth === tileMap.width && fieldHeight === tileMap.height) {
    return; // player hasn't moved tiles, skip rebuild
  }

  lastPlayerTileX = ptx;
  lastPlayerTileY = pty;
  fieldWidth = tileMap.width;
  fieldHeight = tileMap.height;

  // Allocate / reset flow field
  flowField = [];
  for (let y = 0; y < fieldHeight; y++) {
    flowField[y] = new Array<Vec2 | null>(fieldWidth).fill(null);
  }

  // BFS from player tile
  // dist stores the BFS distance; -1 = unvisited
  const dist: number[][] = [];
  for (let y = 0; y < fieldHeight; y++) {
    dist[y] = new Array<number>(fieldWidth).fill(-1);
  }

  // Bounds check
  if (ptx < 0 || ptx >= fieldWidth || pty < 0 || pty >= fieldHeight) return;
  if (tileMap.blocksMovement(ptx, pty)) return; // player is somehow in a wall

  dist[pty][ptx] = 0;
  // Player's own tile points nowhere (enemy is already on the player)
  flowField[pty][ptx] = { x: 0, y: 0 };

  const queue: number[] = []; // encoded as y * fieldWidth + x
  queue.push(pty * fieldWidth + ptx);

  let head = 0;
  while (head < queue.length) {
    const encoded = queue[head++];
    const cx = encoded % fieldWidth;
    const cy = (encoded - cx) / fieldWidth;
    const cd = dist[cy][cx];

    for (const dir of DIRS) {
      const nx = cx + dir.x;
      const ny = cy + dir.y;

      if (nx < 0 || nx >= fieldWidth || ny < 0 || ny >= fieldHeight) continue;
      if (dist[ny][nx] !== -1) continue; // already visited
      if (tileMap.blocksMovement(nx, ny)) continue; // wall or arcane wall

      dist[ny][nx] = cd + 1;

      // Direction to move: from (nx, ny) toward (cx, cy), i.e. toward the player
      // This is simply -dir (the reverse of how we expanded)
      flowField[ny][nx] = { x: -dir.x, y: -dir.y };

      queue.push(ny * fieldWidth + nx);
    }
  }
}

/**
 * Invalidate the cached player tile so the next updateFlowField() call
 * forces a rebuild. Used when tile walkability changes at runtime
 * (e.g., glitch tiles toggling between floor and wall).
 */
export function invalidateFlowField(): void {
  lastPlayerTileX = -1;
  lastPlayerTileY = -1;
}

/**
 * Get the flow direction at a world position.
 * Returns a unit-ish direction vector pointing toward the player,
 * or null if the tile is a wall / unreachable.
 */
export function getFlowDirection(
  worldX: number,
  worldY: number,
): Vec2 | null {
  const tx = Math.floor(worldX / TILE_SIZE);
  const ty = Math.floor(worldY / TILE_SIZE);

  if (tx < 0 || tx >= fieldWidth || ty < 0 || ty >= fieldHeight) return null;
  return flowField[ty]?.[tx] ?? null;
}
