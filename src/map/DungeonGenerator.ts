import { Map as RotMap } from 'rot-js';

export interface DungeonRoom {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DungeonData {
  width: number;
  height: number;
  tiles: number[][]; // 0 = floor, 1 = wall
  rooms: DungeonRoom[];
  spawn: { x: number; y: number }; // player start tile
}

export function generateDungeon(width: number, height: number): DungeonData {
  const digger = new RotMap.Digger(width, height, {
    roomWidth: [6, 16],
    roomHeight: [6, 12],
    corridorLength: [3, 8],
  });

  // Initialize tile array filled with walls
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array<number>(width).fill(1);
  }

  digger.create((x, y, wall) => {
    tiles[y][x] = wall; // 0 = floor, 1 = wall
  });

  // Post-process: widen 1-tile-wide corridors to 3 tiles
  widenCorridors(tiles, width, height);

  // Extract rooms
  const rotRooms = digger.getRooms();
  const rooms: DungeonRoom[] = rotRooms.map((r) => ({
    x1: r.getLeft(),
    y1: r.getTop(),
    x2: r.getRight(),
    y2: r.getBottom(),
  }));

  // Spawn at center of first room
  const first = rooms[0];
  const spawn = {
    x: Math.floor((first.x1 + first.x2) / 2),
    y: Math.floor((first.y1 + first.y2) / 2),
  };

  // Ensure connectivity and clean up wall islands
  ensureConnectivity(tiles, width, height, spawn);
  removeWallIslands(tiles, width, height);

  return { width, height, tiles, rooms, spawn };
}

/**
 * Widen corridors from 1 tile to 3 tiles.
 * For every floor tile that has walls on both left+right (horizontal corridor)
 * or both top+bottom (vertical corridor), carve out the adjacent wall tiles.
 */
function widenCorridors(
  tiles: number[][],
  width: number,
  height: number,
): void {
  // Collect tiles to carve so we don't modify while iterating
  const toCarve: Array<{ x: number; y: number }> = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== 0) continue; // skip walls

      const wallLeft = tiles[y][x - 1] === 1;
      const wallRight = tiles[y][x + 1] === 1;
      const wallUp = tiles[y - 1][x] === 1;
      const wallDown = tiles[y + 1][x] === 1;

      // Horizontal corridor (walls above and below)
      if (wallUp && wallDown) {
        if (y - 1 >= 1) toCarve.push({ x, y: y - 1 });
        if (y + 1 < height - 1) toCarve.push({ x, y: y + 1 });
      }

      // Vertical corridor (walls left and right)
      if (wallLeft && wallRight) {
        if (x - 1 >= 1) toCarve.push({ x: x - 1, y });
        if (x + 1 < width - 1) toCarve.push({ x: x + 1, y });
      }
    }
  }

  for (const pos of toCarve) {
    tiles[pos.y][pos.x] = 0;
  }
}

/**
 * Flood-fill from spawn to find all reachable walkable tiles (value 0, 3, 5, 7).
 * Any walkable tile NOT reached is converted to wall (1), eliminating isolated pockets.
 */
export function ensureConnectivity(
  tiles: number[][],
  width: number,
  height: number,
  spawn: { x: number; y: number },
): void {
  const WALKABLE = new Set([0, 3, 5, 7]); // floor, cracked, slow, bridge
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Seed from spawn
  const sx = spawn.x;
  const sy = spawn.y;
  if (sx >= 0 && sx < width && sy >= 0 && sy < height && WALKABLE.has(tiles[sy][sx])) {
    visited[sy * width + sx] = 1;
    queue.push(sy * width + sx);
  }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % width;
    const cy = (idx - cx) / width;

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      if (!WALKABLE.has(tiles[ny][nx])) continue;
      visited[nIdx] = 1;
      queue.push(nIdx);
    }
  }

  // Convert unreachable walkable tiles to walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (WALKABLE.has(tiles[y][x]) && !visited[y * width + x]) {
        tiles[y][x] = 1; // wall
      }
    }
  }
}

/**
 * Remove small wall islands (clusters of <= 4 wall tiles completely surrounded by floor).
 * These look like floating pillars and clutter the map.
 */
function removeWallIslands(
  tiles: number[][],
  width: number,
  height: number,
): void {
  const visited = new Uint8Array(width * height);
  const MAX_ISLAND_SIZE = 4;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (tiles[y][x] !== 1) continue; // only walls
      const idx = y * width + x;
      if (visited[idx]) continue;

      // BFS to find connected wall cluster
      const cluster: Array<{ x: number; y: number }> = [];
      const q: number[] = [idx];
      visited[idx] = 1;
      let touchesBorder = false;
      let qHead = 0;

      while (qHead < q.length) {
        const ci = q[qHead++];
        const cx = ci % width;
        const cy = (ci - cx) / width;
        cluster.push({ x: cx, y: cy });

        // If on map border, this isn't an island
        if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
          touchesBorder = true;
        }

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;
          if (tiles[ny][nx] !== 1) continue;
          visited[nIdx] = 1;
          q.push(nIdx);
        }
      }

      // Remove small isolated wall clusters
      if (!touchesBorder && cluster.length <= MAX_ISLAND_SIZE) {
        for (const pos of cluster) {
          tiles[pos.y][pos.x] = 0; // floor
        }
      }
    }
  }
}
