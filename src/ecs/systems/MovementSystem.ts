import { world } from '../world';
import { InputManager } from '../../core/InputManager';
import { game } from '../../Game';

const TILE_SIZE = 32;

const allMovers = world.with('position', 'velocity');
const players = world.with('position', 'velocity', 'speed', 'player');

/**
 * Movement system: reads input for player entities, applies velocity to position,
 * and resolves wall collisions for non-projectile entities.
 *
 * Called from fixedUpdate at 60 Hz.
 */
export function movementSystem(dt: number): void {
  const input = InputManager.instance;
  const move = input.getMovementVector();

  // Set velocity on player entities based on input
  for (const entity of players) {
    if (entity.inputDisabled) {
      entity.velocity.x = 0;
      entity.velocity.y = 0;
    } else {
      entity.velocity.x = move.x * entity.speed;
      entity.velocity.y = move.y * entity.speed;
    }
  }

  const tileMap = game.tileMap;

  // Apply velocity to position for all movers
  for (const entity of allMovers) {
    // Projectiles skip wall collision (handled by ProjectileSystem)
    if (entity.projectile) {
      entity.position.x += entity.velocity.x * dt;
      entity.position.y += entity.velocity.y * dt;
      continue;
    }

    const prevX = entity.position.x;
    const prevY = entity.position.y;

    // Try X movement first
    const newX = prevX + entity.velocity.x * dt;
    const tileAtNewX = tileMap.worldToTile(newX, prevY);
    if (!tileMap.isSolid(tileAtNewX.x, tileAtNewX.y)) {
      entity.position.x = newX;
    } else {
      // Slide against wall: snap to tile edge
      entity.velocity.x = 0;
      if (newX > prevX) {
        entity.position.x = tileAtNewX.x * TILE_SIZE - 1;
      } else {
        entity.position.x = (tileAtNewX.x + 1) * TILE_SIZE + 1;
      }
    }

    // Try Y movement
    const newY = prevY + entity.velocity.y * dt;
    const tileAtNewY = tileMap.worldToTile(entity.position.x, newY);
    if (!tileMap.isSolid(tileAtNewY.x, tileAtNewY.y)) {
      entity.position.y = newY;
    } else {
      entity.velocity.y = 0;
      if (newY > prevY) {
        entity.position.y = tileAtNewY.y * TILE_SIZE - 1;
      } else {
        entity.position.y = (tileAtNewY.y + 1) * TILE_SIZE + 1;
      }
    }
  }
}
