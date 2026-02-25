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
import { exitTown, isInTown } from './TownManager';
import { refreshMinimapLayout } from '../ui/Minimap';
import { musicPlayer } from '../audio/MusicPlayer';

// ── Active Map State ────────────────────────────────────────────────

let activeModifiers: MapModifier[] = [];
let activeQuantityBonus = 0;
let activeRarityBonus = 0;
let activeTierBonus = 0;
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

/** Returns the tier bonus of the currently active map (0 when no map is active). */
export function getActiveTierBonus(): number {
  return activeTierBonus;
}

/** Returns true when a map dungeon is currently active. */
export function isMapActive(): boolean {
  return mapActive;
}

// ── Map Activation ──────────────────────────────────────────────────

const TILE_SIZE = 32;

/**
 * Activate a map item: generate a new dungeon, apply modifiers,
 * reset waves, clear enemies/loot, and teleport the player.
 */
export function activateMap(mapItem: MapItem): void {
  // Exit town if currently in town
  if (isInTown()) {
    exitTown();
  }

  // Switch to combat music
  musicPlayer.crossfade('combat', 800);

  // 1. Store modifiers
  activeModifiers = [...mapItem.modifiers];
  activeQuantityBonus = mapItem.quantityBonus;
  activeRarityBonus = mapItem.rarityBonus;
  activeTierBonus = mapItem.tier;
  mapActive = true;

  // 2. Apply zone theme
  const themeKey = mapItem.theme ?? 'the_grid';
  applyTheme(themeKey);
  const theme = getActiveTheme();
  game.app.renderer.background.color = theme.backgroundColor;

  // 3. Clear all enemies, enemy projectiles, and loot from the world
  clearEntities();

  // 4. Generate new dungeon — size scales with map tier
  // Tier 1: ~80x50 (small arena), Tier 5: ~180x110 (sprawling dungeon)
  const tier = mapItem.tier ?? 1;
  const baseW = 60 + tier * 25;   // 85, 110, 135, 160, 185
  const baseH = 35 + tier * 15;   // 50, 65, 80, 95, 110
  // Add some random variance (±10%)
  const variance = 0.1;
  const dungeonW = Math.round(baseW * (1 + (Math.random() * 2 - 1) * variance));
  const dungeonH = Math.round(baseH * (1 + (Math.random() * 2 - 1) * variance));
  const dungeonData = generateDungeon(
    Math.max(60, dungeonW),
    Math.max(40, dungeonH),
  );

  // 5. Replace the tile map
  // Remove old world layer children and re-draw
  game.worldLayer.removeChildren();
  drawGrid(dungeonData.width * TILE_SIZE, dungeonData.height * TILE_SIZE);
  game.tileMap = new TileMap(dungeonData);
  game.tileMap.render(game.worldLayer, theme.wallColor);
  refreshMinimapLayout();

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
  activeTierBonus = 0;
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

function drawGrid(mapW: number, mapH: number): void {
  const theme = getActiveTheme();
  const g = new Graphics();

  for (let x = 0; x <= mapW; x += TILE_SIZE) {
    g.moveTo(x, 0).lineTo(x, mapH).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
  }
  for (let y = 0; y <= mapH; y += TILE_SIZE) {
    g.moveTo(0, y).lineTo(mapW, y).stroke({ width: 1, color: theme.gridColor, alpha: theme.gridAlpha });
  }

  game.worldLayer.addChild(g);
}
