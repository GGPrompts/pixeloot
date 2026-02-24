import { Graphics, Container } from 'pixi.js';
import type { DungeonData } from './DungeonGenerator';

const TILE_SIZE = 32;

export class TileMap {
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: number[][];
  public readonly spawn: { x: number; y: number };

  private gfx: Graphics;

  constructor(data: DungeonData) {
    this.width = data.width;
    this.height = data.height;
    this.tiles = data.tiles;
    this.spawn = data.spawn;
    this.gfx = new Graphics();
  }

  /** Returns true if the tile at (tileX, tileY) is solid (wall or out of bounds). */
  isSolid(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return true;
    }
    return this.tiles[tileY][tileX] === 1;
  }

  /** Convert pixel coordinates to tile coordinates. */
  worldToTile(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE),
    };
  }

  /** Convert tile coordinates to pixel center of that tile. */
  tileToWorld(tileX: number, tileY: number): { x: number; y: number } {
    return {
      x: tileX * TILE_SIZE + TILE_SIZE / 2,
      y: tileY * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  /** Returns a random floor tile position (tile coords). */
  getRandomFloorTile(): { x: number; y: number } {
    const floors: { x: number; y: number }[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === 0) {
          floors.push({ x, y });
        }
      }
    }
    return floors[Math.floor(Math.random() * floors.length)];
  }

  /** Render walls onto a parent container. Floor tiles are left transparent so the grid shows through. */
  render(parent: Container, wallColor: number = 0x0d0d1a): void {
    this.gfx.clear();

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === 1) {
          this.gfx.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE).fill({ color: wallColor });
        }
      }
    }

    parent.addChild(this.gfx);
  }
}
