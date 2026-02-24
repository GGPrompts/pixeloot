/**
 * Map Device: activates map items to generate new dungeons with modifiers.
 *
 * Stores the currently active modifiers globally so enemy spawn functions
 * and combat systems can query them.
 */

import { Graphics } from 'pixi.js';
import type { MapItem, MapModifier } from '../loot/MapItem';
import { generateDungeon } from '../map/DungeonGenerator';
import { TileMap } from '../map/TileMap';
import { world } from '../ecs/world';
import { game } from '../Game';
import { applyTheme, getActiveTheme, ZONE_THEMES } from './ZoneThemes';

// ── Active Map State ────────────────────────────────────────────────

let activeModifiers: MapModifier[] = [];
let activeQuantityBonus = 0;
let activeRarityBonus = 0;
let mapActive = false;

/** Returns the list of currently active map modifiers. */
export function getActiveModifiers(): readonly MapModifier[] {
  return activeModifiers;
}

/** Check whether a specific modifier effect is currently active. */
export function hasModifier(effect: string): boolean {
  return activeModifiers.some((m) => m.effect === effect);
}

/** Returns the current quantity bonus (0 when no map is active). */
export function getQuantityBonus(): number {
  return activeQuantityBonus;
}

/** Returns the current rarity bonus (0 when no map is active). */
export function getRarityBonus(): number {
  return activeRarityBonus;
}

/** Returns true when a map dungeon is currently active. */
export function isMapActive(): boolean {
  return mapActive;
}

// ── Map Activation ──────────────────────────────────────────────────

const TILE_SIZE = 32;
const SCREEN_W = 1280;
const SCREEN_H = 720;

/**
 * Activate a map item: generate a new dungeon, apply modifiers,
 * reset waves, clear enemies/loot, and teleport the player.
 */
export function activateMap(mapItem: MapItem): void {
  // 1. Store modifiers
  activeModifiers = [...mapItem.modifiers];
  activeQuantityBonus = mapItem.quantityBonus;
  activeRarityBonus = mapItem.rarityBonus;
  mapActive = true;

  // 2. Apply zone theme
  const themeKey = mapItem.theme ?? 'the_grid';
  applyTheme(themeKey);
  const theme = getActiveTheme();
  game.app.renderer.background.color = theme.backgroundColor;

  // 3. Clear all enemies, enemy projectiles, and loot from the world
  clearEntities();

  // 4. Generate new dungeon with a different size for variety
  const baseW = Math.floor(SCREEN_W / TILE_SIZE);
  const baseH = Math.floor(SCREEN_H / TILE_SIZE);
  // Vary size slightly based on tier
  const dungeonW = baseW + Math.floor(Math.random() * 10) - 5;
  const dungeonH = baseH + Math.floor(Math.random() * 6) - 3;
  const dungeonData = generateDungeon(
    Math.max(20, dungeonW),
    Math.max(15, dungeonH),
  );

  // 5. Replace the tile map
  // Remove old world layer children and re-draw
  game.worldLayer.removeChildren();
  drawGrid();
  game.tileMap = new TileMap(dungeonData);
  game.tileMap.render(game.worldLayer, theme.wallColor);

  // 6. Update scaling config with tier bonus
  // The wave system will pick this up via getActiveScalingConfig()

  // 7. Reset wave system
  game.waveSystem.currentWave = 0;
  game.waveSystem.start();

  // 8. Teleport player to new spawn
  const players = world.with('player', 'position');
  if (players.entities.length > 0) {
    const player = players.entities[0];
    const spawnPos = game.tileMap.tileToWorld(
      game.tileMap.spawn.x,
      game.tileMap.spawn.y,
    );
    player.position.x = spawnPos.x;
    player.position.y = spawnPos.y;
  }
}

/**
 * Clear active modifiers. Called when the map is completed (all waves done)
 * or the player returns to town.
 */
export function clearMapModifiers(): void {
  activeModifiers = [];
  activeQuantityBonus = 0;
  activeRarityBonus = 0;
  mapActive = false;
}

// ── Internal Helpers ────────────────────────────────────────────────

function clearEntities(): void {
  // Remove enemies
  const enemies = world.with('enemy');
  for (const e of [...enemies.entities]) {
    if (e.sprite) e.sprite.removeFromParent();
    world.remove(e);
  }

  // Remove enemy projectiles
  const enemyProj = world.with('enemyProjectile');
  for (const e of [...enemyProj.entities]) {
    if (e.sprite) e.sprite.removeFromParent();
    world.remove(e);
  }

  // Remove player projectiles
  const playerProj = world.with('projectile');
  for (const e of [...playerProj.entities]) {
    if (e.sprite) e.sprite.removeFromParent();
    world.remove(e);
  }

  // Remove loot drops
  const loot = world.with('pickup');
  for (const e of [...loot.entities]) {
    if (e.sprite) e.sprite.removeFromParent();
    world.remove(e);
  }
}

function drawGrid(): void {
  const theme = getActiveTheme();
  const g = new Graphics();

  for (let x = 0; x <= SCREEN_W; x += TILE_SIZE) {
    g.moveTo(x, 0).lineTo(x, SCREEN_H).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
  }
  for (let y = 0; y <= SCREEN_H; y += TILE_SIZE) {
    g.moveTo(0, y).lineTo(SCREEN_W, y).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
  }

  game.worldLayer.addChild(g);
}
