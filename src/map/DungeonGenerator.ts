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
