import { Graphics, Container } from 'pixi.js';
import type { DungeonData } from './DungeonGenerator';

const TILE_SIZE = 32;

// ── Tile Type Constants ─────────────────────────────────────────────
// Must match the TileType enum in designs/maps.ts

export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_PILLAR = 2;
export const TILE_CRACKED_FLOOR = 3;
export const TILE_PIT = 4;
export const TILE_SLOW_GROUND = 5;
export const TILE_DESTRUCTIBLE = 6;
export const TILE_BRIDGE = 7;

// ── Destructible HP Tracking ────────────────────────────────────────

/** Map from "x,y" tile key to remaining HP. Default HP is 3. */
const destructibleHP: Map<string, number> = new Map();
const DESTRUCTIBLE_MAX_HP = 3;

function dKey(x: number, y: number): string {
  return `${x},${y}`;
}

export class TileMap {
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: number[][];
  public readonly spawn: { x: number; y: number };
  public readonly rooms: { x1: number; y1: number; x2: number; y2: number }[];

  private gfx: Graphics;
  private _wallColor: number = 0x0d0d1a;
  private _parent: Container | null = null;

  constructor(data: DungeonData) {
    this.width = data.width;
    this.height = data.height;
    this.tiles = data.tiles;
    this.spawn = data.spawn;
    this.rooms = data.rooms;
    this.gfx = new Graphics();

    // Initialize destructible HP for all destructible tiles
    destructibleHP.clear();
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === TILE_DESTRUCTIBLE) {
          destructibleHP.set(dKey(x, y), DESTRUCTIBLE_MAX_HP);
        }
      }
    }
  }

  /**
   * Returns true if the tile is a hard wall or pillar (blocks projectiles).
   * Pillars block movement but NOT projectiles per design spec -- however walls
   * and destructibles do block projectiles.
   */
  isSolid(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return true;
    }
    const t = this.tiles[tileY][tileX];
    return t === TILE_WALL || t === TILE_DESTRUCTIBLE;
  }

  /**
   * Returns true if the tile blocks entity movement.
   * Walls, pillars, pits, and destructibles block movement.
   * Floors, cracked floors, slow ground, and bridges do NOT block movement.
   */
  blocksMovement(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return true;
    }
    const t = this.tiles[tileY][tileX];
    return t === TILE_WALL || t === TILE_PILLAR || t === TILE_PIT || t === TILE_DESTRUCTIBLE;
  }

  /** Returns true if the tile is slow ground (reduces movement speed). */
  isSlowGround(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return false;
    }
    return this.tiles[tileY][tileX] === TILE_SLOW_GROUND;
  }

  /** Returns true if the tile is a walkable floor-like tile (for spawn placement, etc). */
  isWalkable(tileX: number, tileY: number): boolean {
    if (tileX < 0 || tileY < 0 || tileX >= this.width || tileY >= this.height) {
      return false;
    }
    const t = this.tiles[tileY][tileX];
    return t === TILE_FLOOR || t === TILE_CRACKED_FLOOR || t === TILE_SLOW_GROUND || t === TILE_BRIDGE;
  }

  /**
   * Hit a destructible tile. Returns true if it broke (became floor).
   */
  hitDestructible(tileX: number, tileY: number, damage: number = 1): boolean {
    const key = dKey(tileX, tileY);
    const hp = destructibleHP.get(key);
    if (hp === undefined) return false;

    const newHP = hp - damage;
    if (newHP <= 0) {
      // Break: convert to floor
      this.tiles[tileY][tileX] = TILE_FLOOR;
      destructibleHP.delete(key);
      // Re-render to reflect the change
      if (this._parent) {
        this.render(this._parent, this._wallColor);
      }
      return true;
    }
    destructibleHP.set(key, newHP);
    return false;
  }

  /** Get remaining HP of a destructible tile, or 0 if not destructible. */
  getDestructibleHP(tileX: number, tileY: number): number {
    return destructibleHP.get(dKey(tileX, tileY)) ?? 0;
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

  /** Returns a random floor tile position (tile coords). Includes all walkable tile types. */
  getRandomFloorTile(): { x: number; y: number } {
    const floors: { x: number; y: number }[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        if (t === TILE_FLOOR || t === TILE_CRACKED_FLOOR || t === TILE_SLOW_GROUND || t === TILE_BRIDGE) {
          floors.push({ x, y });
        }
      }
    }
    return floors[Math.floor(Math.random() * floors.length)];
  }

  /** Render all tile types onto a parent container. */
  render(parent: Container, wallColor: number = 0x0d0d1a): void {
    this._wallColor = wallColor;
    this._parent = parent;
    this.gfx.clear();

    // Derive colors from wall color
    const pillarColor = darken(wallColor, 0.7);
    const pitColor = 0x000000;
    const slowGroundColor = 0x2244aa;
    const destructibleColor = wallColor;
    const crackColor = lighten(wallColor, 1.5);
    const bridgeColor = 0x665544;
    const bridgeEdgeColor = 0x443322;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const t = this.tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        switch (t) {
          case TILE_WALL:
            this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill({ color: wallColor });
            break;

          case TILE_PILLAR: {
            // Smaller centered rect (75% tile size)
            const inset = TILE_SIZE * 0.125;
            const sz = TILE_SIZE * 0.75;
            this.gfx.rect(px + inset, py + inset, sz, sz).fill({ color: pillarColor });
            break;
          }

          case TILE_CRACKED_FLOOR: {
            // Subtle crack lines over the transparent floor
            this.gfx
              .moveTo(px + 8, py + 6).lineTo(px + 16, py + 14).lineTo(px + 24, py + 10)
              .stroke({ width: 1, color: crackColor, alpha: 0.25 });
            this.gfx
              .moveTo(px + 10, py + 20).lineTo(px + 18, py + 26)
              .stroke({ width: 1, color: crackColor, alpha: 0.2 });
            break;
          }

          case TILE_PIT:
            // Black void
            this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill({ color: pitColor, alpha: 0.9 });
            break;

          case TILE_SLOW_GROUND:
            // Blue-ish overlay on the floor
            this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill({ color: slowGroundColor, alpha: 0.2 });
            break;

          case TILE_DESTRUCTIBLE: {
            // Wall with crack pattern
            this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill({ color: destructibleColor });
            // Crack lines
            const hp = this.getDestructibleHP(x, y);
            const crackAlpha = hp < DESTRUCTIBLE_MAX_HP ? 0.5 : 0.3;
            this.gfx
              .moveTo(px + 6, py + 4).lineTo(px + 16, py + 16).lineTo(px + 26, py + 12)
              .stroke({ width: 1.5, color: 0xffffff, alpha: crackAlpha });
            if (hp < DESTRUCTIBLE_MAX_HP) {
              this.gfx
                .moveTo(px + 16, py + 16).lineTo(px + 10, py + 28)
                .stroke({ width: 1, color: 0xffffff, alpha: 0.4 });
            }
            break;
          }

          case TILE_BRIDGE: {
            // Walkable bridge tile with edge lines
            this.gfx.rect(px, py, TILE_SIZE, TILE_SIZE).fill({ color: bridgeColor, alpha: 0.7 });
            // Edge markers on left/right
            this.gfx
              .rect(px, py, 2, TILE_SIZE).fill({ color: bridgeEdgeColor, alpha: 0.5 })
              .rect(px + TILE_SIZE - 2, py, 2, TILE_SIZE).fill({ color: bridgeEdgeColor, alpha: 0.5 });
            break;
          }

          // TILE_FLOOR (0) and any other value: leave transparent (grid shows through)
        }
      }
    }

    parent.addChild(this.gfx);
  }
}

// ── Color Helpers ──────────────────────────────────────────────────

function darken(color: number, factor: number): number {
  const r = Math.floor(((color >> 16) & 0xff) * factor);
  const g = Math.floor(((color >> 8) & 0xff) * factor);
  const b = Math.floor((color & 0xff) * factor);
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
}

function lighten(color: number, factor: number): number {
  const r = Math.min(255, Math.floor(((color >> 16) & 0xff) * factor));
  const g = Math.min(255, Math.floor(((color >> 8) & 0xff) * factor));
  const b = Math.min(255, Math.floor((color & 0xff) * factor));
  return (r << 16) | (g << 8) | b;
}
