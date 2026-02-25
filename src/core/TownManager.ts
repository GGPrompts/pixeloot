/**
 * Town Manager: controls entering/exiting the safe town hub.
 *
 * enterTown() switches to the town map, places NPCs, disables waves.
 * exitTown() removes NPCs, generates a dungeon, starts waves.
 */

import { Graphics } from 'pixi.js';
import { game } from '../Game';
import { world } from '../ecs/world';
import { generateTownLayout } from '../map/TownMap';
import { TileMap } from '../map/TileMap';
import { TownVisualizer, buildTentDefs } from '../map/TownVisualizer';
import { applyTheme, getActiveTheme } from './ZoneThemes';
import { clearMapModifiers } from './MapDevice';
import { spawnTownNPCs, removeAllNPCs, NPC_DEFS } from '../entities/NPC';
import { autoSave } from '../save/SaveManager';
import { inventory } from './Inventory';
import { getComputedStats } from './ComputedStats';
import { clearCorpses } from '../entities/Enemy';
import { clearPortalAnimations } from '../entities/Portal';
import { refreshVendorStock } from './Vendor';

const TILE_SIZE = 32;

let inTown = false;
let townVisualizer: TownVisualizer | null = null;

// ── Public API ──────────────────────────────────────────────────────

/** Returns true if the player is currently in town. */
export function isInTown(): boolean {
  return inTown;
}

/**
 * Enter the town: switch to town map, place NPCs, stop wave system.
 * Auto-saves on entry.
 */
export function enterTown(): void {
  inTown = true;

  // Clear any active map modifiers
  clearMapModifiers();

  // Clear corpse records from Necromancer system
  clearCorpses();

  // Auto-collect all ground loot before clearing
  collectAllLoot();

  // Clear enemies, projectiles, loot
  clearAllEntities();

  // Apply town theme
  applyTheme('town');
  const theme = getActiveTheme();
  game.app.renderer.background.color = theme.backgroundColor;

  // Generate town layout
  const townData = generateTownLayout();

  // Replace tile map
  game.worldLayer.removeChildren();
  drawGrid(townData.width * TILE_SIZE, townData.height * TILE_SIZE);
  game.tileMap = new TileMap(townData);
  game.tileMap.render(game.worldLayer, theme.wallColor);

  // Stop wave system
  game.waveSystem.stop();
  game.waveSystem.currentWave = 0;

  // Teleport player below the NPC row (NPCs are at Y+3, player at Y+6)
  const spawnPos = game.tileMap.tileToWorld(townData.spawn.x, townData.spawn.y);
  const playerSpawnY = spawnPos.y + 6 * TILE_SIZE;
  const players = world.with('player', 'position', 'sprite');
  if (players.entities.length > 0) {
    const p = players.entities[0];
    p.position.x = spawnPos.x;
    p.position.y = playerSpawnY;
    // Scale up player sprite in town for visibility
    (p.sprite as Graphics).scale.set(1.5);
  }

  // Revive player if dead
  const playersFull = world.with('player');
  if (playersFull.entities.length > 0) {
    const p = playersFull.entities[0];
    if (p.dead) {
      world.removeComponent(p, 'dead');
    }
    if (p.health) {
      p.health.current = p.health.max;
    }
  }

  // Spawn NPCs
  spawnTownNPCs(spawnPos.x, spawnPos.y);

  // Create bazaar visualizer
  const mapPixelW = townData.width * TILE_SIZE;
  const mapPixelH = townData.height * TILE_SIZE;
  townVisualizer = new TownVisualizer(mapPixelW, mapPixelH);
  townVisualizer.setTents(buildTentDefs(spawnPos.x, spawnPos.y, NPC_DEFS));

  // Refresh vendor stock on dungeon completion
  const levelQuery = world.with('player', 'level');
  const playerLevel = levelQuery.entities.length > 0 ? levelQuery.entities[0].level : 1;
  refreshVendorStock(playerLevel);

  // Auto-save
  autoSave().catch((err) => console.warn('Auto-save on town entry failed:', err));
}

/**
 * Exit town: remove NPCs. The actual dungeon generation is handled by
 * MapDevice.activateMap(), so this just cleans up town state.
 */
export function exitTown(): void {
  inTown = false;
  // Reset player sprite scale back to normal for dungeon
  const players = world.with('player', 'sprite');
  if (players.entities.length > 0) {
    (players.entities[0].sprite as Graphics).scale.set(1);
  }
  removeAllNPCs();
  if (townVisualizer) {
    townVisualizer.destroy();
    townVisualizer = null;
  }
}

/**
 * Update the town bazaar visualizer (called each frame from Game.ts when in town).
 */
export function updateTownVisualizer(dt: number, energy: number): void {
  if (townVisualizer) {
    townVisualizer.update(dt, energy);
  }
}

// ── Internal Helpers ────────────────────────────────────────────────

/**
 * Auto-collect all ground loot/gold before leaving the dungeon.
 * Queries by drop component (not pickup) so loot-filtered items are also collected.
 */
function collectAllLoot(): void {
  const players = world.with('player');
  if (players.entities.length === 0) return;
  const player = players.entities[0];
  const stats = getComputedStats();

  // Collect gold
  for (const e of [...world.with('goldDrop').entities]) {
    const amount = Math.round(e.goldDrop * stats.goldMultiplier);
    if (player.gold !== undefined) {
      player.gold += amount;
    } else {
      world.addComponent(player, 'gold', amount);
    }
  }

  // Collect items (silently skip if backpack is full)
  for (const e of [...world.with('lootDrop').entities]) {
    inventory.addItem(e.lootDrop.item);
  }

  // Collect maps
  for (const e of [...world.with('mapDrop').entities]) {
    inventory.addMap(e.mapDrop.mapItem);
  }

  // Collect gems
  for (const e of [...world.with('gemDrop').entities]) {
    inventory.addGem(e.gemDrop.gem);
  }
}

function clearAllEntities(): void {
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

  // Remove portal entities
  for (const e of [...world.with('portal').entities]) {
    if (e.sprite) e.sprite.removeFromParent();
    world.remove(e);
  }
  clearPortalAnimations();

  // Remove loot drops (including loot-filtered entities that lost their pickup component)
  const dropComponents = ['pickup', 'goldDrop', 'lootDrop', 'mapDrop', 'gemDrop'] as const;
  const seen = new Set<object>();
  for (const comp of dropComponents) {
    for (const e of [...world.with(comp).entities]) {
      if (seen.has(e)) continue;
      seen.add(e);
      if (e.sprite) e.sprite.removeFromParent();
      world.remove(e);
    }
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
