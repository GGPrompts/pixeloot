import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';
import { setPlayerStats, applyComputedToEntity } from '../core/ComputedStats';
import { inventory } from '../core/Inventory';
import { skillSystem } from '../core/SkillSystem';

/**
 * Draw a Ranger sprite: hooded figure with bow, green/brown palette.
 * Oriented pointing right (rotation 0 = facing right).
 */
function drawRangerSprite(g: Graphics): void {
  g.clear();

  // Body / cloak (dark brown)
  g.moveTo(-6, -8)
    .lineTo(4, -6)
    .lineTo(6, 0)
    .lineTo(4, 6)
    .lineTo(-6, 8)
    .lineTo(-4, 0)
    .closePath()
    .fill({ color: 0x5c3a1e });

  // Hood (forest green, triangular shape on top)
  g.moveTo(-8, -6)
    .lineTo(2, -10)
    .lineTo(4, -4)
    .lineTo(-4, -2)
    .closePath()
    .fill({ color: 0x2d6e2d });

  // Hood shadow (darker green inner)
  g.moveTo(-6, -5)
    .lineTo(0, -8)
    .lineTo(2, -4)
    .lineTo(-4, -3)
    .closePath()
    .fill({ color: 0x1a4a1a });

  // Bow (curved arc on the front side, light brown)
  g.moveTo(6, -9)
    .lineTo(8, -6)
    .lineTo(10, 0)
    .lineTo(8, 6)
    .lineTo(6, 9)
    .stroke({ width: 2, color: 0x8b6914 });

  // Bowstring (thin white line)
  g.moveTo(6, -9)
    .lineTo(6, 9)
    .stroke({ width: 1, color: 0xccccaa, alpha: 0.7 });

  // Eye dot (bright green glow under hood)
  g.circle(1, -3, 1.5).fill({ color: 0x44ff44 });
}

/**
 * Draw a Mage sprite: robed figure with pointed hat and staff, purple/blue palette.
 * Oriented pointing right (rotation 0 = facing right).
 */
function drawMageSprite(g: Graphics): void {
  g.clear();

  // Robe body (deep purple)
  g.moveTo(-6, -6)
    .lineTo(4, -5)
    .lineTo(6, 0)
    .lineTo(4, 5)
    .lineTo(-6, 8)
    .lineTo(-8, 4)
    .lineTo(-6, 0)
    .lineTo(-8, -4)
    .closePath()
    .fill({ color: 0x4a1a6e });

  // Robe trim (lighter purple edges)
  g.moveTo(-6, -6)
    .lineTo(-8, -4)
    .lineTo(-6, 0)
    .lineTo(-8, 4)
    .lineTo(-6, 8)
    .stroke({ width: 1.5, color: 0x8844cc });

  // Pointed hat (blue-purple triangle on top)
  g.moveTo(-4, -6)
    .lineTo(-2, -14)
    .lineTo(4, -6)
    .closePath()
    .fill({ color: 0x3333aa });

  // Hat brim accent (bright blue line)
  g.moveTo(-5, -6)
    .lineTo(5, -5)
    .stroke({ width: 1.5, color: 0x6688ff });

  // Staff (extends forward, brown shaft)
  g.moveTo(6, 2)
    .lineTo(12, -2)
    .stroke({ width: 2, color: 0x8b6914 });

  // Staff orb (glowing cyan crystal at tip)
  g.circle(12, -2, 3).fill({ color: 0x22ccff, alpha: 0.8 });
  g.circle(12, -2, 4.5).fill({ color: 0x44eeff, alpha: 0.25 });

  // Eye (glowing blue under hat)
  g.circle(2, -3, 1.5).fill({ color: 0x44aaff });
}

/**
 * Redraws the player sprite to match the currently active class.
 * Call this after class switching.
 */
export function updatePlayerSprite(): void {
  const players = world.with('player', 'sprite');
  if (players.entities.length === 0) return;
  const player = players.entities[0];
  const g = player.sprite as Graphics;
  const activeClass = skillSystem.activeClass.toLowerCase();

  if (activeClass === 'mage') {
    drawMageSprite(g);
  } else {
    drawRangerSprite(g);
  }
}

/**
 * Creates the player entity with a class-appropriate sprite.
 * Adds it to the ECS world and the game's entity render layer.
 */
export function createPlayer(): Entity {
  const g = new Graphics();

  // Draw initial sprite based on active class (default to ranger if none set yet)
  const activeClass = skillSystem.activeClass.toLowerCase();
  if (activeClass === 'mage') {
    drawMageSprite(g);
  } else {
    drawRangerSprite(g);
  }

  // Position at dungeon spawn point
  const spawnTile = game.tileMap.spawn;
  const spawnPos = game.tileMap.tileToWorld(spawnTile.x, spawnTile.y);
  const startX = spawnPos.x;
  const startY = spawnPos.y;
  g.position.set(startX, startY);

  // Add sprite to render layer
  game.entityLayer.addChild(g);

  // Add to ECS world
  const entity = world.add({
    position: { x: startX, y: startY },
    velocity: { x: 0, y: 0 },
    speed: 200,
    baseSpeed: 200,
    player: true as const,
    health: { current: 100, max: 100 },
    gold: 0,
    sprite: g,
    xp: 0,
    level: 1,
    statPoints: 0,
    stats: { dexterity: 0, intelligence: 0, vitality: 0, focus: 0 },
  });

  // Wire up computed stats: set player stat reference and gear change callback
  setPlayerStats(entity.stats!);
  inventory.onGearChange = () => {
    applyComputedToEntity(entity as Entity & { health: { current: number; max: number }; baseSpeed: number; speed: number });
  };

  return entity;
}
