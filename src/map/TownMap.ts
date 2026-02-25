/**
 * Town Map: a pre-built safe zone layout (not procedural).
 * Simple open area with walls around the perimeter.
 */

import type { DungeonData } from './DungeonGenerator';

const TOWN_W = 30;
const TOWN_H = 20;

/**
 * Generate the town layout: walls around perimeter, open floor inside.
 * Returns DungeonData so it can be used with TileMap directly.
 */
export function generateTownLayout(): DungeonData {
  const tiles: number[][] = [];

  for (let y = 0; y < TOWN_H; y++) {
    tiles[y] = [];
    for (let x = 0; x < TOWN_W; x++) {
      // Walls on perimeter
      if (x === 0 || x === TOWN_W - 1 || y === 0 || y === TOWN_H - 1) {
        tiles[y][x] = 1;
      } else {
        tiles[y][x] = 0;
      }
    }
  }

  // Spawn at center
  const spawn = {
    x: Math.floor(TOWN_W / 2),
    y: Math.floor(TOWN_H / 2),
  };

  return {
    width: TOWN_W,
    height: TOWN_H,
    tiles,
    rooms: [{ x1: 1, y1: 1, x2: TOWN_W - 2, y2: TOWN_H - 2 }],
    spawn,
  };
}
