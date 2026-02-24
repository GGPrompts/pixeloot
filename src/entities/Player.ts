import { Graphics } from 'pixi.js';
import { world, type Entity } from '../ecs/world';
import { game } from '../Game';

/**
 * Creates the player entity: a glowing cyan chevron pointing right.
 * Adds it to the ECS world and the game's entity render layer.
 */
export function createPlayer(): Entity {
  const g = new Graphics();

  // Draw a chevron/arrow shape pointing right (~20px)
  g.moveTo(-10, -8)
    .lineTo(10, 0)
    .lineTo(-10, 8)
    .lineTo(-5, 0)
    .closePath()
    .fill({ color: 0x00ffff });

  // Position at center of screen
  const startX = 640;
  const startY = 360;
  g.position.set(startX, startY);

  // Add sprite to render layer
  game.entityLayer.addChild(g);

  // Add to ECS world
  const entity = world.add({
    position: { x: startX, y: startY },
    velocity: { x: 0, y: 0 },
    speed: 200,
    player: true as const,
    sprite: g,
  });

  return entity;
}
