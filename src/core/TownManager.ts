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
import { applyTheme, getActiveTheme } from './ZoneThemes';
import { clearMapModifiers } from './MapDevice';
import { spawnTownNPCs, removeAllNPCs } from '../entities/NPC';
import { autoSave } from '../save/SaveManager';

const TILE_SIZE = 32;

let inTown = false;

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

  // Teleport player to town center
  const spawnPos = game.tileMap.tileToWorld(townData.spawn.x, townData.spawn.y);
  const players = world.with('player', 'position');
  if (players.entities.length > 0) {
    const p = players.entities[0];
    p.position.x = spawnPos.x;
    p.position.y = spawnPos.y;
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

  // Auto-save
  autoSave().catch((err) => console.warn('Auto-save on town entry failed:', err));
}

/**
 * Exit town: remove NPCs. The actual dungeon generation is handled by
 * MapDevice.activateMap(), so this just cleans up town state.
 */
export function exitTown(): void {
  inTown = false;
  removeAllNPCs();
}

// ── Internal Helpers ────────────────────────────────────────────────

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
