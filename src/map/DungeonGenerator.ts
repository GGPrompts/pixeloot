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
    roomWidth: [4, 12],
    roomHeight: [4, 8],
    corridorLength: [2, 6],
  });

  // Initialize tile array filled with walls
  const tiles: number[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = new Array<number>(width).fill(1);
  }

  digger.create((x, y, wall) => {
    tiles[y][x] = wall; // 0 = floor, 1 = wall
  });

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
